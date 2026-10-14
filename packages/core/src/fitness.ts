import { addDays, daysBetween, formatIsoWeek, isoWeek, isoWeekRange, monthRange, parseIsoWeek } from "./time";
import type {
  BodyLog, FitnessPhase, FoodLog, ISODate, MaintenanceWeek, MicroKey, Micros, PhaseKind, Workout, WorkoutSet,
} from "./types";

// Fitness maths (docs/plans/fitness.md §1). Pure TS: every number the Fitness screens show comes from here.
// Rows are soft-deleted (`deletedAt`); every function ignores deleted rows.

// ===================== constants =====================
/** Energy in one kg of body weight. */
export const KCAL_PER_KG = 7700;
/** Smoothing factor of the trend-weight EMA. */
export const TREND_ALPHA = 0.1;
/** Cut safety: never a deficit above this many kcal/day, never a target below this many kcal. */
export const CUT_MAX_DEFICIT_KCAL = 1000;
export const CUT_MIN_KCAL = 1500;
/** Used when no week has a maintenance value yet (same as the `fitness.maintenanceKcal` setting default). */
export const DEFAULT_MAINTENANCE_KCAL = 2800;
export const DEFAULT_FIBRE_TARGET_G = 30;
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Phase defaults (all editable per phase). Rate is %/week of trend weight: cut < 0, bulk > 0. */
export const PHASE_DEFAULTS: Readonly<Record<PhaseKind, Pick<FitnessPhase, "ratePctPerWeek" | "proteinGPerKg" | "fatGPerKg">>> = {
  cut: { ratePctPerWeek: -1, proteinGPerKg: 2.2, fatGPerKg: 0.8 },
  bulk: { ratePctPerWeek: 0.25, proteinGPerKg: 2.2, fatGPerKg: 0.8 },
  recomp: { ratePctPerWeek: 0, proteinGPerKg: 2.2, fatGPerKg: 0.8 },
};

/** Micronutrients tracked per food, in display order. Units are defined once, in MICRO_INFO. */
export const MICRO_KEYS = [
  "fibre", "sugar", "satFat", "sodium", "potassium", "calcium", "iron", "magnesium", "zinc",
  "vitA", "vitB12", "vitC", "vitD",
] as const satisfies readonly MicroKey[];

