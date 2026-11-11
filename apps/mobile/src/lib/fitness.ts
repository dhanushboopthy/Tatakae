import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  buildFitnessDay,
  buildFitnessMonth,
  buildFitnessPhase,
  buildFitnessWeek,
  buildTraining,
  checkPhaseStart,
  foodSnapshot,
  newId,
  readSettings,
  type BodyLog,
  type PhaseStartCheck,
  type FitnessDay,
  type FitnessMonth,
  type FitnessPhase,
  type FitnessPhaseView,
  type FitnessRows,
  type FitnessWeek,
  type PhaseKind,
  type Food,
  type FoodLog,
  type ISODate,
  type MealSlot,
  type Micros,
  type TrainingData,
  type Workout,
  type WorkoutSet,
} from "@tatakae/core";
import { sqliteStore as store } from "../sync/outbox";
import { LOCAL, remove, write } from "../sync/engine";
import { saveSetting } from "./hooks";

// Fitness on the phone (docs/plans/fitness.md §4): reads from the local SQLite store through core's pure
// builders (the same ones the website uses), writes through the outbox (optimistic, works offline).

const DAY_TABLES = ["body_logs", "foods", "food_logs", "fitness_phases", "maintenance_weeks", "settings"] as const;
const TRAINING_TABLES = ["workouts", "workout_sets", "fitness_phases"] as const;

export type { FitnessDay, FitnessMonth, FitnessPhaseView, FitnessWeek, TrainingData };

const live = <T extends { deletedAt: string | null }>(rows: readonly T[]): T[] => rows.filter((r) => r.deletedAt == null);

async function loadRows(): Promise<FitnessRows> {
  const [bodyLogs, foods, foodLogs, phases, maintenanceWeeks, settingRows] = await Promise.all([
    store.getAll("body_logs"),
    store.getAll("foods"),
    store.getAll("food_logs"),
    store.getAll("fitness_phases"),
    store.getAll("maintenance_weeks"),
    store.getAll("settings"),
  ]);
  return {
    settings: readSettings(settingRows),
    bodyLogs: live(bodyLogs),
    foods: live(foods).sort((a, b) => a.name.localeCompare(b.name)),
    foodLogs: live(foodLogs),
    phases: live(phases).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    maintenanceWeeks: live(maintenanceWeeks),
  };
}

export function useFitnessDay(date: ISODate) {
  return useQuery({
    queryKey: [LOCAL, DAY_TABLES, "fitness-day", date],
    queryFn: async (): Promise<FitnessDay> => buildFitnessDay(date, await loadRows()),
  });
}

export function useFitnessWeek(week: string, today: ISODate) {
  return useQuery({
    queryKey: [LOCAL, DAY_TABLES, "fitness-week", week, today],
    queryFn: async (): Promise<FitnessWeek> => buildFitnessWeek(await loadRows(), week, today),
  });
}

export function useFitnessMonth(yyyymm: string, today: ISODate) {
  return useQuery({
    queryKey: [LOCAL, DAY_TABLES, "fitness-month", yyyymm, today],
    queryFn: async (): Promise<FitnessMonth> => buildFitnessMonth(await loadRows(), yyyymm, today),
  });
}

export function useFitnessPhase(today: ISODate) {
  return useQuery({
    queryKey: [LOCAL, DAY_TABLES, "fitness-phase", today],
    queryFn: async (): Promise<FitnessPhaseView> => buildFitnessPhase(await loadRows(), today),
  });
}

/** Saved foods (the library), favourites first then by name. */
export function useFoodLibrary() {
  return useQuery({
    queryKey: [LOCAL, ["foods"], "food-library"],
    queryFn: async (): Promise<Food[]> => [...(await loadRows()).foods].sort((a, b) => Number(b.favourite) - Number(a.favourite) || a.name.localeCompare(b.name)),
  });
}

