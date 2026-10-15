import { useQuery } from "@tanstack/react-query";
import {
  activePhaseOn,
  addDays,
  bestLifts,
  type FitnessPhase,
  type ISODate,
  type LiftSummary,
  type SyncTable,
  type Workout,
  type WorkoutSet,
} from "@tatakae/core";
import { localKey, store } from "../sync/engine";

// Training reads (Fitness → Training tab). Maths (e1RM, best lifts, sets per muscle, last time) is in core.

export const TRAINING_TABLES: readonly SyncTable[] = ["workouts", "workout_sets", "fitness_phases"];

const live = <T extends { deletedAt: string | null }>(rows: readonly T[]): T[] => rows.filter((r) => r.deletedAt == null);

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

export function useTraining(today: ISODate) {
  return useQuery({
    queryKey: localKey(TRAINING_TABLES, "training", today),
    queryFn: async (): Promise<TrainingData> => {
      const [workoutRows, setRows, phaseRows] = await Promise.all([store.getAll("workouts"), store.getAll("workout_sets"), store.getAll("fitness_phases")]);
      const workouts = live(workoutRows).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
      const ids = new Set(workouts.map((w) => w.id));
      const sets = live(setRows)
        .filter((s) => ids.has(s.workoutId))
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      const phases = live(phaseRows);
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
    },
  });
}
