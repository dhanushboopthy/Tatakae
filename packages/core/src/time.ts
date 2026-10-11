import type { ISODate } from "./types";

export const TZ = "Asia/Kolkata";
/** Day boundary: before 04:00 IST counts as the previous day. */
export const DAY_BOUNDARY_HOUR = 4;

export function todayIST(now: Date = new Date()): ISODate {
  // TODO(v1)
  throw new Error("not implemented");
}

export function addDays(date: ISODate, n: number): ISODate {
  // TODO(v1)
  throw new Error("not implemented");
}

export function isoWeek(date: ISODate): { year: number; week: number } {
  // TODO(v2)
  throw new Error("not implemented");
}

/** Scoring constants are editable only on even-ISO-week Sundays. */
export function canEditScoring(date: ISODate): boolean {
  // TODO(v2)
  throw new Error("not implemented");
}

export const CYCLE_1 = { start: "2026-10-12", end: "2027-01-03", maxGoals: 4 } as const;
