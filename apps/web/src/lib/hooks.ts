import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_RECHARGE_ITEMS,
  DEFAULT_SETTINGS,
  SEED_UPDATED_AT,
  addDays,
  appDayOf,
  calendarDay,
  calendarMonth,
  cycleFor,
  cycleStats,
  daysShownUp,
  firstUseDate,
  habitGrid,
  indexStats,
  monthStats,
  scoreOn as statsScoreOn,
  scoreboard,
  series,
  weekStats,
  type Area,
  type FocusSession,
  type Goal,
  type SeriesMetric,
  type StatsIndex,
  type WatchQueueItem,
  type Experiment,
  type Review,
  type WeekStats,
  formatIsoWeek,
  isoWeek,
  monthRange,
  isMissedDay,
  istTimeHHMM,
  monthOf,
  readSettings,
  scoreDay,
  todayIST,
  type Anchor,
  type Day,
  type DayScore,
  type Habit,
  type HabitLog,
  type ISODate,
  type InboxItem,
  type Mission,
  type RechargeItem,
  type ResolvedSettings,
  type ScoringSettings,
  type SyncStatus,
  type SyncTable,
} from "@tatakae/core";
import { getSyncClient, localKey, store } from "../sync/engine";
import { anchorsFor, bySlot, freeMinutes, ifThenTemplates, isDayClosed, isDayStarted, missionsOn, plannedMinutes, writeOffsUsed } from "./plan";

// TanStack Query hooks that read from the LOCAL IndexedDB store (offline-first). The sync engine
// invalidates ["local", tables, …] keys when rows of those tables change. Write helpers live in
// ./actions and are re-exported here so screens import from one place.
export * from "./actions";
export * from "./fitnessData";

const NORMAL_DAY: Pick<Day, "kind" | "screenMin"> = { kind: "normal", screenMin: null };

// ---------- clock ----------

/** Current time, re-rendered every `intervalMs` and when the tab becomes visible. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    const onVis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);
  return now;
}

/** The app's today (IST, 04:00 boundary) — updates across the boundary. */
export function useToday(): ISODate {
  return todayIST(useNow());
}

/** Current IST wall-clock time "HH:MM". */
export function useIstTime(): string {
  return istTimeHHMM(useNow());
}

// ---------- shared loaders ----------

interface Snapshot {
  days: Map<ISODate, Day>;
  missionsByDate: Map<ISODate, Mission[]>;
  allMissions: Mission[];
  firstUse: ISODate | null;
  scoring: ScoringSettings;
}

async function loadSnapshot(): Promise<Snapshot> {
  const [days, missions, settingRows] = await Promise.all([
    store.getAll("days"),
    store.getAll("missions"),
    store.getAll("settings"),
  ]);
  const dayMap = new Map(days.map((d) => [d.date, d] as const));
  const byDate = new Map<ISODate, Mission[]>();
  for (const m of missions) {
    if (!m.dayDate || m.slot === "backlog") continue;
    const list = byDate.get(m.dayDate) ?? [];
    list.push(m);
    byDate.set(m.dayDate, list);
  }
  return {
    days: dayMap,
    missionsByDate: byDate,
    allMissions: missions,
    firstUse: firstUseDate(days),
    scoring: readSettings(settingRows).scoring,
  };
}

function missedOn(s: Snapshot, date: ISODate, today: ISODate): boolean {
  return isMissedDay(date, s.days.get(date) ?? null, s.missionsByDate.get(date) ?? [], { firstUseDate: s.firstUse, today }, s.scoring);
}

function scoreOn(s: Snapshot, date: ISODate, today: ISODate): DayScore {
  const day = s.days.get(date);
  return scoreDay(day ?? NORMAL_DAY, s.missionsByDate.get(date) ?? [], missedOn(s, addDays(date, -1), today), s.scoring);
}

const DAY_TABLES: readonly SyncTable[] = ["days", "missions", "settings"];

// ---------- day ----------

export interface DayView {
  date: ISODate;
  day: Day | null;
  missions: Mission[];
  slots: ReturnType<typeof bySlot>;
  score: DayScore;
  yesterdayMissed: boolean;
  forged: boolean;
  /** Ritual done for this day (tomorrow locked) or the day is past → score may be shown. */
  closed: boolean;
  started: boolean;
}

export function useDay(date: ISODate) {
  const today = useToday();
  return useQuery({
    queryKey: localKey(DAY_TABLES, "day", date, today),
    queryFn: async (): Promise<DayView> => {
      const s = await loadSnapshot();
      const day = s.days.get(date) ?? null;
      const missions = missionsOn(s.allMissions, date);
      return {
        date,
        day,
        missions,
        slots: bySlot(missions),
        score: scoreOn(s, date, today),
        yesterdayMissed: missedOn(s, addDays(date, -1), today),
        forged: day?.forgedAt != null,
        closed: isDayClosed(date, today, s.days.get(addDays(date, 1))?.forgedAt != null),
        started: isDayStarted(day, missions),
      };
    },
  });
}

