import { weekdayOf, type Anchor, type Day, type ISODate, type Mission, type Slot } from "@tatakae/core";

// Pure helpers for web screens (routing, ritual capacity, templates, timers). No I/O, no React,
// so they are unit-tested in plan.test.ts. Scoring/time rules themselves come from @tatakae/core.

export type HomeTarget = "/welcome-back" | "/today";

/**
 * Home routing (shared design, web flavour): missed yesterday and nothing started today → Welcome back
 * (once per day). Morning is phone-only and ritual time shows a banner on Today instead of redirecting.
 */
export function decideHome(input: { yesterdayMissed: boolean; todayStarted: boolean; welcomeBackSeen: boolean }): HomeTarget {
  if (input.yesterdayMissed && !input.todayStarted && !input.welcomeBackSeen) return "/welcome-back";
  return "/today";
}

/** Today counts as started once a plan is locked for it or any mission left "open". */
export function isDayStarted(day: Pick<Day, "forgedAt"> | null, missions: readonly Pick<Mission, "status">[]): boolean {
  if (day?.forgedAt) return true;
  return missions.some((m) => m.status !== "open" && m.status !== "backlog");
}

/** After ritual time (or in the small hours before the 04:00 boundary) and tomorrow isn't locked yet. */
export function shouldPromptRitual(input: { nowHHMM: string; ritualTime: string; tomorrowForged: boolean }): boolean {
  if (input.tomorrowForged) return false;
  return input.nowHHMM >= input.ritualTime || input.nowHHMM < "04:00";
}

/** A day's score is shown only once the day is closed: it is in the past or tomorrow is already locked. */
export function isDayClosed(date: ISODate, today: ISODate, nextDayForged: boolean): boolean {
  return date < today || nextDayForged;
}

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

// ---------- missions ----------

export const SLOT_ORDER: readonly Slot[] = ["P1", "P2", "P3", "side"];

/** Missions on a date, live, in slot order (P1, P2, P3, side). Backlog-slot rows are excluded. */
export function missionsOn(missions: readonly Mission[], date: ISODate): Mission[] {
  return missions
    .filter((m) => m.deletedAt == null && m.dayDate === date && m.slot !== "backlog")
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
}

/** One mission per slot, preferring the one that wasn't rescheduled away. */
export function bySlot(missions: readonly Mission[]): Partial<Record<Exclude<Slot, "backlog">, Mission>> {
  const out: Partial<Record<Exclude<Slot, "backlog">, Mission>> = {};
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

/** Write-off days already used in a month ("YYYY-MM"). */
export function writeOffsUsed(days: readonly Pick<Day, "date" | "kind" | "deletedAt">[], month: string): number {
  return days.filter((d) => d.deletedAt == null && d.kind === "write_off" && d.date.startsWith(month)).length;
}

// ---------- focus timer ----------

/** Remaining milliseconds of a block started at `startedAt` (derived from start time, never ticked). */
export function focusRemainingMs(startedAt: string, lengthMin: number, now: Date): number {
  const end = Date.parse(startedAt) + lengthMin * 60_000;
  return Math.max(0, end - now.getTime());
}

/** "mm:ss" (or "h:mm:ss" past an hour), rounding up so 0:00 means done. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Whole minutes elapsed since `startedAt`, at least 1 (for actualMin). */
export function elapsedMinutes(startedAt: string, now: Date): number {
  return Math.max(1, Math.round((now.getTime() - Date.parse(startedAt)) / 60_000));
}
