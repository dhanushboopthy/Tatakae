import { addDays, formatIsoWeek, isoWeek, isoWeekRange, monthRange, parseIsoWeek } from "./time";
import { appDayOf } from "./stats";
import {
  activePhaseOn,
  bodyAverages,
  maintenanceRuns,
  monthSummary,
  phaseProgress,
  targetsOn,
  trendWeight,
  weeklyCheckIn,
  weekSummary,
  type DailyTargets,
  type MaintenanceResult,
  type MaintenanceRun,
  type MonthSummary,
  type PhaseProgress,
  type TrendPoint,
  type WeekSummary,
} from "./fitness";
import type { FitnessRows } from "./fitnessDay";
import type { FitnessPhase, ISODate } from "./types";

// The Week, Month and Phase views of Fitness as plain data, built from the rows (docs/plans/fitness.md). The website and
// the phone both call these, so every number matches. Pure TS: pass live rows, phases newest first.

const live = <T extends { deletedAt?: string | null }>(rows: readonly T[]): T[] => rows.filter((r) => r.deletedAt == null);

/** Targets of one date from the loaded rows (core `targetsOn` with the user's settings, typed-in calories included). */
function targetsFor(rows: FitnessRows, date: ISODate) {
  return targetsOn(date, {
    phases: live(rows.phases),
    bodyLogs: live(rows.bodyLogs),
    maintenanceWeeks: live(rows.maintenanceWeeks),
    defaultMaintenance: rows.settings["fitness.maintenanceKcal"],
    fibreTargetG: rows.settings["fitness.fibreTargetG"],
    manualKcal: rows.settings["fitness.manualKcal"],
  });
}

const summaryInput = (rows: FitnessRows, today: ISODate) => ({
  foodLogs: live(rows.foodLogs),
  bodyLogs: live(rows.bodyLogs),
  maintenanceWeeks: live(rows.maintenanceWeeks),
  defaultMaintenance: rows.settings["fitness.maintenanceKcal"],
  today,
});

// ---------- Week ----------

export interface FitnessWeek {
  summary: WeekSummary;
  /** Calories target for each day of the week (the day's own phase, trend and maintenance), kcal. */
  dayTargets: Record<ISODate, number>;
  /** Target for the week's last day (or today), with the protein target for the average. */
  targets: DailyTargets | null;
  phase: FitnessPhase | null;
  checkIn: string;
  /** Weigh-ins and trend for the days of the week. */
  trend: TrendPoint[];
  averages: { steps: number | null; waterMl: number | null; sleepMin: number | null };
  /** When this week's maintenance was typed, if it was. */
  setOn: ISODate | null;
  /** Latest maintenance runs, newest first. */
  runs: MaintenanceRun[];
  currentWeek: string;
}

export function buildFitnessWeek(rows: FitnessRows, week: string, today: ISODate): FitnessWeek {
  const w = parseIsoWeek(week) ?? isoWeek(today);
  const key = formatIsoWeek(w);
  const { start, end } = isoWeekRange(w.year, w.week);
  const bodyLogs = live(rows.bodyLogs);
  const phases = live(rows.phases);
  const summary = weekSummary(key, summaryInput(rows, today));
  const asOf = end < today ? end : today;
  const at = targetsFor(rows, asOf);
  const dayTargets: Record<ISODate, number> = {};
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const t = targetsFor(rows, d);
    dayTargets[d] = t.targets?.kcal ?? t.maintenance.kcal;
  }
  const row = live(rows.maintenanceWeeks).find((m) => m.isoWeek === key);
  return {
    summary,
    dayTargets,
    targets: at.targets,
    phase: at.phase ? (phases.find((p) => p.id === at.phase?.id) ?? null) : null,
    checkIn: weeklyCheckIn(summary, at.phase?.ratePctPerWeek),
    trend: trendWeight(bodyLogs, asOf).filter((p) => p.date >= start && p.date <= asOf),
    averages: bodyAverages(bodyLogs, start, end),
    setOn: row ? appDayOf(row.updatedAt) : null,
    runs: maintenanceRuns(live(rows.maintenanceWeeks), formatIsoWeek(isoWeek(today))).slice(0, 5),
    currentWeek: formatIsoWeek(isoWeek(today)),
  };
}