export const MICRO_INFO: Readonly<Record<MicroKey, { label: string; unit: "g" | "mg" | "µg" }>> = {
  fibre: { label: "Fibre", unit: "g" },
  sugar: { label: "Sugar", unit: "g" },
  satFat: { label: "Saturated fat", unit: "g" },
  sodium: { label: "Sodium", unit: "mg" },
  potassium: { label: "Potassium", unit: "mg" },
  calcium: { label: "Calcium", unit: "mg" },
  iron: { label: "Iron", unit: "mg" },
  magnesium: { label: "Magnesium", unit: "mg" },
  zinc: { label: "Zinc", unit: "mg" },
  vitA: { label: "Vitamin A", unit: "µg" },
  vitB12: { label: "Vitamin B12", unit: "µg" },
  vitC: { label: "Vitamin C", unit: "mg" },
  vitD: { label: "Vitamin D", unit: "µg" },
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const live = <T extends { deletedAt?: string | null }>(rows: readonly T[]): T[] => rows.filter((r) => r.deletedAt == null);

// ===================== trend weight =====================
export type WeighIn = Pick<BodyLog, "date" | "weightKg"> & { deletedAt?: string | null };
export interface TrendPoint { date: ISODate; weightKg: number | null; trendKg: number }

/**
 * Exponentially weighted trend (α = 0.1) over daily weigh-ins. One point per date from the first weigh-in
 * to the last (or to `through` when later); days without a weigh-in carry the trend forward unchanged.
 * Rows without a weight and soft-deleted rows are ignored; if a date has several, the last one wins.
 */
export function trendWeight(logs: readonly WeighIn[], through?: ISODate): TrendPoint[] {
  const byDate = new Map<ISODate, number>();
  for (const l of live(logs)) if (l.weightKg != null) byDate.set(l.date, l.weightKg);
  const dates = [...byDate.keys()].sort();
  if (dates.length === 0) return [];
  const last = through && through > dates[dates.length - 1]! ? through : dates[dates.length - 1]!;
  const out: TrendPoint[] = [];
  let trend = 0;
  for (let d = dates[0]!, i = 0; d <= last; d = addDays(d, 1), i++) {
    const w = byDate.get(d) ?? null;
    trend = i === 0 ? (w as number) : w == null ? trend : trend + TREND_ALPHA * (w - trend);
    out.push({ date: d, weightKg: w, trendKg: trend });
  }
  return out;
}

/** Trend on `date`: the latest point at or before it; null before the first weigh-in. */
export function trendOn(trend: readonly TrendPoint[], date: ISODate): number | null {
  let found: number | null = null;
  for (const p of trend) {
    if (p.date > date) break;
    found = p.trendKg;
  }
  return found;
}

/** Trend change over the 7 days to `date`, as % of the trend 7 days earlier (negative = losing). Null without 8 days of history. */
export function weeklyRatePct(trend: readonly TrendPoint[], date: ISODate): number | null {
  const first = trend[0]?.date;
  const prior = addDays(date, -7);
  if (!first || first > prior) return null;
  const now = trendOn(trend, date);
  const before = trendOn(trend, prior);
  if (now == null || before == null || before === 0) return null;
  return ((now - before) / before) * 100;
}

// ===================== maintenance =====================
export type MaintenanceRow = Pick<MaintenanceWeek, "isoWeek" | "kcal"> & { deletedAt?: string | null };
export interface MaintenanceResult {
  kcal: number;
  /** True when the date's own ISO week has a value. */
  setForThisWeek: boolean;
  /** ISO week the value comes from ("2026-W41" when carried forward); null when it is the default. */
  fromWeek: string | null;
}

/** The value set for the date's ISO week, else the latest earlier week's, else `defaultKcal` (2800). */
export function maintenanceFor(
  weeks: readonly MaintenanceRow[],
  date: ISODate,
  defaultKcal: number = DEFAULT_MAINTENANCE_KCAL,
): MaintenanceResult {
  const key = formatIsoWeek(isoWeek(date));
  let best: MaintenanceRow | null = null;
  for (const w of live(weeks)) {
    if (w.isoWeek > key) continue; // "YYYY-Www" is zero-padded, so string order is week order
    if (!best || w.isoWeek > best.isoWeek) best = w;
  }
  if (!best) return { kcal: defaultKcal, setForThisWeek: false, fromWeek: null };
  return { kcal: best.kcal, setForThisWeek: best.isoWeek === key, fromWeek: best.isoWeek };
}

// ===================== daily targets =====================
export type TargetPhase = Pick<FitnessPhase, "kind" | "ratePctPerWeek" | "proteinGPerKg" | "fatGPerKg">;
export interface DailyTargets {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fibreG: number;
  /** True when the cut limit (deficit ≤ 1000 kcal or target ≥ 1500 kcal) changed the target. */
  capped: boolean;
  /** Rate the target will give, % of trend weight per week (negative = losing). */
  expectedRatePct: number;
}

/**
 * Targets for a day from the phase, that week's maintenance and the trend weight (never the raw scale weight).
 * Cut: deficit = rate × trend × 7700 ÷ 7, limited to 1000 kcal and a 1500 kcal floor; bulk: same as a surplus;
 * recomp: maintenance. Protein and fat are g/kg of trend; carbs fill the remaining kcal.
 */
export function dailyTargets(input: {
  phase: TargetPhase;
  maintenance: number;
  trendKg: number;
  fibreTargetG?: number;
}): DailyTargets {
  const { phase, maintenance, trendKg } = input;
  const magnitude = Math.abs(phase.ratePctPerWeek);
  const wanted = (magnitude / 100) * trendKg * KCAL_PER_KG / 7; // kcal/day, ≥ 0
  let delta = 0; // signed kcal/day versus maintenance
  let capped = false;
  if (phase.kind === "cut") {
    const limited = Math.min(wanted, CUT_MAX_DEFICIT_KCAL, Math.max(0, maintenance - CUT_MIN_KCAL));
    capped = limited < wanted - 1e-9;
    delta = -limited;
  } else if (phase.kind === "bulk") {
    delta = wanted;
  }
  const kcal = Math.round(maintenance + delta);
  const proteinG = Math.round(phase.proteinGPerKg * trendKg);
  const fatG = Math.round(phase.fatGPerKg * trendKg);
  const carbsKcal = kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;
  const carbsG = Math.max(0, Math.round(carbsKcal / KCAL_PER_G.carbs));
  const expectedRatePct = trendKg > 0 ? (((kcal - maintenance) * 7) / KCAL_PER_KG / trendKg) * 100 : 0;
  return {
    kcal, proteinG, fatG, carbsG,
    fibreG: input.fibreTargetG ?? DEFAULT_FIBRE_TARGET_G,
    capped,
    expectedRatePct,
  };
}

// ===================== food totals =====================
export type FoodLogRow = Pick<FoodLog, "date" | "servings" | "kcal" | "proteinG" | "carbsG" | "fatG" | "fibreG" | "micros"> & {
  deletedAt?: string | null;
};
export interface DayTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  micros: Micros;
  /** Number of food entries that make up the totals. */
  entries: number;
}

