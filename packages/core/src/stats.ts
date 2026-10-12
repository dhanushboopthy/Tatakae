import { DEFAULT_SCORING, averageScore, firstUseDate, isMissedDay, missionPoints, scoreDay } from "./scoring";
import { CYCLE_1, addDays, daysBetween, formatIsoWeek, isoWeek, isoWeekRange, monthRange, todayIST, weekdayOf } from "./time";
import type {
  Area,
  Day,
  DayKind,
  DayScore,
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  ISODate,
  InboxItem,
  Mark,
  Mission,
  MuraEvent,
  ScoringSettings,
  StuckEvent,
} from "./types";

// Pure stats used by dashboards, charts, calendar and scoreboard (docs/11). The API runs them over
// SQLite rows, the web and the phone over their local copies, so every number matches everywhere.
// Build an index once with indexStats(), then ask it questions.

// ===================== types =====================

export type CalendarState = Mark | "Missed" | "Rest" | "WriteOff" | "Future" | "Today";

export interface CalendarDay {
  date: ISODate;
  state: CalendarState;
  kind: DayKind;
  /** Final score once the day is closed and has data; null otherwise (future, today, rest, before first use). */
  final: number | null;
  done: number;      // points
  minimum: number;   // points (full value, rendered hatched)
  missed: number;    // points (open missions count as missed once the day is closed)
  open: number;      // points still open (today / not closed yet)
  screenMin: number | null;
  focusMin: number;
  hasNote: boolean;  // small win or any of the three answers
}

export type MetricKey =
  | "today_score" | "days_shown_up" | "avg_7d" | "p1_hit_rate" | "focus_week" | "screen_avg" | "habits_week" | "comebacks" | "inbox";

export interface MetricBox {
  key: MetricKey;
  label: string;
  value: number | null;
  unit: "" | "%" | "min";
  delta: number | null;      // + is better; rendered lime ↗ or grey ↘, never red
  target: number | null;     // for the progress bar
  /** 0..100 progress for the bar, null = no bar. */
  progress: number | null;
  context: string;
}

export interface SeriesPoint { date: ISODate; value: number | null }

export type SeriesMetric = "final" | "screen_min" | "focus_min";

export interface Series {
  metric: SeriesMetric;
  points: SeriesPoint[];
  avg7: SeriesPoint[];
  average: number | null;
  summary: string;
}

export interface AreaMinutes { areaId: string | null; minutes: number }

export interface WeekStats {
  week: string;          // "2026-W42"
  start: ISODate;
  end: ISODate;
  days: CalendarDay[];
  average: number | null;
  stuck: { uncertainty: number; fear: number; inertia: number };
  areaMinutes: AreaMinutes[];
  focusMinutes: number;
  habitsPct: number | null;
  screenAvg: number | null;
  /** Lock edits (mura events) this week. */
  lockEdits: number;
  /** Missions rescheduled two or more times (muda). */
  rescheduledTwice: { id: string; title: string; count: number }[];
  summary: string;
}

export interface MonthStats {
  month: string;         // "2026-10"
  start: ISODate;
  end: ISODate;
  days: CalendarDay[];
  marks: { Strong: number; Solid: number; Light: number; Missed: number; Rest: number };
  average: number | null;
  previousAverage: number | null;
  daysShownUp: number;
  areaMinutes: AreaMinutes[];
  focusMinutes: number;
  habitsPct: number | null;
  summary: string;
}

export type WeekMark = Mark | "Missed" | "Future";

export interface CycleWeek { index: number; start: ISODate; end: ISODate; mark: WeekMark; average: number | null }

export interface GoalProgress {
  id: string;
  name: string;
  areaId: string | null;
  color: string | null;
  progressPct: number;
  earned: number;
  target: number | null;
}

export interface CycleStats {
  start: ISODate;
  end: ISODate;
  weeks: CycleWeek[];
  weekMarks: WeekMark[]; // one per week (12 for a standard cycle)
  daysShownUp: number;
  daysElapsed: number;
  /** Days shown up / counted days elapsed (rest and write-off days don't count against you). */
  pct: number | null;
  word: "On track" | "Steady" | "Rebuilding" | "Starting";
  goals: GoalProgress[];
}

export type HabitCell = "done" | "not" | "rest" | "none";
export interface HabitGrid {
  dates: ISODate[];
  rows: { habitId: string; behaviour: string; cells: HabitCell[]; pct: number | null }[];
}

