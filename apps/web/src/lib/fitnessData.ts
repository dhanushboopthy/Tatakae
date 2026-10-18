import { useQuery } from "@tanstack/react-query";
import {
  activePhaseOn,
  addDays,
  appDayOf,
  bodyAverages,
  buildFitnessDay,
  formatIsoWeek,
  isoWeek,
  isoWeekRange,
  maintenanceRuns,
  monthRange,
  monthSummary,
  parseIsoWeek,
  phaseProgress,
  readSettings,
  targetsOn,
  trendWeight,
  weeklyCheckIn,
  weekSummary,
  type BodyLog,
  type DailyTargets,
  type FitnessDay,
  type FitnessPhase,
  type Food,
  type FoodLog,
  type ISODate,
  type MaintenanceResult,
  type MaintenanceRun,
  type MaintenanceWeek,
  type MonthSummary,
  type PhaseProgress,
  type ResolvedSettings,
  type SyncTable,
  type TrendPoint,
  type WeekSummary,
} from "@tatakae/core";
import { localKey, store } from "../sync/engine";

// Fitness reads: every number comes from @tatakae/core (fitness.ts) over the local IndexedDB rows.

export const FITNESS_TABLES: readonly SyncTable[] = ["body_logs", "foods", "food_logs", "fitness_phases", "maintenance_weeks", "settings"];

const live = <T extends { deletedAt: string | null }>(rows: readonly T[]): T[] => rows.filter((r) => r.deletedAt == null);

interface Rows {
  settings: ResolvedSettings;
  bodyLogs: BodyLog[];
  foods: Food[];
  foodLogs: FoodLog[];
  phases: FitnessPhase[];
  maintenanceWeeks: MaintenanceWeek[];
}

async function loadRows(): Promise<Rows> {
  const [bodyRows, foodRows, logRows, phaseRows, weekRows, settingRows] = await Promise.all([
    store.getAll("body_logs"),
    store.getAll("foods"),
    store.getAll("food_logs"),
    store.getAll("fitness_phases"),
    store.getAll("maintenance_weeks"),
    store.getAll("settings"),
  ]);
  return {
    settings: readSettings(settingRows),
    bodyLogs: live(bodyRows),
    foods: live(foodRows).sort((a, b) => a.name.localeCompare(b.name)),
    foodLogs: live(logRows),
    phases: live(phaseRows).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    maintenanceWeeks: live(weekRows),
  };
}

/** Targets of one date from the loaded rows (core `targetsOn` with the user's settings). */
function targetsFor(rows: Rows, date: ISODate) {
  return targetsOn(date, {
    phases: rows.phases,
    bodyLogs: rows.bodyLogs,
    maintenanceWeeks: rows.maintenanceWeeks,
    defaultMaintenance: rows.settings["fitness.maintenanceKcal"],
    fibreTargetG: rows.settings["fitness.fibreTargetG"],
  });
}

const summaryInput = (rows: Rows, today: ISODate) => ({
  foodLogs: rows.foodLogs,
  bodyLogs: rows.bodyLogs,
  maintenanceWeeks: rows.maintenanceWeeks,
  defaultMaintenance: rows.settings["fitness.maintenanceKcal"],
  today,
});

// ---------- Day ----------

export type { FitnessDay };

export function useFitnessDay(date: ISODate) {
  return useQuery({
    queryKey: localKey(FITNESS_TABLES, "fitness-day", date),
    queryFn: async (): Promise<FitnessDay> => buildFitnessDay(date, await loadRows()),
  });
}

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

export function useFitnessWeek(week: string, today: ISODate) {
  return useQuery({
    queryKey: localKey(FITNESS_TABLES, "fitness-week", week, today),
    queryFn: async (): Promise<FitnessWeek> => {
      const rows = await loadRows();
      const w = parseIsoWeek(week) ?? isoWeek(today);
      const key = formatIsoWeek(w);
      const { start, end } = isoWeekRange(w.year, w.week);
      const summary = weekSummary(key, summaryInput(rows, today));
      const asOf = end < today ? end : today;
      const at = targetsFor(rows, asOf);
      const dayTargets: Record<ISODate, number> = {};
      for (let d = start; d <= end; d = addDays(d, 1)) {
        const t = targetsFor(rows, d);
        dayTargets[d] = t.targets?.kcal ?? t.maintenance.kcal;
      }
      const row = rows.maintenanceWeeks.find((m) => m.isoWeek === key);
      return {
        summary,
        dayTargets,
        targets: at.targets,
        phase: at.phase ? (rows.phases.find((p) => p.id === at.phase?.id) ?? null) : null,
        checkIn: weeklyCheckIn(summary, at.phase?.ratePctPerWeek),
        trend: trendWeight(rows.bodyLogs, asOf).filter((p) => p.date >= start && p.date <= asOf),
        averages: bodyAverages(rows.bodyLogs, start, end),
        setOn: row ? appDayOf(row.updatedAt) : null,
        runs: maintenanceRuns(rows.maintenanceWeeks, formatIsoWeek(isoWeek(today))).slice(0, 5),
        currentWeek: formatIsoWeek(isoWeek(today)),
      };
    },
  });
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

export function useFitnessMonth(yyyymm: string, today: ISODate) {
  return useQuery({
    queryKey: localKey(FITNESS_TABLES, "fitness-month", yyyymm, today),
    queryFn: async (): Promise<FitnessMonth> => {
      const rows = await loadRows();
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
        trend: trendWeight(rows.bodyLogs, asOf).filter((p) => p.date >= start && p.date <= asOf),
        phase: activePhaseOn(rows.phases, asOf),
        atOrUnder: started.filter((d) => d.kcal != null && d.kcal <= d.target).length,
        over: started.filter((d) => d.kcal != null && d.kcal > d.target).length,
        notLogged: started.filter((d) => d.kcal == null).length,
        daysElapsed: started.length,
      };
    },
  });
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
}

export function useFitnessPhase(today: ISODate) {
  return useQuery({
    queryKey: localKey(FITNESS_TABLES, "fitness-phase", today),
    queryFn: async (): Promise<FitnessPhaseView> => {
      const rows = await loadRows();
      const at = targetsFor(rows, today);
      const active = at.phase ? (rows.phases.find((p) => p.id === at.phase?.id) ?? null) : null;
      const lastTwoWeeks = addDays(today, -14); // a brand-new phase still shows a line
      const from = active ? (active.startDate < lastTwoWeeks ? active.startDate : lastTwoWeeks) : addDays(today, -56);
      const endWeights: Record<string, number | null> = {};
      for (const p of rows.phases) {
        const through = p.endDate ?? today;
        const trend = trendWeight(rows.bodyLogs.filter((b) => b.date <= through), through);
        endWeights[p.id] = trend.length ? Math.round((trend[trend.length - 1]?.trendKg ?? 0) * 10) / 10 : null;
      }
      const latest = [...rows.bodyLogs].filter((b) => b.weightKg != null).sort((a, b) => b.date.localeCompare(a.date))[0];
      return {
        phases: rows.phases,
        active,
        progress: active ? phaseProgress(active, rows.bodyLogs, today) : null,
        trend: trendWeight(rows.bodyLogs, today).filter((p) => p.date >= from),
        trendKg: at.trendKg,
        maintenance: at.maintenance,
        targets: at.targets,
        runs: maintenanceRuns(rows.maintenanceWeeks, formatIsoWeek(isoWeek(today))).slice(0, 6),
        endWeights,
        latestWeightKg: latest?.weightKg ?? null,
        fibreTargetG: rows.settings["fitness.fibreTargetG"],
      };
    },
  });
}
