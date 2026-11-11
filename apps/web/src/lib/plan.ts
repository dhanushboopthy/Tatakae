import { FOCUS_MAX, FOCUS_MIN, RANKED_SLOTS, slotRank, weekdayOf, type Anchor, type Day, type ISODate, type Mission, type Slot } from "@tatakae/core";

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

// ---------- capacity and missions ----------
// Shared with the phone app, so they live in @tatakae/core (planning.ts) and are tested there.
export {
  AFTER_P1,
  SLOT_ORDER,
  anchorsFor,
  bySlot,
  firstFreeSlot,
  freeMinutes,
  ifThenTemplates,
  missionsOn,
  plannedMinutes,
  toMinutes,
  type DaySlot,
} from "@tatakae/core";

/** Write-off days already used in a month ("YYYY-MM"). */
export function writeOffsUsed(days: readonly Pick<Day, "date" | "kind" | "deletedAt">[], month: string): number {
  return days.filter((d) => d.deletedAt == null && d.kind === "write_off" && d.date.startsWith(month)).length;
}

// ---------- week planner ----------

export const RAIL = { startMin: 6 * 60, endMin: 24 * 60 } as const;

/** Minutes since IST midnight (wall clock) for an ISO timestamp. IST is a fixed +05:30. */
export function istMinutesOf(iso: string): number {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 0;
  const minutes = Math.floor((ms + 330 * 60_000) / 60_000);
  return ((minutes % 1440) + 1440) % 1440;
}

/**
 * Vertical placement of a block on the rail as fractions (0..1) of the rail height, clipped to the rail.
 * Blocks before 04:00 (next calendar day, same app day) are placed after midnight, so they clip at the end.
 * Returns null when nothing of the block is visible.
 */
export function railSpan(startMin: number, durationMin: number, rail: { startMin: number; endMin: number } = RAIL): { top: number; height: number } | null {
  const s = startMin < 4 * 60 ? startMin + 1440 : startMin;
  const e = s + Math.max(1, durationMin);
  const a = Math.max(rail.startMin, s);
  const b = Math.min(rail.endMin, e);
  if (b <= a) return null;
  const len = rail.endMin - rail.startMin;
  return { top: (a - rail.startMin) / len, height: (b - a) / len };
}

/** "HH:MM" for minutes since midnight (wraps at 24 h). */
export function hhmmOf(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Snap a rail position (0..1) to a start time on a `step`-minute grid. */
export function railTimeAt(fraction: number, step = 15, rail: { startMin: number; endMin: number } = RAIL): string {
  const len = rail.endMin - rail.startMin;
  const raw = rail.startMin + Math.max(0, Math.min(1, fraction)) * len;
  const snapped = Math.min(rail.endMin - step, Math.round(raw / step) * step);
  return hhmmOf(snapped);
}

type Rail = { startMin: number; endMin: number };

/** Minutes since midnight for a rail position (0..1), snapped to `step` and kept on the rail. */
export function railMinutesAt(fraction: number, step = 15, rail: Rail = RAIL): number {
  const raw = rail.startMin + Math.max(0, Math.min(1, fraction)) * (rail.endMin - rail.startMin);
  return Math.max(rail.startMin, Math.min(rail.endMin, Math.round(raw / step) * step));
}

/**
 * Drag-to-create: the block between two rail positions (either order), snapped, at least `minDur`
 * minutes and inside the rail.
 */
export function dragRange(a: number, b: number, opts: { step?: number; minDur?: number; rail?: Rail } = {}): { startMin: number; durationMin: number } {
  const step = opts.step ?? 15;
  const rail = opts.rail ?? RAIL;
  const minDur = Math.max(step, opts.minDur ?? step);
  let s = railMinutesAt(Math.min(a, b), step, rail);
  let e = railMinutesAt(Math.max(a, b), step, rail);
  if (e - s < minDur) e = s + minDur;
  if (e > rail.endMin) {
    e = rail.endMin;
    s = Math.max(rail.startMin, e - minDur);
  }
  return { startMin: s, durationMin: e - s };
}

/** Resize: duration from `startMin` to the rail position `fraction`, snapped, ≥ one step, ending on the rail. */
export function resizeTo(startMin: number, fraction: number, opts: { step?: number; rail?: Rail } = {}): number {
  const step = opts.step ?? 15;
  const rail = opts.rail ?? RAIL;
  const end = Math.min(rail.endMin, railMinutesAt(fraction, step, rail));
  return Math.max(step, end - startMin);
}

/** "1 h 30 min", "45 min", "2 h". */
export function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "09:30–11:00 · 1 h 30 min" */
export function rangeLabel(startMin: number, durationMin: number): string {
  return `${hhmmOf(startMin)}–${hhmmOf(startMin + durationMin)} · ${durationLabel(durationMin)}`;
}

// ---------- focus timer ----------

/** Custom focus lengths: 5 min to 4 h (from core, which validates the focus_default setting too). */
export { FOCUS_MAX, FOCUS_MIN };

export const clampFocus = (min: number): number => Math.max(FOCUS_MIN, Math.min(FOCUS_MAX, Math.round(min)));

/**
 * Default block length: the mission's planned minutes (from the calendar or the ritual) when it has
 * them, otherwise the owner's default. `fromPlan` says which one was used.
 */
export function focusLengthFor(estMin: number | null | undefined, fallback: number): { minutes: number; fromPlan: boolean } {
  if (estMin != null && estMin > 0) return { minutes: clampFocus(estMin), fromPlan: true };
  return { minutes: clampFocus(fallback), fromPlan: false };
}

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