/** Sum of a day's food logs (nutrients are per serving × servings). Pass `date` to filter a mixed list. */
export function dayTotals(logs: readonly FoodLogRow[], date?: ISODate): DayTotals {
  let kcal = 0, proteinG = 0, carbsG = 0, fatG = 0, fibreG = 0, entries = 0;
  const micros: Micros = {};
  for (const l of live(logs)) {
    if (date !== undefined && l.date !== date) continue;
    entries++;
    kcal += l.kcal * l.servings;
    proteinG += l.proteinG * l.servings;
    carbsG += l.carbsG * l.servings;
    fatG += l.fatG * l.servings;
    fibreG += (l.fibreG ?? l.micros.fibre ?? 0) * l.servings; // fibreG wins; micros.fibre is the fallback
    for (const k of MICRO_KEYS) {
      if (k === "fibre") continue;
      const v = l.micros[k];
      if (v != null) micros[k] = round1((micros[k] ?? 0) + v * l.servings);
    }
  }
  return {
    kcal: Math.round(kcal), proteinG: round1(proteinG), carbsG: round1(carbsG), fatG: round1(fatG),
    fibreG: round1(fibreG), micros, entries,
  };
}

// ===================== week / month summaries =====================
export interface SummaryDay { date: ISODate; kcal: number | null; proteinG: number | null; maintenanceKcal: number }
export interface PeriodSummary {
  start: ISODate;
  end: ISODate;
  days: SummaryDay[];
  daysLogged: number;
  avgKcal: number | null;
  avgProteinG: number | null;
  /** Σ (eaten − maintenance) over logged days. Negative = deficit. */
  balanceKcal: number;
  /** Maintenance at the end of the period (a week has one value). */
  maintenanceKcal: number;
  /** Trend weight change over the period, kg (null with fewer than two trend points). */
  weightChangeKg: number | null;
  /** Weight change as % of the starting trend weight, per week (null as above). */
  ratePctPerWeek: number | null;
}
export interface WeekSummary extends PeriodSummary {
  isoWeek: string;
  /** Whether the week has its own maintenance value, or carries the last one forward. */
  maintenanceSetForWeek: boolean;
  maintenanceFromWeek: string | null;
}
export interface MonthSummary extends PeriodSummary {
  month: string;
  /** One row per ISO week touching the month, limited to the month's days. */
  weeks: WeekSummary[];
}

interface SummaryInput {
  foodLogs: readonly FoodLogRow[];
  bodyLogs: readonly WeighIn[];
  maintenanceWeeks: readonly MaintenanceRow[];
  defaultMaintenance?: number;
  /** Days after this are not counted as unlogged (the current week/month is still running). */
  today?: ISODate;
}