export function useTraining(today: ISODate) {
  return useQuery({
    queryKey: [LOCAL, TRAINING_TABLES, "training", today],
    queryFn: async (): Promise<TrainingData> => {
      const [workouts, sets, phases] = await Promise.all([store.getAll("workouts"), store.getAll("workout_sets"), store.getAll("fitness_phases")]);
      return buildTraining(today, { workouts, sets, phases });
    },
  });
}

// ---------- body ----------

export type BodyPatch = Partial<Pick<BodyLog, "weightKg" | "steps" | "waterMl" | "sleepMin" | "note" | "kcalOverride">>;

/** Merge a patch into the day's body log (one row per date). */
export async function logBody(date: ISODate, patch: BodyPatch): Promise<BodyLog> {
  const prev = await store.get("body_logs", date);
  const base = prev && prev.deletedAt == null ? prev : null;
  return write("body_logs", {
    id: prev?.id ?? newId(),
    date,
    weightKg: base?.weightKg ?? null,
    steps: base?.steps ?? null,
    waterMl: base?.waterMl ?? null,
    sleepMin: base?.sleepMin ?? null,
    note: base?.note ?? null,
    kcalOverride: base?.kcalOverride ?? null,
    ...patch,
  });
}

/** Type in the calories target for one day (null = back to the calculated or standing target). */
export async function setKcalOverride(date: ISODate, kcal: number | null): Promise<void> {
  await logBody(date, { kcalOverride: kcal == null ? null : Math.round(kcal) });
}

/** The standing calories target from `from` onward (null = calculated again). */
export async function setManualKcal(value: { kcal: number; from: ISODate } | null): Promise<void> {
  await saveSetting("fitness.manualKcal", value == null ? null : { kcal: Math.round(value.kcal), from: value.from });
}

export type PhaseStartProblem = Extract<PhaseStartCheck, { ok: false }>["reason"] | "missing";

/**
 * Move a phase's start date (core `checkPhaseStart`). The phase before it, which normally ended the day
 * before, now ends the day before the new start. Returns the problem, or null when it worked.
 */
export async function changePhaseStart(phaseId: string, startDate: ISODate, today: ISODate): Promise<PhaseStartProblem | null> {
  const phases = (await store.getAll("fitness_phases")).filter((p) => p.deletedAt == null);
  const phase = phases.find((p) => p.id === phaseId);
  if (!phase) return "missing";
  if (startDate === phase.startDate) return null;
  const check = checkPhaseStart(phases, phase, startDate, today);
  if (!check.ok) return check.reason;
  if (check.prevEnd) {
    const prev = phases.find((p) => p.id === check.prevEnd?.id);
    if (prev) await write("fitness_phases", { ...prev, endDate: check.prevEnd.endDate });
  }
  await write("fitness_phases", { ...phase, startDate });
  return null;
}

/** +250 ml style tap: adds to whatever is already logged today. */
export async function addWater(date: ISODate, ml: number): Promise<BodyLog> {
  const prev = await store.get("body_logs", date);
  const current = prev && prev.deletedAt == null ? (prev.waterMl ?? 0) : 0;
  return logBody(date, { waterMl: current + ml });
}

// ---------- food ----------

/** One tap logs one serving of a saved food (nutrients copied as a snapshot). */
export async function logFood(input: { date: ISODate; meal: MealSlot; food: Food; servings?: number }): Promise<FoodLog> {
  const { food } = input;
  return write("food_logs", {
    id: newId(),
    date: input.date,
    meal: input.meal,
    foodId: food.id,
    name: food.name,
    servings: input.servings ?? 1,
    ...foodSnapshot(food),
  });
}

export interface NewFood {
  name: string;
  servingLabel: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number | null;
  micros?: Micros;
}

/** Save a food entered by hand (reusable next time). */
export async function saveFood(f: NewFood): Promise<Food> {
  return write("foods", {
    id: newId(),
    name: f.name.trim(),
    servingLabel: f.servingLabel.trim() || "1 serving",
    servingG: null,
    kcal: f.kcal,
    proteinG: f.proteinG,
    carbsG: f.carbsG,
    fatG: f.fatG,
    fibreG: f.fibreG,
    micros: f.micros ?? {},
    favourite: false,
  });
}

