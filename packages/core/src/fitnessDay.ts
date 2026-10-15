import {
  activePhaseOn,
  bestLifts,
  dayTotals,
  phaseLabel,
  recentFoodIds,
  targetsOn,
  trendWeight,
  weeklyRatePct,
  type DailyTargets,
  type DayTotals,
  type LiftSummary,
  type MaintenanceResult,
  type TrendPoint,
} from "./fitness";
import type { ResolvedSettings } from "./settings";
import { addDays } from "./time";
import type { BodyLog, FitnessPhase, Food, FoodLog, ISODate, MaintenanceWeek, Workout, WorkoutSet } from "./types";

// Everything one day of Fitness needs, composed from the local rows. Used by the website's Day tab and the
// phone's Today card, so both show the same numbers. Pure: callers load the rows (live ones) and pass them in.

export interface FitnessRows {
  settings: ResolvedSettings;
  bodyLogs: readonly BodyLog[];
  foods: readonly Food[];
  foodLogs: readonly FoodLog[];
  phases: readonly FitnessPhase[];
  maintenanceWeeks: readonly MaintenanceWeek[];
}

export interface FitnessDay {
  date: ISODate;
  settings: ResolvedSettings;
  /** The phase running on `date`; null when none has been started (targets then use recomp at maintenance). */
  phase: FitnessPhase | null;
  phaseText: string | null;
  /** Trend weight on the date (falls back to the phase's start weight); null until the first weigh-in. */
  trendKg: number | null;
  weeklyRatePct: number | null;
  maintenance: MaintenanceResult;
  /** Null until there is a weight to base protein and fat on. */
  targets: DailyTargets | null;
  totals: DayTotals;
  body: BodyLog | null;
  /** Latest weigh-in before this date. */
  previousWeightKg: number | null;
  /** Weigh-in and trend points of the last 14 days, for the small chart. */
  recentTrend: TrendPoint[];
  foods: Food[];
  logs: FoodLog[];
  /** Logs of the day before, for "copy yesterday". */
  yesterdayLogs: FoodLog[];
  recentFoods: Food[];
}

const liveRows = <T extends { deletedAt: string | null }>(rows: readonly T[]): T[] => rows.filter((r) => r.deletedAt == null);

// ===================== training =====================

export interface TrainingRows {
  workouts: readonly Workout[];
  sets: readonly WorkoutSet[];
  phases: readonly FitnessPhase[];
}

export interface TrainingData {
  /** Live sessions, newest first (date, then id). */
  workouts: Workout[];
  /** Sets of live sessions, in session order. */
  sets: WorkoutSet[];
  /** Best lifts with the change since `since`. */
  lifts: LiftSummary[];
  /** Start of the running phase, or 28 days ago: what "since" means in the Strength card. */
  since: ISODate;
  phase: FitnessPhase | null;
  /** Exercise names, most used first, with the muscle last used for each. */
  exercises: { name: string; muscle: string }[];
}

export function buildTraining(today: ISODate, rows: TrainingRows): TrainingData {
  const workouts = liveRows(rows.workouts).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const ids = new Set(workouts.map((w) => w.id));
  const sets = liveRows(rows.sets)
    .filter((s) => ids.has(s.workoutId))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const phases = liveRows(rows.phases);
  const phase = activePhaseOn(phases, today);
  const since = phase?.startDate ?? addDays(today, -28);
  const dateOf = new Map(workouts.map((w) => [w.id, w.date] as const));
  const byName = new Map<string, { count: number; muscle: string; last: string }>();
  for (const s of sets) {
    const d = dateOf.get(s.workoutId) ?? "";
    const cur = byName.get(s.exercise);
    const newer = !cur || d >= cur.last;
    byName.set(s.exercise, { count: (cur?.count ?? 0) + 1, muscle: newer ? s.muscle : (cur?.muscle ?? s.muscle), last: newer ? d : (cur?.last ?? d) });
  }
  return {
    workouts,
    sets,
    lifts: bestLifts(workouts, sets, since),
    since,
    phase: phase ? (phases.find((p) => p.id === phase.id) ?? null) : null,
    exercises: [...byName].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).map(([name, v]) => ({ name, muscle: v.muscle })),
  };
}

export function buildFitnessDay(date: ISODate, rows: FitnessRows): FitnessDay {
  const bodyLogs = liveRows(rows.bodyLogs);
  const foods = liveRows(rows.foods).sort((a, b) => a.name.localeCompare(b.name));
  const foodLogs = liveRows(rows.foodLogs);
  const phases = liveRows(rows.phases);
  const { phase, trendKg, maintenance, targets } = targetsOn(date, {
    phases,
    bodyLogs,
    maintenanceWeeks: liveRows(rows.maintenanceWeeks),
    defaultMaintenance: rows.settings["fitness.maintenanceKcal"],
    fibreTargetG: rows.settings["fitness.fibreTargetG"],
  });
  const trend = trendWeight(bodyLogs.filter((b) => b.date <= date), date);
  const previous = bodyLogs.filter((b) => b.date < date && b.weightKg != null).sort((a, b) => b.date.localeCompare(a.date))[0];
  const byId = new Map(foods.map((f) => [f.id, f] as const));
  return {
    date,
    settings: rows.settings,
    phase: phase ? (phases.find((p) => p.id === phase.id) ?? null) : null,
    phaseText: phase ? phaseLabel(phase, date) : null,
    trendKg,
    weeklyRatePct: weeklyRatePct(trend, date),
    maintenance,
    targets,
    totals: dayTotals(foodLogs, date),
    body: bodyLogs.find((b) => b.date === date) ?? null,
    previousWeightKg: previous?.weightKg ?? null,
    recentTrend: trend.filter((p) => p.date > addDays(date, -14)),
    foods,
    logs: foodLogs.filter((l) => l.date === date).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
    yesterdayLogs: foodLogs.filter((l) => l.date === addDays(date, -1)),
    recentFoods: recentFoodIds(foodLogs, 8).flatMap((id) => byId.get(id) ?? []),
  };
}
