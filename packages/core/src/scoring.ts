import type { Day, DayScore, ISODate, Mark, Mission, ScoringSettings } from "./types";

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

/** The mission fields scoring needs. Soft-deleted missions (deletedAt set) are ignored. */
export type ScoredMission = Pick<Mission, "points" | "status" | "slot"> & { deletedAt?: string | null };

const live = <T extends { deletedAt?: string | null }>(ms: readonly T[]): T[] => ms.filter((m) => m.deletedAt == null);

/** Points for a mission; blank = 1. */
export function missionPoints(m: Pick<Mission, "points">): number {
  return m.points ?? 1;
}

/** Sum of points excluding rescheduled/backlog. */
export function plannedPoints(missions: readonly ScoredMission[]): number {
  return live(missions)
    .filter((m) => m.status !== "rescheduled" && m.status !== "backlog")
    .reduce((sum, m) => sum + missionPoints(m), 0);
}

/** done = full, minimum = half, missed/open = 0. */
export function earnedPoints(missions: readonly ScoredMission[]): number {
  return live(missions).reduce((sum, m) => {
    if (m.status === "done") return sum + missionPoints(m);
    if (m.status === "minimum") return sum + missionPoints(m) / 2;
    return sum;
  }, 0);
}

/** round(100 * earned / planned); 0 if planned == 0. */
export function execScore(planned: number, earned: number): number {
  return planned === 0 ? 0 : Math.round((100 * earned) / planned);
}

/** -5 per full 30 min over 120, capped at -20. Returns <= 0 (never -0). */
export function screenPenalty(screenMin: number | null, s: ScoringSettings = DEFAULT_SCORING): number {
  if (screenMin == null || s.screenStepMin <= 0) return 0;
  const steps = Math.floor(Math.max(0, screenMin - s.screenFreeMin) / s.screenStepMin);
  return 0 - Math.min(s.screenPenaltyCap, s.screenStepPenalty * steps);
}

/** +10 when yesterday was a missed day and today's P1 is done or minimum. */
export function comebackBonus(
  yesterdayMissed: boolean,
  missions: readonly ScoredMission[],
  s: ScoringSettings = DEFAULT_SCORING,
): number {
  if (!yesterdayMissed) return 0;
  const p1Hit = live(missions).some((m) => m.slot === "P1" && (m.status === "done" || m.status === "minimum"));
  return p1Hit ? s.comebackBonus : 0;
}

export function markFor(final: number, planned: number, s: ScoringSettings = DEFAULT_SCORING): Mark {
  if (planned === 0) return "Unplanned";
  if (final >= s.strongAt) return "Strong";
  if (final >= s.solidAt) return "Solid";
  return "Light";
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Full day score. Rest / write-off days return excluded: true (and are never missed days). */
export function scoreDay(
  day: Pick<Day, "kind" | "screenMin">,
  missions: readonly ScoredMission[],
  yesterdayMissed: boolean,
  s: ScoringSettings = DEFAULT_SCORING,
): DayScore {
  const planned = plannedPoints(missions);
  const earned = earnedPoints(missions);
  const exec = execScore(planned, earned);
  const penalty = screenPenalty(day.screenMin, s);
  const bonus = comebackBonus(yesterdayMissed, missions, s);
  const final = clamp(exec + penalty + bonus, 0, 100);
  const excluded = day.kind !== "normal";
  return {
    excluded,
    planned,
    earned,
    exec,
    penalty,
    bonus,
    final,
    mark: markFor(final, planned, s),
    missedDay: !excluded && (planned === 0 || exec < s.missedExecBelow),
  };
}

/**
 * Missed-day rule for any date (shared design):
 * - with a day row or missions → `kind == normal && (planned == 0 || exec < 25)`;
 * - with neither → missed only when `firstUseDate <= date < today` (before first use / today / future is not missed).
 */
export function isMissedDay(
  date: ISODate,
  day: Pick<Day, "kind"> | null,
  missions: readonly ScoredMission[],
  ctx: { firstUseDate: ISODate | null; today: ISODate },
  s: ScoringSettings = DEFAULT_SCORING,
): boolean {
  const ms = live(missions);
  if (!day && ms.length === 0) {
    return ctx.firstUseDate != null && date >= ctx.firstUseDate && date < ctx.today;
  }
  if ((day?.kind ?? "normal") !== "normal") return false;
  const planned = plannedPoints(ms);
  return planned === 0 || execScore(planned, earnedPoints(ms)) < s.missedExecBelow;
}

/** First-use date = earliest `days.date` seen (ignores soft-deleted rows); null if none. */
export function firstUseDate(days: readonly (Pick<Day, "date"> & { deletedAt?: string | null })[]): ISODate | null {
  let first: ISODate | null = null;
  for (const d of live(days)) if (first === null || d.date < first) first = d.date;
  return first;
}

/** Average of non-excluded finals, rounded to an integer; null if none. */
export function averageScore(scores: readonly DayScore[]): number | null {
  const counted = scores.filter((sc) => !sc.excluded);
  if (counted.length === 0) return null;
  return Math.round(counted.reduce((sum, sc) => sum + sc.final, 0) / counted.length);
}

/**
 * Hara Hachi Bu: planned minutes vs 80 % of free minutes.
 * ratio = planned / budget (1 = exactly at budget); Infinity when there is no budget but work is planned.
 */
export function capacityCheck(
  plannedMin: number,
  freeMin: number,
  s: ScoringSettings = DEFAULT_SCORING,
): { ratio: number; overCapacity: boolean; budgetMin: number } {
  const budgetMin = Math.max(0, Math.floor(freeMin * s.capacityRatio));
  const ratio = budgetMin > 0 ? plannedMin / budgetMin : plannedMin > 0 ? Infinity : 0;
  return { ratio, overCapacity: plannedMin > budgetMin, budgetMin };
}

/** Cumulative "days shown up": non-excluded days that are not missed. Never resets. */
export function daysShownUp(scores: readonly DayScore[]): number {
  return scores.filter((sc) => !sc.excluded && !sc.missedDay).length;
}

/**
 * Parse the `scoring` settings value (JSON string or object) merged over DEFAULT_SCORING.
 * Unknown keys are dropped; non-finite or negative numbers fall back to the default.
 */
export function scoringFromSettings(value: unknown): ScoringSettings {
  let obj: unknown = value;
  if (typeof value === "string") {
    try {
      obj = JSON.parse(value);
    } catch {
      obj = null;
    }
  }
  const out: ScoringSettings = { ...DEFAULT_SCORING };
  if (typeof obj !== "object" || obj === null) return out;
  const rec = obj as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SCORING) as (keyof ScoringSettings)[]) {
    const v = rec[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[key] = v;
  }
  return out;
}
