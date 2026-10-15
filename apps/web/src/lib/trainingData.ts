import { useQuery } from "@tanstack/react-query";
import { buildTraining, type ISODate, type SyncTable, type TrainingData } from "@tatakae/core";
import { localKey, store } from "../sync/engine";

// Training reads (Fitness → Training tab). The composition and maths are in core (fitnessDay.ts, fitness.ts).

export const TRAINING_TABLES: readonly SyncTable[] = ["workouts", "workout_sets", "fitness_phases"];

export type { TrainingData };

export function useTraining(today: ISODate) {
  return useQuery({
    queryKey: localKey(TRAINING_TABLES, "training", today),
    queryFn: async (): Promise<TrainingData> => {
      const [workouts, sets, phases] = await Promise.all([store.getAll("workouts"), store.getAll("workout_sets"), store.getAll("fitness_phases")]);
      return buildTraining(today, { workouts, sets, phases });
    },
  });
}
