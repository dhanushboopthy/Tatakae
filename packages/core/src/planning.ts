import { RANKED_SLOTS, slotRank, type ForgeProblem } from "./schemas";
import { weekdayOf } from "./time";
import type { Anchor, ISODate, Mission, Slot } from "./types";

// Pure planning helpers shared by the website and the phone: ritual capacity, slots, if-then
// templates. No I/O, no React, no platform APIs (this package stays pure TS).

// ---------- capacity ----------

/** Minutes since 00:00 for "HH:MM" (NaN-safe: malformed → 0). */
export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** Anchors active on `date` (weekdays "0..6", 0 = Sunday; empty = every day). */
export function anchorsFor(anchors: readonly Anchor[], date: ISODate): Anchor[] {
  const wd = String(weekdayOf(date));
  return anchors
    .filter((a) => a.deletedAt == null)
    .filter((a) => a.weekdays.trim() === "" || a.weekdays.split(",").includes(wd))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Overlap in minutes of [s1, e1) and [s2, e2). */
function overlap(s1: number, e1: number, s2: number, e2: number): number {
  return Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
}

/**
 * Default free minutes for a day: the window from wake time to ritual time, minus the parts of
 * anchors (classes, internship, gym…) that fall inside it. Anchors that cross midnight are clipped.
 */
export function freeMinutes(input: { wakeTime: string; ritualTime: string; anchors: readonly Pick<Anchor, "startTime" | "endTime">[] }): number {
  const start = toMinutes(input.wakeTime);
  const end = toMinutes(input.ritualTime);
  if (end <= start) return 0;
  // Merge anchor intervals so overlapping anchors aren't subtracted twice.
  const spans = input.anchors
    .map((a) => {
      const s = toMinutes(a.startTime);
      const e = toMinutes(a.endTime);
      return [s, e > s ? e : 24 * 60] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  let busy = 0;
  let curS = -1;
  let curE = -1;
  for (const [s, e] of spans) {
    if (s > curE) {
      if (curE > curS) busy += overlap(curS, curE, start, end);
      curS = s;
      curE = e;
    } else curE = Math.max(curE, e);
  }
  if (curE > curS) busy += overlap(curS, curE, start, end);
  return Math.max(0, end - start - busy);
}

/** Planned minutes = Σ estMin of live, scored missions (side quests and rescheduled excluded). */
export function plannedMinutes(missions: readonly Pick<Mission, "estMin" | "slot" | "status" | "deletedAt">[]): number {
  return missions
    .filter((m) => m.deletedAt == null && m.slot !== "side" && m.status !== "rescheduled" && m.status !== "backlog")
    .reduce((sum, m) => sum + (m.estMin ?? 0), 0);
}

// ---------- missions and slots ----------

export type DaySlot = Exclude<Slot, "backlog">;

/** Day slots in order: P1…P9, then the side quest. */
export const SLOT_ORDER: readonly DaySlot[] = [...RANKED_SLOTS, "side"];
/** Where a mission moved onto a day lands when it has no slot yet: P2…P9, then the side quest. */
export const AFTER_P1: readonly DaySlot[] = SLOT_ORDER.slice(1);

/** Missions on a date, live, in slot order (P1…P9, side). Backlog-slot rows are excluded. */
export function missionsOn(missions: readonly Mission[], date: ISODate): Mission[] {
  return missions
    .filter((m) => m.deletedAt == null && m.dayDate === date && m.slot !== "backlog")
    .sort((a, b) => slotRank(a.slot) - slotRank(b.slot));
}

/** One mission per slot, preferring the one that wasn't rescheduled away. */
export function bySlot(missions: readonly Mission[]): Partial<Record<DaySlot, Mission>> {
  const out: Partial<Record<DaySlot, Mission>> = {};
  for (const m of missions) {
    if (m.slot === "backlog" || m.deletedAt != null) continue;
    const cur = out[m.slot];
    if (!cur || (cur.status === "rescheduled" && m.status !== "rescheduled")) out[m.slot] = m;
  }
  return out;
}

/** First free slot among `candidates` for a day's missions; null when all are taken. */
export function firstFreeSlot(missions: readonly Mission[], candidates: readonly Slot[]): Slot | null {
  const taken = bySlot(missions);
  for (const s of candidates) {
    if (s === "backlog") return s;
    const m = taken[s];
    if (!m || m.status === "rescheduled") return s;
  }
  return null;
}

/** If-then templates from history: distinct previous P1 if-then plans, most recent first. */
export function ifThenTemplates(missions: readonly Mission[], limit = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const p1s = missions
    .filter((m) => m.slot === "P1" && m.deletedAt == null && m.ifThen?.trim())
    .sort((a, b) => (b.dayDate ?? "").localeCompare(a.dayDate ?? "") || b.updatedAt.localeCompare(a.updatedAt));
  for (const m of p1s) {
    const t = (m.ifThen ?? "").trim();
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

/** What the plan lock reports when it refuses, in the words both apps show. */
export const FORGE_PROBLEM_COPY: Record<ForgeProblem, string> = {
  no_p1: "Pick a P1 first.",
  p1_missing_minimum: "P1 needs a Minimum version.",
  p1_missing_if_then: "P1 needs an if-then plan.",
  duplicate_slot: "Two missions share a slot. Keep one per slot.",
  too_many_side: "Keep one side quest.",
};