/** Copy logs (one meal) onto another date as new entries. Returns how many were copied. */
export async function copyFoodLogs(logs: readonly FoodLog[], toDate: ISODate, meal: MealSlot): Promise<number> {
  const rows = logs.filter((l) => l.deletedAt == null && l.meal === meal);
  for (const l of rows) {
    const { updatedAt: _u, deletedAt: _d, ...rest } = l;
    await write("food_logs", { ...rest, id: newId(), date: toDate, micros: { ...l.micros } });
  }
  return rows.length;
}

// ---------- training ----------

export async function startWorkout(date: ISODate, name: string): Promise<Workout> {
  return write("workouts", { id: newId(), date, name: name.trim(), durationMin: null, note: null });
}

export async function finishWorkout(workout: Workout, durationMin: number | null): Promise<void> {
  await write("workouts", { ...workout, durationMin });
}

export async function logSet(input: { workoutId: string; exercise: string; muscle: string; reps: number; kg: number; order: number }): Promise<WorkoutSet> {
  return write("workout_sets", { id: newId(), ...input, exercise: input.exercise.trim(), rpe: null });
}

/** Delete a session and its sets (soft delete through the outbox). */
export async function removeWorkout(workout: Pick<Workout, "id">, sets: readonly Pick<WorkoutSet, "id">[]): Promise<void> {
  for (const s of sets) await remove("workout_sets", s.id);
  await remove("workouts", workout.id);
}

export async function removeSet(id: string): Promise<void> {
  await remove("workout_sets", id);
}

// ---------- maintenance and phases ----------

/** Set (or change) the maintenance for an ISO week. One row per week; later weeks carry it forward until changed. */
export async function setMaintenance(isoWeek: string, kcal: number, note: string | null = null): Promise<void> {
  const prev = await store.get("maintenance_weeks", isoWeek);
  await write("maintenance_weeks", { id: prev?.id ?? newId(), isoWeek, kcal: Math.round(kcal), note });
}

export interface PhaseInput {
  kind: PhaseKind;
  ratePctPerWeek: number;
  proteinGPerKg: number;
  fatGPerKg: number;
  startWeightKg: number;
  startDate: ISODate;
  note?: string | null;
}

/**
 * Start a phase. A phase that is still running ends the day before (or is removed when the new one starts on the
 * same day, so two phases never share a start date).
 */
export async function startPhase(input: PhaseInput, current: FitnessPhase | null): Promise<FitnessPhase> {
  if (current && current.endDate == null) {
    if (current.startDate >= input.startDate) await remove("fitness_phases", current.id);
    else await write("fitness_phases", { ...current, endDate: addDays(input.startDate, -1) });
  }
  return write("fitness_phases", { ...input, id: newId(), endDate: null, note: input.note ?? null });
}

/** Edit the numbers of a phase (type, rate, protein, fat). Past days keep using whatever phase was active then. */
export async function savePhase(phase: FitnessPhase, patch: Partial<Pick<FitnessPhase, "kind" | "ratePctPerWeek" | "proteinGPerKg" | "fatGPerKg" | "note">>): Promise<void> {
  await write("fitness_phases", { ...phase, ...patch });
}

export async function endPhase(phase: FitnessPhase, endDate: ISODate): Promise<void> {
  await write("fitness_phases", { ...phase, endDate: endDate < phase.startDate ? phase.startDate : endDate });
}

// ---------- food library ----------

export async function setFoodFavourite(food: Food, favourite: boolean): Promise<void> {
  await write("foods", { ...food, favourite });
}

/** Edit a saved food. Logs already made keep their own snapshot of the nutrients. */
export async function updateFood(food: Food, patch: Partial<Pick<Food, "name" | "servingLabel" | "kcal" | "proteinG" | "carbsG" | "fatG" | "fibreG">>): Promise<void> {
  await write("foods", { ...food, ...patch, name: (patch.name ?? food.name).trim() });
}

export async function removeFood(id: string): Promise<void> {
  await remove("foods", id);
}