function summarise(start: ISODate, end: ISODate, input: SummaryInput): PeriodSummary {
  const defaultKcal = input.defaultMaintenance ?? DEFAULT_MAINTENANCE_KCAL;
  const last = input.today && input.today < end ? input.today : end;
  const days: SummaryDay[] = [];
  let kcalSum = 0, proteinSum = 0, balance = 0, logged = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const maintenanceKcal = maintenanceFor(input.maintenanceWeeks, d, defaultKcal).kcal;
    const t = d <= last ? dayTotals(input.foodLogs, d) : null;
    if (t && t.entries > 0) {
      days.push({ date: d, kcal: t.kcal, proteinG: t.proteinG, maintenanceKcal });
      kcalSum += t.kcal;
      proteinSum += t.proteinG;
      balance += t.kcal - maintenanceKcal;
      logged++;
    } else {
      days.push({ date: d, kcal: null, proteinG: null, maintenanceKcal });
    }
  }
  // Trend change: from the day before the period (or its first point) to the last day with a trend.
  const trend = trendWeight(input.bodyLogs, last);
  const inRange = trend.filter((p) => p.date >= start && p.date <= last);
  const before = trendOn(trend, addDays(start, -1));
  const endT = inRange.length ? inRange[inRange.length - 1]!.trendKg : null;
  let baseT: number | null = null; // trend at the start of the measured span
  let spanDays = 0;
  const weighIns = inRange.filter((p) => p.weightKg != null).length; // carried-forward days don't count
  if (endT != null && before != null && weighIns >= 1) {
    baseT = before;
    spanDays = daysBetween(addDays(start, -1), last);
  } else if (endT != null && weighIns >= 2) {
    baseT = inRange[0]!.trendKg;
    spanDays = daysBetween(inRange[0]!.date, last);
  }
  const changeKg = endT != null && baseT != null ? endT - baseT : null;
  const ratePct = changeKg != null && baseT ? (changeKg / baseT) * 100 * (7 / Math.max(1, spanDays)) : null;
  return {
    start, end, days,
    daysLogged: logged,
    avgKcal: logged ? Math.round(kcalSum / logged) : null,
    avgProteinG: logged ? Math.round(proteinSum / logged) : null,
    balanceKcal: Math.round(balance),
    maintenanceKcal: maintenanceFor(input.maintenanceWeeks, end, defaultKcal).kcal,
    weightChangeKg: changeKg != null ? Math.round(changeKg * 100) / 100 : null,
    ratePctPerWeek: ratePct != null ? Math.round(ratePct * 100) / 100 : null,
  };
}

/** Summary of one ISO week ("2026-W42", Mon–Sun). Throws on a malformed week key. */
export function weekSummary(week: string, input: SummaryInput): WeekSummary {
  const w = parseIsoWeek(week);
  if (!w) throw new Error(`invalid ISO week: ${week}`);
  const { start, end } = isoWeekRange(w.year, w.week);
  const m = maintenanceFor(input.maintenanceWeeks, end, input.defaultMaintenance);
  return { ...summarise(start, end, input), isoWeek: formatIsoWeek(w), maintenanceSetForWeek: m.setForThisWeek, maintenanceFromWeek: m.fromWeek };
}

/** Summary of a calendar month ("2026-10") with a clipped row per ISO week that touches it. */
export function monthSummary(yyyymm: string, input: SummaryInput): MonthSummary {
  const { start, end } = monthRange(yyyymm);
  const weeks: WeekSummary[] = [];
  for (let d = start; d <= end; ) {
    const w = isoWeek(d);
    const range = isoWeekRange(w.year, w.week);
    const from = d;
    const to = range.end < end ? range.end : end;
    const m = maintenanceFor(input.maintenanceWeeks, to, input.defaultMaintenance);
    weeks.push({ ...summarise(from, to, input), isoWeek: formatIsoWeek(w), maintenanceSetForWeek: m.setForThisWeek, maintenanceFromWeek: m.fromWeek });
    d = addDays(to, 1);
  }
  return { ...summarise(start, end, input), month: yyyymm.slice(0, 7), weeks };
}