// ===================== index =====================

export interface StatsData {
  days: readonly Day[];
  missions: readonly Mission[];
  focusSessions?: readonly FocusSession[];
  habits?: readonly Habit[];
  habitLogs?: readonly HabitLog[];
  stuckEvents?: readonly StuckEvent[];
  inbox?: readonly InboxItem[];
  goals?: readonly Goal[];
  areas?: readonly Area[];
  muraEvents?: readonly MuraEvent[];
}

export interface DatedScore {
  date: ISODate;
  day: Day | null;
  missions: Mission[];
  score: DayScore;
  /** Missed-day rule (isMissedDay). Today is never "missed" while it is still open. */
  missed: boolean;
  /** Past, or tomorrow's plan is already locked (ritual done). */
  closed: boolean;
  /** Has a saved day row or missions. */
  hasData: boolean;
}

export interface StatsIndex {
  today: ISODate;
  scoring: ScoringSettings;
  firstUse: ISODate | null;
  days: Map<ISODate, Day>;
  missionsByDate: Map<ISODate, Mission[]>;
  missions: Mission[];
  focus: FocusSession[];
  habits: Habit[];
  habitLogs: Map<string, boolean>; // "habitId|date" → done
  stuck: StuckEvent[];
  inbox: InboxItem[];
  goals: Goal[];
  areas: Map<string, Area>;
  mura: MuraEvent[];
  goalArea: Map<string, string | null>;
  cache: Map<ISODate, DatedScore>;
}

const live = <T extends { deletedAt: string | null }>(rows: readonly T[] | undefined): T[] =>
  (rows ?? []).filter((r) => r.deletedAt == null);

/** Build the lookup structures once. `today` is the app day (todayIST); scoring defaults to DEFAULT_SCORING. */
export function indexStats(data: StatsData, opts: { today?: ISODate; scoring?: ScoringSettings } = {}): StatsIndex {
  const days = live(data.days);
  const missions = live(data.missions);
  const byDate = new Map<ISODate, Mission[]>();
  for (const m of missions) {
    if (!m.dayDate || m.slot === "backlog") continue;
    const list = byDate.get(m.dayDate) ?? [];
    list.push(m);
    byDate.set(m.dayDate, list);
  }
  const logs = new Map<string, boolean>();
  for (const l of live(data.habitLogs)) logs.set(`${l.habitId}|${l.date}`, l.done);
  const goals = live(data.goals);
  return {
    today: opts.today ?? todayIST(),
    scoring: opts.scoring ?? DEFAULT_SCORING,
    firstUse: firstUseDate(days),
    days: new Map(days.map((d) => [d.date, d] as const)),
    missionsByDate: byDate,
    missions,
    focus: live(data.focusSessions),
    habits: live(data.habits),
    habitLogs: logs,
    stuck: live(data.stuckEvents),
    inbox: live(data.inbox),
    goals,
    areas: new Map(live(data.areas).map((a) => [a.id, a] as const)),
    mura: live(data.muraEvents),
    goalArea: new Map(goals.map((g) => [g.id, g.areaId] as const)),
    cache: new Map(),
  };
}

function missedRaw(ix: StatsIndex, date: ISODate): boolean {
  return isMissedDay(
    date,
    ix.days.get(date) ?? null,
    ix.missionsByDate.get(date) ?? [],
    { firstUseDate: ix.firstUse, today: ix.today },
    ix.scoring,
  );
}

/** Score + flags for one date (memoised on the index). */
export function scoreOn(ix: StatsIndex, date: ISODate): DatedScore {
  const hit = ix.cache.get(date);
  if (hit) return hit;
  const day = ix.days.get(date) ?? null;
  const missions = ix.missionsByDate.get(date) ?? [];
  const score = scoreDay(day ?? { kind: "normal", screenMin: null }, missions, missedRaw(ix, addDays(date, -1)), ix.scoring);
  const closed = date < ix.today || ix.days.get(addDays(date, 1))?.forgedAt != null;
  const missed = date >= ix.today && !closed ? false : missedRaw(ix, date);
  const out: DatedScore = { date, day, missions, score, missed, closed, hasData: day !== null || missions.length > 0 };
  ix.cache.set(date, out);
  return out;
}

