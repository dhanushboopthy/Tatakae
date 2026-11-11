import { useQuery } from "@tanstack/react-query";
import {
  buildFitnessDay,
  buildFitnessMonth,
  buildFitnessPhase,
  buildFitnessWeek,
  readSettings,
  type FitnessDay,
  type FitnessMonth,
  type FitnessMonthDay,
  type FitnessPhaseView,
  type FitnessRows,
  type FitnessWeek,
  type ISODate,
  type SyncTable,
} from "@tatakae/core";
import { localKey, store } from "../sync/engine";

// Fitness reads: every number comes from @tatakae/core (fitness.ts, fitnessDay.ts, fitnessViews.ts) over the local
// IndexedDB rows. The phone builds the same views from the same functions.

export const FITNESS_TABLES: readonly SyncTable[] = ["body_logs", "foods", "food_logs", "fitness_phases", "maintenance_weeks", "settings"];

const live = <T extends { deletedAt: string | null }>(rows: readonly T[]): T[] => rows.filter((r) => r.deletedAt == null);

async function loadRows(): Promise<FitnessRows> {
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

export type { FitnessDay, FitnessMonth, FitnessMonthDay, FitnessPhaseView, FitnessWeek };

export function useFitnessDay(date: ISODate) {
  return useQuery({
    queryKey: localKey(FITNESS_TABLES, "fitness-day", date),
    queryFn: async (): Promise<FitnessDay> => buildFitnessDay(date, await loadRows()),
  });
}

export function useFitnessWeek(week: string, today: ISODate) {
  return useQuery({
    queryKey: localKey(FITNESS_TABLES, "fitness-week", week, today),
    queryFn: async (): Promise<FitnessWeek> => buildFitnessWeek(await loadRows(), week, today),
  });
}

export function useFitnessMonth(yyyymm: string, today: ISODate) {
  return useQuery({
    queryKey: localKey(FITNESS_TABLES, "fitness-month", yyyymm, today),
    queryFn: async (): Promise<FitnessMonth> => buildFitnessMonth(await loadRows(), yyyymm, today),
  });
}

export function useFitnessPhase(today: ISODate) {
  return useQuery({
    queryKey: localKey(FITNESS_TABLES, "fitness-phase", today),
    queryFn: async (): Promise<FitnessPhaseView> => buildFitnessPhase(await loadRows(), today),
  });
}
