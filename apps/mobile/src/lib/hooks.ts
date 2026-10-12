import { useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_RECHARGE_ITEMS,
  addDays,
  daysShownUp,
  firstUseDate,
  isLockedChange,
  isMissedDay,
  istTimeHHMM,
  monthOf,
  newId,
  nowIso,
  readSettings,
  reschedule,
  scoreDay,
  slotRank,
  todayIST,
  type Day,
  type DayKind,
  type DayScore,
  type Habit,
  type ISODate,
  type InboxItem,
  type Mission,
  type MissionStatus,
  type RechargeItem,
  type ResolvedSettings,
  type Slot,
  type SyncStatus,
} from "@tatakae/core";
import { sqliteStore as store } from "../sync/outbox";
import { LOCAL, getStatus, notifyLocalChange, subscribe, write } from "../sync/engine";
import { focusedMinutes, newSession, parseSession, pause, resume, type FocusSession } from "../focus/timer";

// TanStack Query hooks over the LOCAL store (never the network) + optimistic mutation helpers.
// Query keys: [LOCAL, [tables read…], name, …args]; the sync engine invalidates by table.
// Device-only state (focus session, morning/close flags) lives in `meta` under pseudo-tables
// "meta:focus" and "meta:flags".

const FOCUS_KEY = "focus";
export const sortMissions = (ms: readonly Mission[]): Mission[] =>
  [...ms].sort((a, b) => slotRank(a.slot) - slotRank(b.slot) || a.title.localeCompare(b.title));

export type DayFields = Omit<Day, "date" | "forgedAt" | "updatedAt" | "deletedAt">;

export function emptyDay(date: ISODate): Omit<Day, "updatedAt" | "deletedAt"> {
  return {
    date,
    kind: "normal",
    screenMin: null,
    smallWin: null,
    qP1: null,
    qDrift: null,
    qPractised: null,
    intention: null,
    energy: null,
    forgedAt: null,
  };
}

// ===================== today =====================