/** Every date in [from, to] (inclusive), oldest first. Empty when to < from. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function scoreRange(ix: StatsIndex, from: ISODate, to: ISODate): DatedScore[] {
  return dateRange(from, to).map((d) => scoreOn(ix, d));
}

/** True when a dated score counts toward "days shown up": closed, not excluded, not missed. */
function shownUp(s: DatedScore): boolean {
  return s.closed && !s.score.excluded && !s.missed && s.hasData;
}

/** Final score when it may be shown (closed, normal day, has data or was a missed day); else null. */
function visibleFinal(s: DatedScore): number | null {
  if (!s.closed || s.score.excluded) return null;
  if (!s.hasData && !s.missed) return null;
  return s.score.final;
}

// ===================== calendar =====================

/** Map a day to its calendar circle state (docs/11 §4). */
export function calendarState(input: {
  date: ISODate;
  today: ISODate;
  kind: DayKind;
  mark: Mark;
  missed: boolean;
  hasData: boolean;
}): CalendarState {
  if (input.date === input.today) return "Today";
  if (input.date > input.today) return "Future";
  if (input.kind === "rest") return "Rest";
  if (input.kind === "write_off") return "WriteOff";
  if (input.missed) return "Missed";
  if (!input.hasData) return "Unplanned";
  return input.mark;
}

/** Point breakdown per day for the hatched stacked bars. Side quests and moved missions don't count. */
export function pointBreakdown(
  missions: readonly Pick<Mission, "points" | "status" | "slot" | "deletedAt">[],
  openAsMissed = false,
): { done: number; minimum: number; missed: number; open: number } {
  const out = { done: 0, minimum: 0, missed: 0, open: 0 };
  for (const m of missions) {
    if (m.deletedAt != null || m.slot === "side" || m.slot === "backlog") continue;
    const p = missionPoints(m);
    if (m.status === "done") out.done += p;
    else if (m.status === "minimum") out.minimum += p;
    else if (m.status === "missed") out.missed += p;
    else if (m.status === "open") {
      if (openAsMissed) out.missed += p;
      else out.open += p;
    }
  }
  return out;
}

/** Focus minutes of a finished session (running sessions count 0), clamped to 0..600. */
export function focusMinutes(s: Pick<FocusSession, "startedAt" | "endedAt">): number {
  if (!s.endedAt) return 0;
  const min = Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60_000);
  return Number.isFinite(min) ? Math.min(600, Math.max(0, min)) : 0;
}

/** App day (IST, 04:00 boundary) a timestamp belongs to. */
export function appDayOf(iso: string): ISODate {
  return todayIST(new Date(iso));
}

function focusOn(ix: StatsIndex, from: ISODate, to: ISODate): FocusSession[] {
  return ix.focus.filter((f) => {
    const d = appDayOf(f.startedAt);
    return d >= from && d <= to;
  });
}

export function calendarDay(ix: StatsIndex, date: ISODate): CalendarDay {
  const s = scoreOn(ix, date);
  const kind = s.day?.kind ?? "normal";
  const pts = pointBreakdown(s.missions, s.closed);
  const d = s.day;
  return {
    date,
    state: calendarState({ date, today: ix.today, kind, mark: s.score.mark, missed: s.missed, hasData: s.hasData }),
    kind,
    final: visibleFinal(s),
    ...pts,
    screenMin: d?.screenMin ?? null,
    focusMin: focusOn(ix, date, date).reduce((sum, f) => sum + focusMinutes(f), 0),
    hasNote: !!(d?.smallWin?.trim() || d?.qP1?.trim() || d?.qDrift?.trim() || d?.qPractised?.trim()),
  };
}

/** Calendar days of a month ("YYYY-MM" or "YYYYMM"). */
export function calendarMonth(ix: StatsIndex, yyyymm: string): CalendarDay[] {
  const { start, end } = monthRange(yyyymm);
  return dateRange(start, end).map((d) => calendarDay(ix, d));
}