// ---------- Month ----------

export interface FitnessMonthDay {
  date: ISODate;
  kcal: number | null;
  target: number;
}

export interface FitnessMonth {
  summary: MonthSummary;
  days: FitnessMonthDay[];
  trend: TrendPoint[];
  phase: FitnessPhase | null;
  /** Days with food logged at or under / over their target, and days not logged (up to today). */
  atOrUnder: number;
  over: number;
  notLogged: number;
  /** Days of the month that have started. */
  daysElapsed: number;
}

export function buildFitnessMonth(rows: FitnessRows, yyyymm: string, today: ISODate): FitnessMonth {
  const { start, end } = monthRange(yyyymm);
  const summary = monthSummary(yyyymm, summaryInput(rows, today));
  const asOf = end < today ? end : today;
  const days: FitnessMonthDay[] = summary.days.map((d) => {
    const t = targetsFor(rows, d.date);
    return { date: d.date, kcal: d.kcal, target: t.targets?.kcal ?? t.maintenance.kcal };
  });
  const started = days.filter((d) => d.date <= today);
  return {
    summary,
    days,
    trend: trendWeight(live(rows.bodyLogs), asOf).filter((p) => p.date >= start && p.date <= asOf),
    phase: activePhaseOn(live(rows.phases), asOf),
    atOrUnder: started.filter((d) => d.kcal != null && d.kcal <= d.target).length,
    over: started.filter((d) => d.kcal != null && d.kcal > d.target).length,
    notLogged: started.filter((d) => d.kcal == null).length,
    daysElapsed: started.length,
  };
}

// ---------- Phase ----------

export interface FitnessPhaseView {
  phases: FitnessPhase[];
  /** The phase running today, if any. */
  active: FitnessPhase | null;
  progress: PhaseProgress | null;
  /** Trend points since the active phase started, at least the last 14 days (the last 8 weeks without a phase). */
  trend: TrendPoint[];
  trendKg: number | null;
  maintenance: MaintenanceResult;
  targets: DailyTargets | null;
  runs: MaintenanceRun[];
  /** Weight of the phase on its last day, for the history list. */
  endWeights: Record<string, number | null>;
  latestWeightKg: number | null;
  fibreTargetG: number;
  /** The standing calories target typed in (setting), null while targets are calculated. */
  manualKcal: { kcal: number; from: ISODate } | null;
}

export function buildFitnessPhase(rows: FitnessRows, today: ISODate): FitnessPhaseView {
  const bodyLogs = live(rows.bodyLogs);
  const phases = live(rows.phases).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const at = targetsFor(rows, today);
  const active = at.phase ? (phases.find((p) => p.id === at.phase?.id) ?? null) : null;
  const lastTwoWeeks = addDays(today, -14); // a brand-new phase still shows a line
  const from = active ? (active.startDate < lastTwoWeeks ? active.startDate : lastTwoWeeks) : addDays(today, -56);
  const endWeights: Record<string, number | null> = {};
  for (const p of phases) {
    const through = p.endDate ?? today;
    const trend = trendWeight(bodyLogs.filter((b) => b.date <= through), through);
    endWeights[p.id] = trend.length ? Math.round((trend[trend.length - 1]?.trendKg ?? 0) * 10) / 10 : null;
  }
  const latest = [...bodyLogs].filter((b) => b.weightKg != null).sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    phases,
    active,
    progress: active ? phaseProgress(active, bodyLogs, today) : null,
    trend: trendWeight(bodyLogs, today).filter((p) => p.date >= from),
    trendKg: at.trendKg,
    maintenance: at.maintenance,
    targets: at.targets,
    runs: maintenanceRuns(live(rows.maintenanceWeeks), formatIsoWeek(isoWeek(today))).slice(0, 6),
    endWeights,
    latestWeightKg: latest?.weightKg ?? null,
    fibreTargetG: rows.settings["fitness.fibreTargetG"],
    manualKcal: rows.settings["fitness.manualKcal"],
  };
}
