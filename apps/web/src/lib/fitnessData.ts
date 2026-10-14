import { useQuery } from "@tanstack/react-query";
import {
  PHASE_DEFAULTS,
  activePhaseOn,
  addDays,
  dailyTargets,
  dayTotals,
  maintenanceFor,
  phaseLabel,
  readSettings,
  recentFoodIds,
  trendNow,
  trendWeight,
  weeklyRatePct,
  type BodyLog,
  type DailyTargets,
  type DayTotals,
  type FitnessPhase,
  type Food,
  type FoodLog,
  type ISODate,
  type MaintenanceResult,
  type ResolvedSettings,
  type SyncTable,
  type TrendPoint,
} from "@tatakae/core";
import { localKey, store } from "../sync/engine";

// Fitness reads: every number comes from @tatakae/core (fitness.ts) over the local IndexedDB rows.

export const FITNESS_TABLES: readonly SyncTable[] = ["body_logs", "foods", "food_logs", "fitness_phases", "maintenance_weeks", "settings"];

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

const live = <T extends { deletedAt: string | null }>(rows: readonly T[]): T[] => rows.filter((r) => r.deletedAt == null);

export function useFitnessDay(date: ISODate) {
  return useQuery({
    queryKey: localKey(FITNESS_TABLES, "fitness-day", date),
    queryFn: async (): Promise<FitnessDay> => {
      const [bodyRows, foodRows, logRows, phaseRows, weekRows, settingRows] = await Promise.all([
        store.getAll("body_logs"),
        store.getAll("foods"),
        store.getAll("food_logs"),
        store.getAll("fitness_phases"),
        store.getAll("maintenance_weeks"),
        store.getAll("settings"),
      ]);
      const settings = readSettings(settingRows);
      const foods = live(foodRows).sort((a, b) => a.name.localeCompare(b.name));
      const logs = live(logRows);
      const phase = activePhaseOn(phaseRows, date);
      const trendKg = trendNow(bodyRows, date) ?? phase?.startWeightKg ?? null;
      const maintenance = maintenanceFor(weekRows, date, settings["fitness.maintenanceKcal"]);
      const targets =
        trendKg == null
          ? null
          : dailyTargets({
              phase: phase ?? { kind: "recomp", ...PHASE_DEFAULTS.recomp },
              maintenance: maintenance.kcal,
              trendKg,
              fibreTargetG: settings["fitness.fibreTargetG"],
            });
      const trend = trendWeight(bodyRows.filter((b) => b.date <= date), date);
      const body = live(bodyRows).find((b) => b.date === date) ?? null;
      const previous = live(bodyRows)
        .filter((b) => b.date < date && b.weightKg != null)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const byId = new Map(foods.map((f) => [f.id, f] as const));
      return {
        date,
        settings,
        phase,
        phaseText: phase ? phaseLabel(phase, date) : null,
        trendKg,
        weeklyRatePct: weeklyRatePct(trend, date),
        maintenance,
        targets,
        totals: dayTotals(logs, date),
        body,
        previousWeightKg: previous?.weightKg ?? null,
        recentTrend: trend.filter((p) => p.date > addDays(date, -14)),
        foods,
        logs: logs.filter((l) => l.date === date).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
        yesterdayLogs: logs.filter((l) => l.date === addDays(date, -1)),
        recentFoods: recentFoodIds(logs, 8).flatMap((id) => byId.get(id) ?? []),
      };
    },
  });
}
