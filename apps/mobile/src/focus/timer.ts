// Focus timer math. The session is stored as timestamps (meta "focus"), never as a ticking counter,
// so it survives backgrounding, app kills and reboots: remaining = length − (now − startedAt − paused).
// Pure functions only; the Focus screen re-renders once a second and derives everything from here.

export interface FocusSession {
  missionId: string;
  /** Block length in minutes: 25 / 50 / 90 from settings, or 5 for the Stuck → inertia timer. */
  length: number;
  /** Epoch ms when the block started. */
  startedAt: number;
  /** Total ms spent paused in completed pauses. */
  pausedMs: number;
  /** Epoch ms of the current pause, or null while running. */
  pausedAt: number | null;
}

const MIN = 60_000;

export function newSession(missionId: string, length: number, now = Date.now()): FocusSession {
  return { missionId, length, startedAt: now, pausedMs: 0, pausedAt: null };
}

export function durationMs(s: FocusSession): number {
  return Math.max(0, s.length) * MIN;
}

/** Focused time so far (pauses excluded). Never negative, never above the block length. */
export function elapsedMs(s: FocusSession, now = Date.now()): number {
  const end = s.pausedAt ?? now;
  const raw = end - s.startedAt - s.pausedMs;
  return Math.min(durationMs(s), Math.max(0, raw));
}

export function remainingMs(s: FocusSession, now = Date.now()): number {
  return Math.max(0, durationMs(s) - elapsedMs(s, now));
}

/** 0 … 1 share of the block done. */
export function progress(s: FocusSession, now = Date.now()): number {
  const d = durationMs(s);
  return d === 0 ? 1 : elapsedMs(s, now) / d;
}

export function isPaused(s: FocusSession): boolean {
  return s.pausedAt !== null;
}

export function isFinished(s: FocusSession, now = Date.now()): boolean {
  return remainingMs(s, now) === 0;
}

export function pause(s: FocusSession, now = Date.now()): FocusSession {
  return s.pausedAt !== null ? s : { ...s, pausedAt: now };
}

export function resume(s: FocusSession, now = Date.now()): FocusSession {
  if (s.pausedAt === null) return s;
  return { ...s, pausedMs: s.pausedMs + Math.max(0, now - s.pausedAt), pausedAt: null };
}

/** Whole focused minutes, rounded to the nearest minute (for missions.actualMin). */
export function focusedMinutes(s: FocusSession, now = Date.now()): number {
  return Math.round(elapsedMs(s, now) / MIN);
}

/** "MM:SS" (or "H:MM:SS" from an hour), seconds rounded up so 0:00 means really done. */
export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const ss = String(sec).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${String(m).padStart(2, "0")}:${ss}`;
}

/** Spoken form for screen readers: "12 minutes left". */
export function spokenRemaining(ms: number): string {
  if (ms <= 0) return "Time is up";
  if (ms < MIN) return "Less than a minute left";
  const min = Math.ceil(ms / MIN);
  return min === 1 ? "1 minute left" : `${min} minutes left`;
}

/** Parse the stored JSON; null when missing or malformed. */
export function parseSession(json: string | null): FocusSession | null {
  if (!json) return null;
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const { missionId, length, startedAt, pausedMs, pausedAt } = o;
  if (typeof missionId !== "string" || missionId === "") return null;
  if (typeof length !== "number" || !Number.isFinite(length) || length <= 0) return null;
  if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) return null;
  const paused = typeof pausedMs === "number" && Number.isFinite(pausedMs) && pausedMs >= 0 ? pausedMs : 0;
  const pausedAtOk = typeof pausedAt === "number" && Number.isFinite(pausedAt) ? pausedAt : null;
  return { missionId, length, startedAt, pausedMs: paused, pausedAt: pausedAtOk };
}

/** "HH:MM" in IST for an epoch-ms instant (the app's clock, whatever the phone's time zone). */
function istHHMM(ms: number): string {
  const d = new Date(ms + 330 * MIN);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Text for the ongoing focus notification (v2.5). Android can't tick a countdown in a plain
 * notification, so it shows when the block ends; paused blocks say how much is left.
 */
export function ongoingText(s: FocusSession, missionTitle: string | null, now = Date.now()): { title: string; body: string } {
  const left = remainingMs(s, now);
  const title = missionTitle ? `Focus · ${missionTitle}` : "Focus block";
  if (isPaused(s)) return { title, body: `Paused · ${spokenRemaining(left).toLowerCase()}` };
  if (left === 0) return { title, body: "Block done. Note where you'll pick it up." };
  return { title, body: `Until ${istHHMM(now + left)} · ${s.length} min block` };
}
