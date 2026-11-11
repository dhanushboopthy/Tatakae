import { useQuery } from "@tanstack/react-query";
import {
  buildFitnessDay,
  buildTraining,
  foodSnapshot,
  newId,
  readSettings,
  type BodyLog,
  type FitnessDay,
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
import { LOCAL, write } from "../sync/engine";

// Fitness on the phone (docs/plans/fitness.md §4): reads from the local SQLite store through core's pure
// builders (the same ones the website uses), writes through the outbox (optimistic, works offline).

const DAY_TABLES = ["body_logs", "foods", "food_logs", "fitness_phases", "maintenance_weeks", "settings"] as const;
const TRAINING_TABLES = ["workouts", "workout_sets", "fitness_phases"] as const;

export type { FitnessDay, TrainingData };

export function useFitnessDay(date: ISODate) {
  return useQuery({
    queryKey: [LOCAL, DAY_TABLES, "fitness-day", date],
    queryFn: async (): Promise<FitnessDay> => {
      const [bodyLogs, foods, foodLogs, phases, maintenanceWeeks, settingRows] = await Promise.all([
        store.getAll("body_logs"),
        store.getAll("foods"),
        store.getAll("food_logs"),
        store.getAll("fitness_phases"),
        store.getAll("maintenance_weeks"),
        store.getAll("settings"),
      ]);
      return buildFitnessDay(date, { settings: readSettings(settingRows), bodyLogs, foods, foodLogs, phases, maintenanceWeeks });
    },
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

export type BodyPatch = Partial<Pick<BodyLog, "weightKg" | "steps" | "waterMl" | "sleepMin" | "note">>;

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
    ...patch,
  });
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