const fmt = (n: number, digits = 1) => String(Number(n.toFixed(digits))).replace("-", "−");

/**
 * One plain sentence on a week, e.g. "Avg 1910 kcal vs 2800 maintenance, −6230 kcal for the week. Lost 0.6 %,
 * goal 1 %." Informational only; it never changes maintenance. `goalRatePct` is the phase rate (e.g. -1).
 */
export function weeklyCheckIn(s: Pick<WeekSummary, "daysLogged" | "avgKcal" | "maintenanceKcal" | "balanceKcal" | "ratePctPerWeek">, goalRatePct?: number): string {
  const parts: string[] = [];
  if (s.daysLogged === 0 || s.avgKcal == null) parts.push("No food logged this week.");
  else {
    const sign = s.balanceKcal > 0 ? "+" : s.balanceKcal < 0 ? "−" : "";
    parts.push(`Avg ${s.avgKcal} kcal vs ${s.maintenanceKcal} maintenance, ${sign}${Math.abs(s.balanceKcal)} kcal for the week.`);
  }
  if (s.ratePctPerWeek != null) {
    const r = s.ratePctPerWeek;
    const verb = Math.abs(r) < 0.05 ? "Held steady" : r < 0 ? `Lost ${fmt(Math.abs(r))} %` : `Gained ${fmt(r)} %`;
    const goal = goalRatePct != null && goalRatePct !== 0 ? `, goal ${fmt(Math.abs(goalRatePct), 2)} %` : "";
    parts.push(`${verb}${goal}.`);
  }
  return parts.join(" ");
}

// ===================== training =====================
/** Estimated one-rep max (Epley): kg × (1 + reps ÷ 30); one rep is the weight itself. Rounded to 0.1. */
export function e1rm(kg: number, reps: number): number {
  if (!(kg > 0) || !(reps >= 1)) return 0;
  return reps === 1 ? round1(kg) : round1(kg * (1 + reps / 30));
}

type SetRow = Pick<WorkoutSet, "workoutId" | "exercise" | "muscle" | "reps" | "kg"> & { deletedAt?: string | null };

/** Working sets per muscle in an ISO week, most sets first (ties by name). Sets take their date from their workout. */
export function weeklySetsByMuscle(
  workouts: readonly (Pick<Workout, "id" | "date"> & { deletedAt?: string | null })[],
  sets: readonly SetRow[],
  week: string,
): { muscle: string; sets: number }[] {
  const w = parseIsoWeek(week);
  if (!w) throw new Error(`invalid ISO week: ${week}`);
  const { start, end } = isoWeekRange(w.year, w.week);
  const inWeek = new Set(live(workouts).filter((x) => x.date >= start && x.date <= end).map((x) => x.id));
  const counts = new Map<string, number>();
  for (const s of live(sets)) if (inWeek.has(s.workoutId)) counts.set(s.muscle, (counts.get(s.muscle) ?? 0) + 1);
  return [...counts].map(([muscle, n]) => ({ muscle, sets: n })).sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}

export interface BestLift { exercise: string; muscle: string; e1rm: number; kg: number; reps: number }

/** Best estimated 1RM per exercise (the set that gives it), sorted by exercise name. */
export function bestByExercise(sets: readonly SetRow[]): BestLift[] {
  const best = new Map<string, BestLift>();
  for (const s of live(sets)) {
    const e = e1rm(s.kg, s.reps);
    const cur = best.get(s.exercise);
    if (e > 0 && (!cur || e > cur.e1rm)) best.set(s.exercise, { exercise: s.exercise, muscle: s.muscle, e1rm: e, kg: s.kg, reps: s.reps });
  }
  return [...best.values()].sort((a, b) => a.exercise.localeCompare(b.exercise));
}
