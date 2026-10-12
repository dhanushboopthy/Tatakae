import { MAX_ACTIVE_GOALS, type Goal } from "@tatakae/core";
import { liveRows } from "./crud";
import type { Db } from "./db";
import { BadRequest, Conflict } from "./errors";

// Cycle goals (docs/02): at most 4 active per 12-week cycle, and only goals that passed the hell-yeah
// gate can be active. Applied to REST writes (/goals) and to sync items alike.

export type GoalProblem = "hell_yeah_required" | "too_many_goals";

export function goalProblem(db: Db, next: Goal, prev: Goal | null): GoalProblem | null {
  if (next.deletedAt != null || next.status !== "active") return null;
  if (!next.hellYeah) return "hell_yeah_required";
  if (prev?.status === "active" && prev.deletedAt == null) return null;
  const active = liveRows(db, "goals").filter((g) => g.status === "active" && g.id !== next.id).length;
  return active >= MAX_ACTIVE_GOALS ? "too_many_goals" : null;
}

/** REST flavour: throws the matching HTTP error. */
export function assertGoal(db: Db, next: Goal, prev: Goal | null): void {
  const p = goalProblem(db, next, prev);
  if (p === "hell_yeah_required") throw new BadRequest("An active goal has to pass the hell-yeah gate.", p);
  if (p === "too_many_goals") throw new Conflict(`At most ${MAX_ACTIVE_GOALS} active goals per cycle. Pause or finish one first.`, p);
}
