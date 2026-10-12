import type { Day, DayScore, ISODate, Mark, Mission } from "./types";

// Pure stats used by dashboards, charts, calendar and scoreboard (docs/11). Run on the API and on the phone (offline).

export type CalendarState = Mark | "Missed" | "Rest" | "WriteOff" | "Future" | "Today";

export interface CalendarDay {
  date: ISODate;
  state: CalendarState;
  final: number | null;
  done: number;      // points
  minimum: number;   // points (full value, rendered hatched)
  missed: number;    // points
  screenMin: number | null;
  hasNote: boolean;
}

export interface MetricBox {
  key: "today_score" | "days_shown_up" | "avg_7d" | "p1_hit_rate" | "focus_week" | "screen_avg" | "habits_week" | "comebacks" | "inbox";
  value: number | null;
  delta: number | null;      // + is better; rendered lime ↗ or grey ↘, never red
  target: number | null;     // for the progress bar
  context: string;
}

export interface SeriesPoint { date: ISODate; value: number | null }

export interface WeekStats {
  days: CalendarDay[];
  stuck: { uncertainty: number; fear: number; inertia: number };
  areaMinutes: { areaId: string; minutes: number }[];
  habitsPct: number | null;
}

export interface CycleStats {
  weekMarks: (Mark | "Missed" | "Future")[]; // length 12
  daysShownUp: number;
  daysElapsed: number;
  goals: { id: string; name: string; areaId: string | null; progressPct: number }[];
}

/** Map a day + its score to a calendar circle state. */
export function calendarState(day: Pick<Day, "kind" | "date">, score: DayScore | null, today: ISODate): CalendarState {
  // TODO(v1)
  throw new Error("not implemented");
}

/** Build a month grid (Mon-first) with padding nulls. */
export function monthGrid(yyyymm: string, days: CalendarDay[]): (CalendarDay | null)[][] {
  // TODO(v1)
  throw new Error("not implemented");
}

/** Point breakdown per day for the hatched stacked bars. */
export function pointBreakdown(missions: Mission[]): { done: number; minimum: number; missed: number } {
  // TODO(v1)
  throw new Error("not implemented");
}

/** Scoreboard boxes for a date (see docs/11 §2). */
export function scoreboard(input: {
  date: ISODate;
  scores: { date: ISODate; score: DayScore }[];
  p1Statuses: { date: ISODate; status: Mission["status"] }[];
  focusMinutesThisWeek: number;
  focusMinutesLastWeek: number;
  inboxCount: number;
  cycleStart: ISODate;
}): MetricBox[] {
  // TODO(v1)
  throw new Error("not implemented");
}

/** Rolling 7-day average over a series (nulls skipped). */
export function rollingAverage(series: SeriesPoint[], window = 7): SeriesPoint[] {
  // TODO(v2)
  throw new Error("not implemented");
}

/** Average mark of a week → gauge segment colour. */
export function weekMark(scores: DayScore[]): Mark | "Missed" {
  // TODO(v2)
  throw new Error("not implemented");
}

/** One-line accessible summary for any chart ("4 of 7 days Strong or Solid; Wed was the dip"). */
export function summarizeWeek(days: CalendarDay[]): string {
  // TODO(v1)
  throw new Error("not implemented");
}
