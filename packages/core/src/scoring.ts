import type { Day, DayScore, Mark, Mission, ScoringSettings } from "./types";

// Implements docs/02-method.md (Scoring) exactly. Pure functions only — no I/O.

export const DEFAULT_SCORING: ScoringSettings = {
  screenFreeMin: 120,
  screenStepMin: 30,
  screenStepPenalty: 5,
  screenPenaltyCap: 20,
  comebackBonus: 10,
  strongAt: 80,
  solidAt: 50,
  missedExecBelow: 25,
  capacityRatio: 0.8,
  writeOffsPerMonth: 2,
};

/** Points for a mission; blank = 1. */
export function missionPoints(m: Pick<Mission, "points">): number {
  // TODO(v1)
  throw new Error("not implemented");
}

/** Sum of points excluding rescheduled/backlog. */
export function plannedPoints(missions: Mission[]): number {
  // TODO(v1)
  throw new Error("not implemented");
}

/** done = full, minimum = half, missed/open = 0. */
export function earnedPoints(missions: Mission[]): number {
  // TODO(v1)
  throw new Error("not implemented");
}

/** round(100 * earned / planned); 0 if planned == 0. */
export function execScore(planned: number, earned: number): number {
  // TODO(v1)
  throw new Error("not implemented");
}

/** -5 per full 30 min over 120, capped at -20. Returns <= 0. */
export function screenPenalty(screenMin: number | null, s: ScoringSettings = DEFAULT_SCORING): number {
  // TODO(v1)
  throw new Error("not implemented");
}

/** +10 when yesterday was a missed day and today's P1 is done or minimum. */
export function comebackBonus(yesterdayMissed: boolean, missions: Mission[], s: ScoringSettings = DEFAULT_SCORING): number {
  // TODO(v1)
  throw new Error("not implemented");
}

export function markFor(final: number, planned: number, s: ScoringSettings = DEFAULT_SCORING): Mark {
  // TODO(v1)
  throw new Error("not implemented");
}

/** Full day score. Rest / write-off days return excluded: true. */
export function scoreDay(
  day: Pick<Day, "kind" | "screenMin">,
  missions: Mission[],
  yesterdayMissed: boolean,
  s: ScoringSettings = DEFAULT_SCORING,
): DayScore {
  // TODO(v1)
  throw new Error("not implemented");
}

/** Average of non-excluded finals; null if none. */
export function averageScore(scores: DayScore[]): number | null {
  // TODO(v2)
  throw new Error("not implemented");
}

/** Hara Hachi Bu: planned minutes vs 80% of free minutes. */
export function capacityCheck(plannedMin: number, freeMin: number, s: ScoringSettings = DEFAULT_SCORING): {
  ratio: number;
  overCapacity: boolean;
} {
  // TODO(v1)
  throw new Error("not implemented");
}

/** Cumulative "days shown up" — never resets. */
export function daysShownUp(scores: DayScore[]): number {
  // TODO(v1)
  throw new Error("not implemented");
}