/** The app's "today" (IST, 04:00 boundary). Re-checks every minute and when the app comes back. */
export function useToday(): ISODate {
  const [today, setToday] = useState<ISODate>(() => todayIST());
  useEffect(() => {
    const tick = () => setToday(todayIST());
    const id = setInterval(tick, 60_000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") tick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return today;
}

// ===================== settings =====================

async function loadSettings(): Promise<ResolvedSettings> {
  return readSettings(await store.getAll("settings"));
}

export function useSettings() {
  return useQuery({ queryKey: [LOCAL, ["settings"], "settings"], queryFn: loadSettings });
}

// ===================== day =====================

export interface DayView {
  date: ISODate;
  day: Day | null;
  /** Live missions planned for the date (no backlog), P1 → side. Rescheduled ones stay (greyed). */
  missions: Mission[];
  p1: Mission | null;
  score: DayScore;
  yesterdayMissed: boolean;
  firstUseDate: ISODate | null;
  /** Plan locked by the night ritual (days.forgedAt). Locked fields then need a reason. */
  forged: boolean;
  settings: ResolvedSettings;
}

async function missionsOn(date: ISODate): Promise<Mission[]> {
  const ms = await store.getWhere("missions", "dayDate", date);
  return sortMissions(ms.filter((m) => m.slot !== "backlog"));
}

async function loadDay(date: ISODate): Promise<DayView> {
  const [settings, allDays, missions] = await Promise.all([loadSettings(), store.getAll("days"), missionsOn(date)]);
  const day = allDays.find((d) => d.date === date) ?? null;
  const first = firstUseDate(allDays);
  const yesterday = addDays(date, -1);
  const yDay = allDays.find((d) => d.date === yesterday) ?? null;
  const yMissions = await missionsOn(yesterday);
  const yesterdayMissed = isMissedDay(yesterday, yDay, yMissions, { firstUseDate: first, today: todayIST() }, settings.scoring);
  const score = scoreDay(day ?? emptyDay(date), missions, yesterdayMissed, settings.scoring);
  const p1 = missions.find((m) => m.slot === "P1" && m.status !== "rescheduled") ?? null;
  return { date, day, missions, p1, score, yesterdayMissed, firstUseDate: first, forged: day?.forgedAt != null, settings };
}

export function useDay(date: ISODate) {
  return useQuery({ queryKey: [LOCAL, ["days", "missions", "settings"], "day", date], queryFn: () => loadDay(date) });
}

export function useMission(id: string | null | undefined) {
  return useQuery({
    queryKey: [LOCAL, ["missions"], "mission", id ?? ""],
    queryFn: async () => (id ? await store.get("missions", id) : null),
  });
}

// ===================== history / days shown up =====================

export interface HistoryDay {
  date: ISODate;
  kind: DayKind;
  missed: boolean;
  score: DayScore | null;
}

interface History {
  days: HistoryDay[];
  shownUp: number;
}

const MAX_HISTORY_DAYS = 3660;

async function loadHistory(today: ISODate): Promise<History> {
  const [settings, allDays, allMissions] = await Promise.all([loadSettings(), store.getAll("days"), store.getAll("missions")]);
  const first = firstUseDate(allDays);
  const dayBy = new Map(allDays.map((d) => [d.date, d] as const));
  const msBy = new Map<ISODate, Mission[]>();
  for (const m of allMissions) {
    if (!m.dayDate || m.slot === "backlog") continue;
    const list = msBy.get(m.dayDate);
    if (list) list.push(m);
    else msBy.set(m.dayDate, [m]);
  }
  const out: HistoryDay[] = [];
  if (first !== null && first <= today) {
    let d = first;
    for (let i = 0; i < MAX_HISTORY_DAYS && d <= today; i++, d = addDays(d, 1)) {
      const day = dayBy.get(d) ?? null;
      const ms = msBy.get(d) ?? [];
      const has = day !== null || ms.length > 0;
      if (d === today && !has) break; // today has not happened yet
      const missed = isMissedDay(d, day, ms, { firstUseDate: first, today }, settings.scoring);
      const score = has ? scoreDay(day ?? emptyDay(d), ms, false, settings.scoring) : null;
      out.push({ date: d, kind: day?.kind ?? "normal", missed, score });
    }
  }
  // An in-progress today only counts once it is no longer a missed day.
  const scores: DayScore[] = out.map(
    (h) =>
      h.score ?? {
        excluded: false,
        planned: 0,
        earned: 0,
        exec: 0,
        penalty: 0,
        bonus: 0,
        final: 0,
        mark: "Unplanned",
        missedDay: h.missed,
      },
  );
  return { days: out, shownUp: daysShownUp(scores) };
}

function useHistoryQuery() {
  const today = useToday();
  return useQuery({ queryKey: [LOCAL, ["days", "missions", "settings"], "history", today], queryFn: () => loadHistory(today) });
}

/** Cumulative "days shown up". Never resets. */
export function useDaysShownUp() {
  const q = useHistoryQuery();
  return { ...q, data: q.data?.shownUp };
}

/** The last `n` days before today (oldest first), for the grey history on Welcome back. */
export function useRecentDays(n = 7) {
  const today = useToday();
  const q = useHistoryQuery();
  const byDate = new Map((q.data?.days ?? []).map((h) => [h.date, h] as const));
  const days: HistoryDay[] = [];
  for (let i = n; i >= 1; i--) {
    const d = addDays(today, -i);
    days.push(byDate.get(d) ?? { date: d, kind: "normal", missed: false, score: null });
  }
  return { ...q, data: q.data ? days : undefined };
}

// ===================== habits / inbox / recharge =====================

export interface HabitToday {
  habit: Habit;
  done: boolean;
}

export function useHabits(date: ISODate) {
  return useQuery({
    queryKey: [LOCAL, ["habits", "habit_logs"], "habits", date],
    queryFn: async (): Promise<HabitToday[]> => {
      const [habits, logs] = await Promise.all([store.getAll("habits"), store.getWhere("habit_logs", "date", date)]);
      const done = new Set(logs.filter((l) => l.done).map((l) => l.habitId));
      return habits
        .filter((h) => h.active)
        .sort((a, b) => a.behaviour.localeCompare(b.behaviour))
        .map((habit) => ({ habit, done: done.has(habit.id) }));
    },
  });
}

export function useInbox() {
  return useQuery({
    queryKey: [LOCAL, ["inbox"], "inbox"],
    queryFn: async (): Promise<InboxItem[]> =>
      (await store.getAll("inbox")).filter((i) => !i.processed).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
}

export function useRecharge() {
  return useQuery({
    queryKey: [LOCAL, ["recharge_items"], "recharge"],
    queryFn: async (): Promise<Pick<RechargeItem, "id" | "name" | "kind">[]> => {
      const rows = await store.getAll("recharge_items");
      return rows.length > 0 ? rows.sort((a, b) => a.name.localeCompare(b.name)) : [...DEFAULT_RECHARGE_ITEMS];
    },
  });
}

// ===================== sync status =====================

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getStatus, getStatus);
}

// ===================== device flags (meta, not synced) =====================

export interface DayFlags {
  /** Any focus block or Done/Minimum today. */
  started: boolean;
  p1Started: boolean;
  morningDeferred: boolean;
  welcomed: boolean;
  closed: boolean;
}

const flagKey = (date: ISODate, flag: keyof DayFlags) => `day:${date}:${flag}`;

export function useDayFlags(date: ISODate) {
  return useQuery({
    queryKey: [LOCAL, ["meta:flags"], "flags", date],
    queryFn: async (): Promise<DayFlags> => {
      const get = async (f: keyof DayFlags) => (await store.getMeta(flagKey(date, f))) === "1";
      const [started, p1Started, morningDeferred, welcomed, closed] = await Promise.all([
        get("started"),
        get("p1Started"),
        get("morningDeferred"),
        get("welcomed"),
        get("closed"),
      ]);
      return { started, p1Started, morningDeferred, welcomed, closed };
    },
  });
}

export async function getDayFlag(date: ISODate, flag: keyof DayFlags): Promise<boolean> {
  return (await store.getMeta(flagKey(date, flag))) === "1";
}

export async function setDayFlag(date: ISODate, flag: keyof DayFlags): Promise<void> {
  await store.setMeta(flagKey(date, flag), "1");
  notifyLocalChange(["meta:flags"]);
}

async function markStarted(date: ISODate | null, isP1: boolean): Promise<void> {
  if (!date) return;
  await store.setMeta(flagKey(date, "started"), "1");
  if (isP1) await store.setMeta(flagKey(date, "p1Started"), "1");
  notifyLocalChange(["meta:flags"]);
}

// ===================== home routing =====================

export type HomeRedirect = "/welcome-back" | "/morning" | null;

/**
 * Shared design: missed yesterday and nothing started today → Welcome back; phone before noon with
 * P1 open (or no plan yet) and not started/deferred → Morning; otherwise stay on Today.
 */
export function homeRedirect(view: DayView, flags: DayFlags, now: Date = new Date()): HomeRedirect {
  const anyHit = view.missions.some((m) => m.status === "done" || m.status === "minimum");
  const nothingStarted = !flags.started && !anyHit;
  if (view.day?.kind === "rest" || view.day?.kind === "write_off") return null;
  if (view.yesterdayMissed && nothingStarted && !flags.welcomed) return "/welcome-back";
  const hhmm = istTimeHHMM(now);
  const morning = hhmm >= "04:00" && hhmm < "12:00";
  const p1Open = view.p1 === null || view.p1.status === "open";
  if (morning && p1Open && !flags.p1Started && !flags.morningDeferred) return "/morning";
  return null;
}

// ===================== mutations (optimistic, through the outbox) =====================

export function isLocked(m: Mission, view: Pick<DayView, "forged" | "date">): boolean {
  return view.forged && m.dayDate === view.date;
}

/** Status chips. Status is a free field, so no lock reason is ever needed. */
export async function setStatus(m: Mission, status: MissionStatus): Promise<void> {
  if (status === "rescheduled") {
    await rescheduleMission(m);
    return;
  }
  await write("missions", { ...m, status });
  if (status === "done" || status === "minimum") await markStarted(m.dayDate, m.slot === "P1");
}

/** Reschedule chip: original → rescheduled, a backlog copy carries the count (core reschedule). */
export async function rescheduleMission(m: Mission): Promise<void> {
  const [moved, copy] = reschedule(m);
  await write("missions", moved);
  await write("missions", copy);
}

export type MissionEdit = Partial<Pick<Mission, "title" | "minimum" | "ifThen" | "resumeNote">>;

/**
 * Edit a mission. On a forged day, a change to a locked field needs a typed reason, sent as the
 * outbox lockReason; the server records it as a mura event for Sunday.
 */
export async function saveMission(
  m: Mission,
  patch: MissionEdit,
  view: Pick<DayView, "forged" | "date">,
  reason?: string,
): Promise<{ ok: true } | { ok: false; needsReason: true }> {
  const next: Mission = { ...m, ...patch };
  if (isLocked(m, view) && isLockedChange(m, next, true)) {
    const r = reason?.trim() ?? "";
    if (r.length < 3) return { ok: false, needsReason: true };
    await editLocked(m, patch, r);
    return { ok: true };
  }
  await write("missions", next);
  return { ok: true };
}

/** Locked edit with a reason (≥ 3 chars) → mura event on the server. */
export async function editLocked(m: Mission, patch: MissionEdit, reason: string): Promise<void> {
  await write("missions", { ...m, ...patch }, { lockReason: reason.trim() });
}

export interface P1Fields {
  title: string;
  minimum: string;
  ifThen: string;
}

/** Morning empty state / Welcome back Restart: plan only P1 for `date`. */
export async function planP1(date: ISODate, f: P1Fields, opts?: { lockReason?: string }): Promise<Mission> {
  const row = {
    id: newId(),
    title: f.title.trim(),
    dayDate: date,
    slot: "P1" as const,
    points: null,
    status: "open" as const,
    minimum: f.minimum.trim() || null,
    ifThen: f.ifThen.trim() || null,
    resumeNote: null,
    goalId: null,
    estMin: null,
    actualMin: null,
    rescheduleCount: 0,
  };
  return write("missions", row, opts?.lockReason ? { lockReason: opts.lockReason } : undefined);
}

export async function logHabit(habitId: string, date: ISODate, done: boolean): Promise<void> {
  await write("habit_logs", { habitId, date, done });
}

export async function capture(textIn: string): Promise<InboxItem | null> {
  const t = textIn.trim();
  if (!t) return null;
  return write("inbox", { id: newId(), text: t.slice(0, 1000), createdAt: nowIso(), processed: false });
}

/** Patch a day row (created if missing). forgedAt is never set from here (server-owned). */
export async function updateDay(date: ISODate, patch: Partial<DayFields>): Promise<Day> {
  const existing = await store.get("days", date);
  const base = existing ?? emptyDay(date);
  const clean: Partial<DayFields> = {};
  for (const [k, v] of Object.entries(patch) as [keyof DayFields, DayFields[keyof DayFields] | undefined][]) {
    if (v !== undefined) (clean as Record<string, unknown>)[k] = v;
  }
  return write("days", { ...base, ...clean, date, forgedAt: existing?.forgedAt ?? null });
}

/**
 * Write off a missed day with a reason (max per month from settings, default 2; the server enforces
 * it too). The reason goes into days.qDrift, the "what made me drift" field Sunday reviews read.
 */
export async function writeOff(
  date: ISODate,
  reason: string,
  settings: ResolvedSettings,
): Promise<{ ok: true } | { ok: false; reason: "limit" }> {
  const month = monthOf(date);
  const used = (await store.getAll("days")).filter((d) => d.kind === "write_off" && monthOf(d.date) === month && d.date !== date).length;
  if (used >= settings.scoring.writeOffsPerMonth) return { ok: false, reason: "limit" };
  await updateDay(date, { kind: "write_off", qDrift: reason.trim() });
  return { ok: true };
}

export async function writeOffsLeft(date: ISODate, settings: ResolvedSettings): Promise<number> {
  const month = monthOf(date);
  const used = (await store.getAll("days")).filter((d) => d.kind === "write_off" && monthOf(d.date) === month).length;
  return Math.max(0, settings.scoring.writeOffsPerMonth - used);
}

// ===================== focus session (meta "focus") =====================

export function useFocusSession() {
  return useQuery({
    queryKey: [LOCAL, ["meta:focus"], "focus"],
    queryFn: async (): Promise<FocusSession | null> => parseSession(await store.getMeta(FOCUS_KEY)),
  });
}

async function saveFocus(s: FocusSession | null): Promise<void> {
  if (s) await store.setMeta(FOCUS_KEY, JSON.stringify(s));
  else await store.deleteMeta(FOCUS_KEY);
  notifyLocalChange(["meta:focus"]);
}

export async function startFocus(missionId: string, length: number): Promise<FocusSession> {
  const s = newSession(missionId, length);
  await saveFocus(s);
  const m = await store.get("missions", missionId);
  if (m) await markStarted(m.dayDate, m.slot === "P1");
  return s;
}

export async function pauseFocus(): Promise<void> {
  const s = parseSession(await store.getMeta(FOCUS_KEY));
  if (s) await saveFocus(pause(s));
}

export async function resumeFocus(): Promise<void> {
  const s = parseSession(await store.getMeta(FOCUS_KEY));
  if (s) await saveFocus(resume(s));
}

/**
 * End the block: adds focused minutes to missions.actualMin, saves the resume note and an optional
 * Done/Minimum status (all free fields), then clears the session.
 */
export async function stopFocus(opts: { resumeNote?: string | null; status?: "done" | "minimum" } = {}): Promise<number> {
  const s = parseSession(await store.getMeta(FOCUS_KEY));
  if (!s) return 0;
  const minutes = focusedMinutes(s);
  const m = await store.get("missions", s.missionId);
  if (m && m.deletedAt == null) {
    const note = opts.resumeNote?.trim();
    await write("missions", {
      ...m,
      actualMin: (m.actualMin ?? 0) + minutes,
      ...(note ? { resumeNote: note.slice(0, 500) } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    });
  }
  await saveFocus(null);
  return minutes;
}