/** Cumulative "days shown up" since first use. Never resets; today counts once it isn't a missed day. */
export function useDaysShownUp() {
  const today = useToday();
  return useQuery({
    queryKey: localKey(DAY_TABLES, "shown-up", today),
    queryFn: async (): Promise<{ count: number; since: ISODate | null }> => {
      const s = await loadSnapshot();
      if (!s.firstUse) return { count: 0, since: null };
      const scores: DayScore[] = [];
      for (let d = s.firstUse; d <= today; d = addDays(d, 1)) {
        const sc = scoreOn(s, d, today);
        if (d === today && sc.missedDay) continue; // today is still open
        scores.push(sc);
      }
      return { count: daysShownUp(scores), since: s.firstUse };
    },
  });
}

export interface HistoryDay {
  date: ISODate;
  kind: Day["kind"];
  missed: boolean;
  /** Before first use: nothing to show (hollow, no label). */
  beforeStart: boolean;
}

/** Last `n` days before today (oldest first) for the grey history on Welcome back. */
export function useRecentHistory(n = 7) {
  const today = useToday();
  return useQuery({
    queryKey: localKey(DAY_TABLES, "history", today, n),
    queryFn: async (): Promise<HistoryDay[]> => {
      const s = await loadSnapshot();
      const out: HistoryDay[] = [];
      for (let i = n; i >= 1; i--) {
        const date = addDays(today, -i);
        out.push({
          date,
          kind: s.days.get(date)?.kind ?? "normal",
          missed: missedOn(s, date, today),
          beforeStart: !s.firstUse || date < s.firstUse,
        });
      }
      return out;
    },
  });
}

/** Write-offs used in the month of `date`, and how many remain (scoring.writeOffsPerMonth). */
export function useWriteOffs(date: ISODate) {
  return useQuery({
    queryKey: localKey(["days", "settings"], "write-offs", monthOf(date)),
    queryFn: async () => {
      const [days, settingRows] = await Promise.all([store.getAll("days"), store.getAll("settings")]);
      const limit = readSettings(settingRows).scoring.writeOffsPerMonth;
      const used = writeOffsUsed(days, monthOf(date));
      return { used, limit, remaining: Math.max(0, limit - used) };
    },
  });
}

/** Previous P1 if-then plans (templates in the ritual and restart forms). */
export function useIfThenTemplates() {
  return useQuery({
    queryKey: localKey(["missions"], "if-then-templates"),
    queryFn: async () => ifThenTemplates(await store.getAll("missions")),
  });
}

export function useMission(id: string | null) {
  return useQuery({
    queryKey: localKey(["missions"], "mission", id),
    queryFn: async () => (id ? await store.get("missions", id) : null),
  });
}

// ---------- lists ----------

export function useBacklog() {
  return useQuery({
    queryKey: localKey(["missions"], "backlog"),
    queryFn: async (): Promise<Mission[]> =>
      (await store.getAll("missions"))
        .filter((m) => m.dayDate === null && m.slot === "backlog" && m.status === "backlog")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  });
}

export function useInbox() {
  return useQuery({
    queryKey: localKey(["inbox"], "open"),
    queryFn: async (): Promise<InboxItem[]> =>
      (await store.getAll("inbox")).filter((i) => !i.processed).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  });
}

export interface HabitsView {
  habits: Habit[];
  /** habitId → done on `date`. */
  done: Record<string, boolean>;
}

export function useHabits(date: ISODate) {
  return useQuery({
    queryKey: localKey(["habits", "habit_logs"], "habits", date),
    queryFn: async (): Promise<HabitsView> => {
      const [habits, logs] = await Promise.all([store.getAll("habits"), store.getAll("habit_logs")]);
      const done: Record<string, boolean> = {};
      for (const l of logs as HabitLog[]) if (l.date === date) done[l.habitId] = l.done;
      return { habits: habits.filter((h) => h.active).sort((a, b) => a.behaviour.localeCompare(b.behaviour)), done };
    },
  });
}

/** All habits incl. inactive (Settings). */
export function useAllHabits() {
  return useQuery({
    queryKey: localKey(["habits"], "all"),
    queryFn: async () => (await store.getAll("habits")).sort((a, b) => a.behaviour.localeCompare(b.behaviour)),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: localKey(["settings"], "resolved"),
    queryFn: async (): Promise<ResolvedSettings> => readSettings(await store.getAll("settings")),
    placeholderData: DEFAULT_SETTINGS,
  });
}

