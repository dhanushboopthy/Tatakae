import type { ISODate, ISOTime } from "./types";

// Time model (docs/03-architecture.md): every "today" is Asia/Kolkata with a 04:00 day boundary.
// Pure functions; dates are `YYYY-MM-DD` strings and all date math is done in UTC so it never
// depends on the device's own timezone.

export const TZ = "Asia/Kolkata";
/** Day boundary: before 04:00 IST counts as the previous day. */
export const DAY_BOUNDARY_HOUR = 4;
/** IST is a fixed +05:30 offset (no DST); used only if Intl lacks timezone support. */
const IST_OFFSET_MIN = 330;
const DAY_MS = 86_400_000;

export const CYCLE_1 = { start: "2026-10-12", end: "2027-01-03", maxGoals: 4 } as const;

interface IstParts {
  year: number;
  month: number; // 1..12
  day: number;
  hour: number; // 0..23
  minute: number;
}

let istFormatter: Intl.DateTimeFormat | null | undefined;

function getIstFormatter(): Intl.DateTimeFormat | null {
  if (istFormatter !== undefined) return istFormatter;
  try {
    istFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    istFormatter = null;
  }
  return istFormatter;
}

/** Wall-clock parts of `instant` in Asia/Kolkata. */
function istParts(instant: Date): IstParts {
  const fmt = getIstFormatter();
  if (fmt) {
    const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
    for (const p of fmt.formatToParts(instant)) {
      if (p.type !== "literal") parts[p.type] = Number(p.value);
    }
    const { year, month, day, hour, minute } = parts;
    if (year !== undefined && month !== undefined && day !== undefined && hour !== undefined && minute !== undefined) {
      // Some engines print midnight as "24" even with h23.
      return { year, month, day, hour: hour % 24, minute };
    }
  }
  const shifted = new Date(instant.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

function formatDate(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

/** Parse `YYYY-MM-DD` to a UTC-midnight timestamp (ms). Throws on malformed input. */
function toUtcMs(date: ISODate): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`invalid ISO date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMs(ms: number): ISODate {
  const d = new Date(ms);
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** True for a well-formed, real calendar date `YYYY-MM-DD`. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtcMs(toUtcMs(value)) === value;
}

/** The app's "today": IST date of `now - 4h` (so 01:00 IST still belongs to yesterday). */
export function todayIST(now: Date = new Date()): ISODate {
  const p = istParts(new Date(now.getTime() - DAY_BOUNDARY_HOUR * 3_600_000));
  return formatDate(p.year, p.month, p.day);
}

/** Current wall-clock time in IST as `HH:MM` (no day boundary applied). */
export function istTimeHHMM(now: Date = new Date()): string {
  const p = istParts(now);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * True when `now` ("HH:MM", IST) is between ritual time and wake time, wrapping past midnight.
 * Both clients use it to switch to the dark theme at night (docs/10 §2).
 */
export function isNightTime(now: string, ritualTime: string, wakeTime: string): boolean {
  if (ritualTime === wakeTime) return false;
  return ritualTime > wakeTime ? now >= ritualTime || now < wakeTime : now >= ritualTime && now < wakeTime;
}

/** Current instant as an ISO timestamp (used for `updatedAt`). */
export function nowIso(): ISOTime {
  return new Date().toISOString();
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromUtcMs(toUtcMs(date) + n * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: ISODate): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

/** ISO-8601 week: weeks start Monday; week 1 contains the year's first Thursday. */
export function isoWeek(date: ISODate): { year: number; week: number } {
  const ms = toUtcMs(date);
  const isoDay = (new Date(ms).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const thursday = new Date(ms + (3 - isoDay) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.floor((thursday.getTime() - jan1) / DAY_MS / 7) + 1;
  return { year, week };
}

/** Monday..Sunday of an ISO week. */
export function isoWeekRange(year: number, week: number): { start: ISODate; end: ISODate } {
  const jan4 = Date.UTC(year, 0, 4);
  const jan4IsoDay = (new Date(jan4).getUTCDay() + 6) % 7;
  const week1Monday = jan4 - jan4IsoDay * DAY_MS;
  const start = week1Monday + (week - 1) * 7 * DAY_MS;
  return { start: fromUtcMs(start), end: fromUtcMs(start + 6 * DAY_MS) };
}

/** "2026-W42" style key used by `/stats/week/:isoWeek`. */
export function formatIsoWeek(w: { year: number; week: number }): string {
  return `${w.year}-W${pad2(w.week)}`;
}

/** Parses "2026-W42" (or "2026W42"); null when malformed or out of range. */
export function parseIsoWeek(value: string): { year: number; week: number } | null {
  const m = /^(\d{4})-?W(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // A year has 53 ISO weeks iff Dec 28 falls in week 53.
  const maxWeek = isoWeek(formatDate(year, 12, 28)).week;
  return week >= 1 && week <= maxWeek ? { year, week } : null;
}

/** First and last date of a month; accepts "YYYY-MM" or "YYYYMM". Throws on malformed input. */
export function monthRange(yyyymm: string): { start: ISODate; end: ISODate } {
  const m = /^(\d{4})-?(\d{2})$/.exec(yyyymm);
  const month = m ? Number(m[2]) : 0;
  if (!m || month < 1 || month > 12) throw new Error(`invalid month: ${yyyymm}`);
  const year = Number(m[1]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: formatDate(year, month, 1), end: formatDate(year, month, lastDay) };
}

/** "YYYY-MM" of a date. */
export function monthOf(date: ISODate): string {
  return date.slice(0, 7);
}

/** Scoring constants are editable only on even-ISO-week Sundays. */
export function canEditScoring(date: ISODate): boolean {
  return weekdayOf(date) === 0 && isoWeek(date).week % 2 === 0;
}