/** Build a month grid (Mon-first weeks) with null padding before the 1st and after the last day. */
export function monthGrid<T extends { date: ISODate }>(yyyymm: string, days: readonly T[]): (T | null)[][] {
  const { start, end } = monthRange(yyyymm);
  const byDate = new Map(days.map((d) => [d.date, d] as const));
  const lead = (weekdayOf(start) + 6) % 7; // Mon = 0
  const cells: (T | null)[] = Array.from({ length: lead }, () => null);
  for (const d of dateRange(start, end)) cells.push(byDate.get(d) ?? null);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (T | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// ===================== series =====================

/** Rolling average over a series (nulls skipped; null when the window has no values). Rounded to an integer. */
export function rollingAverage(series: readonly SeriesPoint[], window = 7): SeriesPoint[] {
  return series.map((p, i) => {
    const vals = series
      .slice(Math.max(0, i - window + 1), i + 1)
      .map((x) => x.value)
      .filter((v): v is number => v != null);
    return { date: p.date, value: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  });
}

function mean(values: readonly (number | null)[]): number | null {
  const vals = values.filter((v): v is number => v != null);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

const SERIES_LABEL: Record<SeriesMetric, string> = {
  final: "Average score",
  screen_min: "Average screen time",
  focus_min: "Average focus",
};

/** `days` points ending at `end` (default: yesterday for final, today otherwise). */
export function series(ix: StatsIndex, metric: SeriesMetric, days: number, end?: ISODate): Series {
  const last = end ?? (metric === "final" ? addDays(ix.today, -1) : ix.today);
  const n = Math.max(1, Math.min(400, Math.floor(days)));
  const dates = dateRange(addDays(last, -(n - 1)), last);
  const points: SeriesPoint[] = dates.map((date) => {
    if (metric === "final") return { date, value: visibleFinal(scoreOn(ix, date)) };
    if (metric === "screen_min") return { date, value: ix.days.get(date)?.screenMin ?? null };
    const fs = focusOn(ix, date, date);
    return { date, value: date > ix.today ? null : fs.reduce((sum, f) => sum + focusMinutes(f), 0) };
  });
  const average = mean(points.map((p) => p.value));
  const unit = metric === "final" ? "" : " min";
  const counted = points.filter((p) => p.value != null).length;
  const summary =
    average == null
      ? `No data in the last ${n} days.`
      : `${SERIES_LABEL[metric]} ${average}${unit} over ${counted} of the last ${n} days.`;
  return { metric, points, avg7: rollingAverage(points, 7), average, summary };
}

// ===================== habits =====================

/** Whether a habit is due on a date: "daily", "weekdays", "weekends" or a list of weekday numbers "1,3,5". */
export function habitDueOn(habit: Pick<Habit, "frequency">, date: ISODate): boolean {
  const f = habit.frequency.trim().toLowerCase();
  const wd = weekdayOf(date);
  if (f === "weekdays") return wd >= 1 && wd <= 5;
  if (f === "weekends") return wd === 0 || wd === 6;
  if (/^[0-6](,[0-6])*$/.test(f)) return f.split(",").includes(String(wd));
  return true;
}

function isRestDay(ix: StatsIndex, date: ISODate): boolean {
  const k = ix.days.get(date)?.kind;
  return k === "rest" || k === "write_off";
}

/** % of due habit checks done in [from, to] (dates after today ignored; rest days skipped). */
export function habitsPct(ix: StatsIndex, from: ISODate, to: ISODate): number | null {
  let due = 0;
  let done = 0;
  const last = to < ix.today ? to : ix.today;
  for (const date of dateRange(from, last)) {
    if (isRestDay(ix, date)) continue;
    for (const h of ix.habits) {
      if (!h.active || !habitDueOn(h, date)) continue;
      due++;
      if (ix.habitLogs.get(`${h.id}|${date}`)) done++;
    }
  }
  return due === 0 ? null : Math.round((100 * done) / due);
}

/** Habit × day grid for the heat grid (docs/11 C7). */
export function habitGrid(ix: StatsIndex, days = 84, end: ISODate = ix.today): HabitGrid {
  const dates = dateRange(addDays(end, -(Math.max(1, days) - 1)), end);
  const rows = ix.habits
    .filter((h) => h.active)
    .sort((a, b) => a.behaviour.localeCompare(b.behaviour))
    .map((h) => {
      let due = 0;
      let done = 0;
      const cells = dates.map((date): HabitCell => {
        if (date > ix.today || !habitDueOn(h, date)) return "none";
        if (isRestDay(ix, date)) return "rest";
        due++;
        if (ix.habitLogs.get(`${h.id}|${date}`)) {
          done++;
          return "done";
        }
        return "not";
      });
      return { habitId: h.id, behaviour: h.behaviour, cells, pct: due ? Math.round((100 * done) / due) : null };
    });
  return { dates, rows };
}

// ===================== areas / focus =====================

function areaOfSession(ix: StatsIndex, f: FocusSession): string | null {
  if (f.areaId) return f.areaId;
  if (!f.missionId) return null;
  const goalId = ix.missions.find((m) => m.id === f.missionId)?.goalId;
  return goalId ? (ix.goalArea.get(goalId) ?? null) : null;
}

/** Focus minutes per area in [from, to], largest first (null area = "Unassigned"). */
export function areaMinutes(ix: StatsIndex, from: ISODate, to: ISODate): AreaMinutes[] {
  const totals = new Map<string | null, number>();
  for (const f of focusOn(ix, from, to)) {
    const key = areaOfSession(ix, f);
    totals.set(key, (totals.get(key) ?? 0) + focusMinutes(f));
  }
  return [...totals.entries()]
    .filter(([, minutes]) => minutes > 0)
    .map(([areaId, minutes]) => ({ areaId, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function focusTotal(ix: StatsIndex, from: ISODate, to: ISODate): number {
  return focusOn(ix, from, to).reduce((sum, f) => sum + focusMinutes(f), 0);
}

/** When focus sessions start: counts[weekday 0=Sun..6][hour 0..23] in IST wall-clock time. */
export function focusHours(ix: StatsIndex): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const f of ix.focus) {
    const ms = Date.parse(f.startedAt);
    if (!Number.isFinite(ms)) continue;
    const ist = new Date(ms + 330 * 60_000);
    const row = grid[ist.getUTCDay()];
    if (row) row[ist.getUTCHours()] = (row[ist.getUTCHours()] ?? 0) + 1;
  }
  return grid;
}

// ===================== week / month =====================

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** One-line accessible summary for a run of days ("4 of 7 days Strong or Solid; Wed was the dip"). */
export function summarizeWeek(days: readonly CalendarDay[]): string {
  const closed = days.filter((d) => d.final != null);
  if (closed.length === 0) return "No closed days yet.";
  const good = days.filter((d) => d.state === "Strong" || d.state === "Solid").length;
  let line = `${good} of ${days.length} days Strong or Solid`;
  if (closed.length >= 2) {
    const dip = closed.reduce((lo, d) => ((d.final ?? 0) < (lo.final ?? 0) ? d : lo));
    const top = Math.max(...closed.map((d) => d.final ?? 0));
    if ((dip.final ?? 0) < top) line += `; ${WEEKDAY_NAMES[weekdayOf(dip.date)]} was the dip`;
  }
  return `${line}.`;
}

/** Average mark of a run of day scores → gauge segment colour. */
export function weekMark(scores: readonly DayScore[], s: ScoringSettings = DEFAULT_SCORING): Mark | "Missed" {
  const counted = scores.filter((sc) => !sc.excluded);
  if (counted.length === 0) return "Unplanned";
  const missed = counted.filter((sc) => sc.missedDay).length;
  const avg = averageScore(counted) ?? 0;
  if (avg >= s.strongAt) return "Strong";
  if (avg >= s.solidAt) return "Solid";
  if (missed * 2 > counted.length) return "Missed";
  return "Light";
}

/** Weekly Control Room numbers for an ISO week ("2026-W42" or { year, week }). */
export function weekStats(ix: StatsIndex, week: { year: number; week: number }): WeekStats {
  const { start, end } = isoWeekRange(week.year, week.week);
  const scores = scoreRange(ix, start, end);
  const days = scores.map((s) => calendarDay(ix, s.date));
  const stuck = { uncertainty: 0, fear: 0, inertia: 0 };
  for (const e of ix.stuck) {
    const d = appDayOf(e.at);
    if (d >= start && d <= end) stuck[e.blocker]++;
  }
  const weekMissionIds = new Set(scores.flatMap((s) => s.missions.map((m) => m.id)));
  const lockEdits = ix.mura.filter((e) => {
    const d = appDayOf(e.at);
    return (d >= start && d <= end) || weekMissionIds.has(e.missionId);
  }).length;
  const rescheduledTwice = ix.missions
    .filter((m) => m.rescheduleCount >= 2 && (m.dayDate === null || (m.dayDate >= start && m.dayDate <= end)))
    .filter((m) => m.status !== "rescheduled")
    .map((m) => ({ id: m.id, title: m.title, count: m.rescheduleCount }));
  return {
    week: formatIsoWeek(week),
    start,
    end,
    days,
    average: averageScore(scores.filter((s) => visibleFinal(s) != null).map((s) => s.score)),
    stuck,
    areaMinutes: areaMinutes(ix, start, end),
    focusMinutes: focusTotal(ix, start, end),
    habitsPct: habitsPct(ix, start, end),
    screenAvg: mean(days.map((d) => d.screenMin)),
    lockEdits,
    rescheduledTwice,
    summary: summarizeWeek(days),
  };
}

function monthAverage(ix: StatsIndex, start: ISODate, end: ISODate): number | null {
  return averageScore(
    scoreRange(ix, start, end)
      .filter((s) => visibleFinal(s) != null)
      .map((s) => s.score),
  );
}

/** Monthly review numbers ("YYYY-MM" or "YYYYMM"). */
export function monthStats(ix: StatsIndex, yyyymm: string): MonthStats {
  const { start, end } = monthRange(yyyymm);
  const days = calendarMonth(ix, yyyymm);
  const marks = { Strong: 0, Solid: 0, Light: 0, Missed: 0, Rest: 0 };
  for (const d of days) {
    if (d.state === "Strong" || d.state === "Solid" || d.state === "Light" || d.state === "Missed") marks[d.state]++;
    else if (d.state === "Rest" || d.state === "WriteOff") marks.Rest++;
  }
  const prevStart = monthRange(addDays(start, -1).slice(0, 7)).start;
  const average = monthAverage(ix, start, end);
  const counted = marks.Strong + marks.Solid + marks.Light + marks.Missed;
  const summary =
    counted === 0
      ? "No closed days this month yet."
      : `${marks.Strong + marks.Solid} of ${counted} days Strong or Solid; ${marks.Missed} grey, ${marks.Rest} rest.`;
  return {
    month: start.slice(0, 7),
    start,
    end,
    days,
    marks,
    average,
    previousAverage: monthAverage(ix, prevStart, addDays(start, -1)),
    daysShownUp: scoreRange(ix, start, end).filter(shownUp).length,
    areaMinutes: areaMinutes(ix, start, end),
    focusMinutes: focusTotal(ix, start, end),
    habitsPct: habitsPct(ix, start, end),
    summary,
  };
}

// ===================== cycle =====================

/** Goal progress: earned points of linked missions vs targetPoints (or vs planned points without a target). */
export function goalProgress(ix: StatsIndex, goal: Goal, from: ISODate, to: ISODate): GoalProgress {
  let earned = 0;
  let planned = 0;
  for (const m of ix.missions) {
    if (m.goalId !== goal.id || !m.dayDate || m.dayDate < from || m.dayDate > to) continue;
    if (m.status === "rescheduled" || m.status === "backlog" || m.slot === "backlog") continue;
    const p = missionPoints(m);
    planned += p;
    if (m.status === "done") earned += p;
    else if (m.status === "minimum") earned += p / 2;
  }
  const target = goal.targetPoints ?? null;
  const base = target ?? planned;
  const pct = goal.status === "done" ? 100 : base > 0 ? Math.min(100, Math.round((100 * earned) / base)) : 0;
  const color = goal.areaId ? (ix.areas.get(goal.areaId)?.color ?? null) : null;
  return { id: goal.id, name: goal.name, areaId: goal.areaId, color, progressPct: pct, earned, target };
}

/** 12-week cycle: one gauge segment per week, days shown up, goal rings. */
export function cycleStats(ix: StatsIndex, cycle: { start: ISODate; end: ISODate } = CYCLE_1): CycleStats {
  const weeks: CycleWeek[] = [];
  for (let i = 0, ws = cycle.start; ws <= cycle.end; i++, ws = addDays(ws, 7)) {
    const we = addDays(ws, 6) < cycle.end ? addDays(ws, 6) : cycle.end;
    const closed = scoreRange(ix, ws, we).filter((s) => s.closed && (s.hasData || s.missed || s.score.excluded));
    const mark: WeekMark =
      ws > ix.today || closed.length === 0 ? "Future" : weekMark(closed.map((s) => ({ ...s.score, missedDay: s.missed })), ix.scoring);
    weeks.push({ index: i, start: ws, end: we, mark, average: averageScore(closed.filter((s) => visibleFinal(s) != null).map((s) => s.score)) });
  }
  const lastClosed = scoreOn(ix, ix.today).closed ? ix.today : addDays(ix.today, -1);
  const until = lastClosed < cycle.end ? lastClosed : cycle.end;
  const elapsed = until >= cycle.start ? scoreRange(ix, cycle.start, until) : [];
  const fromFirstUse = elapsed.filter((s) => ix.firstUse != null && s.date >= ix.firstUse);
  const counted = fromFirstUse.filter((s) => !s.score.excluded);
  const shown = counted.filter(shownUp).length;
  const pct = counted.length ? Math.round((100 * shown) / counted.length) : null;
  const word = pct == null ? "Starting" : pct >= 70 ? "On track" : pct >= 40 ? "Steady" : "Rebuilding";
  const goals = ix.goals
    .filter((g) => g.status === "active" || g.status === "done")
    .filter((g) => (g.start ?? cycle.start) <= cycle.end && (g.end ?? cycle.end) >= cycle.start)
    .map((g) => goalProgress(ix, g, cycle.start, cycle.end));
  return {
    start: cycle.start,
    end: cycle.end,
    weeks,
    weekMarks: weeks.map((w) => w.mark),
    daysShownUp: shown,
    daysElapsed: elapsed.length,
    pct,
    word,
    goals,
  };
}

/** Cycle containing `date`: Cycle 1, then consecutive 12-week cycles after it. */
export function cycleFor(date: ISODate): { index: number; start: ISODate; end: ISODate } {
  const offset = daysBetween(CYCLE_1.start, date);
  const index = offset < 0 ? 0 : Math.floor(offset / 84);
  const start = addDays(CYCLE_1.start, index * 84);
  return { index: index + 1, start, end: addDays(start, 83) };
}

// ===================== scoreboard =====================

function deltaLine(delta: number | null, unit: string, what: string): string {
  if (delta == null) return `No ${what} to compare yet`;
  if (delta === 0) return `Same as ${what}`;
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)}${unit} vs ${what}`;
}

const pctOf = (value: number | null, target: number | null): number | null =>
  value == null || target == null || target <= 0 ? null : Math.max(0, Math.min(100, Math.round((100 * value) / target)));

/** All scoreboard boxes for `date` (docs/11 §2). Clients pick the ones they show. */
export function scoreboard(
  ix: StatsIndex,
  opts: { date?: ISODate; focusWeekTarget?: number; cycle?: { start: ISODate; end: ISODate } } = {},
): MetricBox[] {
  const date = opts.date ?? ix.today;
  const cycle = opts.cycle ?? cycleFor(date);
  const today = scoreOn(ix, date);

  // Today's score — only after shutdown.
  const todayFinal = visibleFinal(today);
  const todayBox: MetricBox = {
    key: "today_score",
    label: "Today's score",
    value: todayFinal,
    unit: "",
    delta: null,
    target: 100,
    progress: todayFinal,
    context: todayFinal == null ? "Shown after shutdown" : today.score.mark === "Unplanned" ? "Nothing planned" : today.score.mark,
  };

  // Days shown up this cycle (never resets).
  const cycleEnd = date < cycle.end ? date : cycle.end;
  const cycleScores = cycle.start <= cycleEnd ? scoreRange(ix, cycle.start, cycleEnd) : [];
  const shown = cycleScores.filter(shownUp).length;
  const elapsed = cycleScores.filter((s) => s.closed && !s.score.excluded && ix.firstUse != null && s.date >= ix.firstUse).length;
  const cycleLen = daysBetween(cycle.start, cycle.end) + 1;
  const shownBox: MetricBox = {
    key: "days_shown_up",
    label: "Days shown up",
    value: shown,
    unit: "",
    delta: null,
    target: elapsed || null,
    progress: pctOf(shown, elapsed),
    context: `of ${cycleLen} days in Cycle ${cycleFor(cycle.start).index}`,
  };

  // 7-day average vs the 7 days before.
  const avgOf = (from: ISODate, to: ISODate) =>
    averageScore(scoreRange(ix, from, to).filter((s) => visibleFinal(s) != null).map((s) => s.score));
  const avg = avgOf(addDays(date, -7), addDays(date, -1));
  const prevAvg = avgOf(addDays(date, -14), addDays(date, -8));
  const avgDelta = avg != null && prevAvg != null ? avg - prevAvg : null;
  const avgBox: MetricBox = {
    key: "avg_7d",
    label: "7-day average",
    value: avg,
    unit: "",
    delta: avgDelta,
    target: ix.scoring.strongAt,
    progress: pctOf(avg, ix.scoring.strongAt),
    context: deltaLine(avgDelta, "", "the 7 days before"),
  };

  // P1 hit rate over 30 days.
  let p1Days = 0;
  let p1Hit = 0;
  let p1Min = 0;
  for (const s of scoreRange(ix, addDays(date, -30), addDays(date, -1))) {
    if (s.score.excluded || !s.closed) continue;
    const p1 = s.missions.find((m) => m.slot === "P1" && m.status !== "rescheduled");
    if (!p1 && !s.missed) continue;
    p1Days++;
    if (p1?.status === "done") p1Hit++;
    if (p1?.status === "minimum") {
      p1Hit++;
      p1Min++;
    }
  }
  const p1Rate = p1Days ? Math.round((100 * p1Hit) / p1Days) : null;
  const p1Box: MetricBox = {
    key: "p1_hit_rate",
    label: "P1 hit rate",
    value: p1Rate,
    unit: "%",
    delta: null,
    target: 100,
    progress: p1Rate,
    context: p1Days ? `Minimum counted on ${p1Min} ${p1Min === 1 ? "day" : "days"}` : "Last 30 days",
  };

  // Focus minutes this ISO week vs last.
  const w = isoWeek(date);
  const { start: ws } = isoWeekRange(w.year, w.week);
  const focusNow = focusTotal(ix, ws, date);
  const focusPrev = focusTotal(ix, addDays(ws, -7), addDays(date, -7));
  const target = opts.focusWeekTarget ?? 600;
  const focusDelta = focusNow - focusPrev;
  const focusBox: MetricBox = {
    key: "focus_week",
    label: "Focus this week",
    value: focusNow,
    unit: "min",
    delta: focusPrev === 0 && focusNow === 0 ? null : focusDelta,
    target: target || null,
    progress: pctOf(focusNow, target),
    context: focusPrev === 0 && focusNow === 0 ? "Start a block from Today" : deltaLine(focusDelta, " min", "this time last week"),
  };

  // Screen minutes, 7-day average (lower is better).
  const screenVals = dateRange(addDays(date, -7), addDays(date, -1)).map((d) => ix.days.get(d)?.screenMin ?? null);
  const screenAvg = mean(screenVals);
  const prevScreen = mean(dateRange(addDays(date, -14), addDays(date, -8)).map((d) => ix.days.get(d)?.screenMin ?? null));
  const free = ix.scoring.screenFreeMin;
  const screenBox: MetricBox = {
    key: "screen_avg",
    label: "Screen time (avg)",
    value: screenAvg,
    unit: "min",
    delta: screenAvg != null && prevScreen != null ? prevScreen - screenAvg : null,
    target: free,
    // Bar = how much of the free allowance is still left: 120 / avg, capped at 100 %.
    progress: screenAvg == null ? null : screenAvg <= free ? 100 : Math.round((100 * free) / screenAvg),
    context: `Free under ${free}`,
  };

  // Habits this week.
  const hp = habitsPct(ix, ws, date);
  let best: string | null = null;
  let bestPct = -1;
  for (const row of habitGrid(ix, daysBetween(ws, date) + 1, date).rows) {
    if (row.pct != null && row.pct > bestPct) {
      bestPct = row.pct;
      best = row.behaviour;
    }
  }
  const habitsBox: MetricBox = {
    key: "habits_week",
    label: "Habits this week",
    value: hp,
    unit: "%",
    delta: null,
    target: 100,
    progress: hp,
    context: best ? `Best: ${best}` : "No habits yet",
  };

  // Comebacks this cycle: a closed, shown-up day right after a missed day.
  const comebacks = cycleScores.filter((s) => shownUp(s) && scoreOn(ix, addDays(s.date, -1)).missed).length;
  const comebackBox: MetricBox = {
    key: "comebacks",
    label: "Comebacks",
    value: comebacks,
    unit: "",
    delta: null,
    target: null,
    progress: null,
    context: "Each one counts",
  };

  // Inbox.
  const open = ix.inbox.filter((i) => !i.processed);
  const oldest = open.reduce<string | null>((o, i) => (o == null || i.createdAt < o ? i.createdAt : o), null);
  const ageDays = oldest ? Math.max(0, daysBetween(appDayOf(oldest), date)) : 0;
  const inboxBox: MetricBox = {
    key: "inbox",
    label: "Inbox",
    value: open.length,
    unit: "",
    delta: null,
    target: null,
    progress: null,
    context: open.length === 0 ? "Inbox zero" : ageDays === 0 ? "Oldest from today" : `Oldest ${ageDays} ${ageDays === 1 ? "day" : "days"} old`,
  };

  return [todayBox, shownBox, avgBox, p1Box, focusBox, screenBox, habitsBox, comebackBox, inboxBox];
}