export function useAnchors() {
  return useQuery({
    queryKey: localKey(["anchors"], "all"),
    queryFn: async (): Promise<Anchor[]> =>
      (await store.getAll("anchors")).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  });
}

/** Recharge menu; falls back to the seeded defaults before the first sync. */
export function useRecharge() {
  return useQuery({
    queryKey: localKey(["recharge_items"], "all"),
    queryFn: async (): Promise<RechargeItem[]> => {
      const all = await store.getAll("recharge_items", { includeDeleted: true });
      if (all.length === 0) return DEFAULT_RECHARGE_ITEMS.map((r) => ({ ...r, updatedAt: SEED_UPDATED_AT, deletedAt: null }));
      return all.filter((r) => r.deletedAt == null).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

// ---------- stats (core stats.ts over the local store) ----------

const STATS_TABLES: readonly SyncTable[] = [
  "days",
  "missions",
  "settings",
  "focus_sessions",
  "habits",
  "habit_logs",
  "stuck_events",
  "inbox",
  "goals",
  "areas",
  "mura_events",
];

async function loadStats(today: ISODate): Promise<{ ix: StatsIndex; settings: ResolvedSettings }> {
  const [days, missions, settingRows, focusSessions, habits, habitLogs, stuckEvents, inbox, goals, areas, muraEvents] = await Promise.all([
    store.getAll("days"),
    store.getAll("missions"),
    store.getAll("settings"),
    store.getAll("focus_sessions"),
    store.getAll("habits"),
    store.getAll("habit_logs"),
    store.getAll("stuck_events"),
    store.getAll("inbox"),
    store.getAll("goals"),
    store.getAll("areas"),
    store.getAll("mura_events"),
  ]);
  const settings = readSettings(settingRows);
  const ix = indexStats(
    { days, missions, focusSessions, habits, habitLogs, stuckEvents, inbox, goals, areas, muraEvents },
    { today, scoring: settings.scoring },
  );
  return { ix, settings };
}

function useStats<T>(name: string, params: readonly unknown[], fn: (ix: StatsIndex, settings: ResolvedSettings) => T) {
  const today = useToday();
  return useQuery({
    queryKey: localKey(STATS_TABLES, "stats", name, today, ...params),
    queryFn: async (): Promise<T> => {
      const { ix, settings } = await loadStats(today);
      return fn(ix, settings);
    },
  });
}

export function useScoreboard(date?: ISODate) {
  return useStats("scoreboard", [date], (ix, s) => scoreboard(ix, { date, focusWeekTarget: s.focus_week_target }));
}

export function useCalendarMonth(yyyymm: string) {
  return useStats("calendar", [yyyymm], (ix) => calendarMonth(ix, yyyymm));
}

export function useSeries(metric: SeriesMetric, days: number) {
  return useStats("series", [metric, days], (ix) => series(ix, metric, days));
}

export function useWeekStats(week: { year: number; week: number }) {
  return useStats("week", [week.year, week.week], (ix) => weekStats(ix, week));
}

export function useMonthStats(yyyymm: string) {
  return useStats("month", [yyyymm], (ix) => monthStats(ix, yyyymm));
}

export function useCycleStats(date?: ISODate) {
  return useStats("cycle", [date], (ix) => {
    const cycle = cycleFor(date ?? ix.today);
    return { ...cycleStats(ix, cycle), index: cycle.index };
  });
}

/** Week stats for every ISO week touching a month (monthly review block chart). */
export function useMonthWeeks(yyyymm: string) {
  return useStats("month-weeks", [yyyymm], (ix) => {
    const { start, end } = monthRange(yyyymm);
    const out: WeekStats[] = [];
    for (let d = start; d <= end; d = addDays(d, 7)) out.push(weekStats(ix, isoWeek(d)));
    const last = isoWeek(end);
    if (!out.some((w) => w.week === formatIsoWeek(last))) out.push(weekStats(ix, last));
    return out;
  });
}

/** 30-day final-score sparkline series. */
export function useScoreSeries(days = 30) {
  return useStats("score-series", [days], (ix) => series(ix, "final", days));
}

export function useHabitGrid(days = 84) {
  return useStats("habit-grid", [days], (ix) => habitGrid(ix, days));
}

/** One calendar day (Day sheet / week strip). */
export function useCalendarDay(date: ISODate) {
  return useStats("calendar-day", [date], (ix) => ({ cal: calendarDay(ix, date), scored: statsScoreOn(ix, date) }));
}

// ---------- areas, goals, focus ----------

export function useAreas() {
  return useQuery({
    queryKey: localKey(["areas"], "all"),
    queryFn: async (): Promise<Area[]> => (await store.getAll("areas")).sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export function useGoals() {
  return useQuery({
    queryKey: localKey(["goals"], "all"),
    queryFn: async (): Promise<Goal[]> => (await store.getAll("goals")).sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export function useReviews() {
  return useQuery({
    queryKey: localKey(["reviews"], "all"),
    queryFn: async (): Promise<Review[]> =>
      (await store.getAll("reviews")).sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
  });
}

export function useExperiments() {
  return useQuery({
    queryKey: localKey(["experiments"], "all"),
    queryFn: async (): Promise<Experiment[]> => (await store.getAll("experiments")).sort((a, b) => b.start.localeCompare(a.start)),
  });
}

/** Lock-edit reasons (mura events) whose app day falls in [from, to], newest first. */
export function useMuraEvents(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: localKey(["mura_events", "missions"], "range", from, to),
    queryFn: async () => {
      const [events, missions] = await Promise.all([store.getAll("mura_events"), store.getAll("missions")]);
      return events
        .filter((e) => {
          const d = appDayOf(e.at);
          return d >= from && d <= to;
        })
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((e) => ({ ...e, title: missions.find((m) => m.id === e.missionId)?.title ?? "A mission" }));
    },
  });
}

/** Planned minutes vs budget per day (Muri): budget = capacityRatio × free minutes (wake → ritual − anchors). */
export function useCapacityRange(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: localKey(["missions", "anchors", "settings"], "capacity", from, to),
    queryFn: async () => {
      const [missions, anchors, settingRows] = await Promise.all([store.getAll("missions"), store.getAll("anchors"), store.getAll("settings")]);
      const s = readSettings(settingRows);
      const out: { date: ISODate; planned: number; budget: number }[] = [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const free = freeMinutes({ wakeTime: s.wake_time, ritualTime: s.ritual_time, anchors: anchorsFor(anchors, d) });
        out.push({ date: d, planned: plannedMinutes(missionsOn(missions, d)), budget: Math.floor(free * s.scoring.capacityRatio) });
      }
      return out;
    },
  });
}

export function useWatchQueue() {
  return useQuery({
    queryKey: localKey(["watch_queue"], "all"),
    queryFn: async (): Promise<WatchQueueItem[]> => (await store.getAll("watch_queue")).sort((a, b) => a.title.localeCompare(b.title)),
  });
}

/** Focus sessions whose app day falls in [from, to], oldest first. */
export function useFocusSessions(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: localKey(["focus_sessions"], "range", from, to),
    queryFn: async (): Promise<FocusSession[]> =>
      (await store.getAll("focus_sessions"))
        .filter((f) => {
          const d = appDayOf(f.startedAt);
          return d >= from && d <= to;
        })
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
  });
}

/** The running focus session (endedAt null), if any — newest first. */
export function useRunningFocus() {
  return useQuery({
    queryKey: localKey(["focus_sessions"], "running"),
    queryFn: async (): Promise<FocusSession | null> =>
      (await store.getAll("focus_sessions"))
        .filter((f) => f.endedAt === null)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null,
  });
}

/** Saved day rows in a date range, by date (forged state for the week planner). */
export function useDaysRange(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: localKey(["days"], "range", from, to),
    queryFn: async (): Promise<Record<ISODate, Day>> =>
      Object.fromEntries((await store.getAll("days")).filter((d) => d.date >= from && d.date <= to).map((d) => [d.date, d] as const)),
  });
}

/** Missions in a date range (week planner), live, any slot except backlog. */
export function useMissionsRange(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: localKey(["missions"], "range", from, to),
    queryFn: async (): Promise<Mission[]> =>
      (await store.getAll("missions")).filter((m) => m.dayDate != null && m.dayDate >= from && m.dayDate <= to && m.slot !== "backlog"),
  });
}

// ---------- sync status ----------

function subscribeSync(cb: () => void): () => void {
  return getSyncClient().subscribe(() => cb());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSync, () => getSyncClient().getStatus());
}

/** Short label for the sync dot (text always accompanies the colour). */
export function syncLabel(s: SyncStatus): string {
  if (s.error === "auth") return "Signed out — sign in to sync";
  if (s.state === "syncing") return "Syncing…";
  if (s.state === "offline") return s.pending > 0 ? `Offline · ${s.pending} waiting` : "Offline";
  if (s.state === "error") return s.pending > 0 ? `Sync paused · ${s.pending} waiting` : "Sync paused";
  return s.pending > 0 ? `${s.pending} waiting` : "Synced";
}
