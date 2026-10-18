import type { ISODate } from "@tatakae/core";
import { istInstant } from "../notifications/plan";

// Pure parts of screen minutes (v2.5), kept apart from the native module so they can be tested.

/** One foreground / background change of an app, from Android's usage events. */
export interface UsageEvent {
  pkg: string;
  kind: "fg" | "bg";
  /** ms since epoch */
  t: number;
}

const DAY_MS = 86_400_000;

/** The TATAKAE day `date` runs 04:00 IST to 04:00 IST the next morning; cut off at `now`. */
export function dayWindow(date: ISODate, now: number): { start: number; end: number } {
  const start = istInstant(date, "04:00").getTime();
  return { start, end: Math.max(start, Math.min(now, start + DAY_MS)) };
}

/**
 * Whole minutes the chosen apps were in the foreground between `start` and `end`.
 * An app already open at `start` (its first event is "bg") counts from `start`; one still open at
 * `end` counts until `end`. A second "fg" while open, or a "bg" while closed, changes nothing.
 */
export function foregroundMinutes(events: readonly UsageEvent[], start: number, end: number): number {
  const open = new Map<string, number>();
  const seen = new Set<string>();
  let ms = 0;
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    const t = Math.min(Math.max(e.t, start), end);
    if (e.kind === "fg") {
      if (!open.has(e.pkg)) open.set(e.pkg, t);
    } else {
      const from = open.get(e.pkg) ?? (seen.has(e.pkg) ? null : start);
      if (from != null) ms += t - from;
      open.delete(e.pkg);
    }
    seen.add(e.pkg);
  }
  for (const from of open.values()) ms += end - from;
  return Math.round(ms / 60_000);
}

/** The chosen apps, stored per phone as a JSON list of package names. Bad data reads as none. */
export function parseChosenApps(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))] : [];
  } catch {
    return [];
  }
}
