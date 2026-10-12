import {
  EDITABLE_FROM,
  isLockedChange,
  newId,
  nowIso,
  reschedule,
  validateForge,
  type Anchor,
  type Area,
  type Blocker,
  type StoryPack,
  type StoryRef,
  type WatchQueueItem,
  type Day,
  type DayPatch,
  type FocusSession,
  type ForgeProblem,
  type Habit,
  type ISODate,
  type InboxItem,
  type Mission,
  type MissionStatus,
  type RechargeItem,
  type SettingKey,
  type SettingValues,
  type Slot,
} from "@tatakae/core";
import { remove, store, write } from "../sync/engine";
import { missionsOn } from "./plan";
import { announceMoment } from "./story";

// Write helpers. Every write goes to IndexedDB + outbox first (optimistic) and syncs later.
// The server stays authoritative for the plan lock (forgedAt, locked mission fields).

export function blankDay(date: ISODate): Omit<Day, "updatedAt" | "deletedAt"> {
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

export type NewMission = Partial<Omit<Mission, "updatedAt" | "deletedAt">> & { title: string; slot: Slot };

export function blankMission(input: NewMission): Omit<Mission, "updatedAt" | "deletedAt"> {
  return {
    id: newId(),
    dayDate: null,
    points: null,
    status: input.slot === "backlog" ? "backlog" : "open",
    minimum: null,
    ifThen: null,
    resumeNote: null,
    goalId: null,
    estMin: null,
    actualMin: null,
    rescheduleCount: 0,
    ...input,
  };
}

// ---------- missions ----------

/** Status chip. "rescheduled" uses core reschedule(): original → rescheduled, copy → backlog. */
export async function setStatus(mission: Mission, status: MissionStatus): Promise<void> {
  if (status === "rescheduled") {
    await rescheduleMission(mission);
    return;
  }
  await write("missions", { ...mission, status });
  if (status === mission.status) return;
  if (status === "done" && mission.slot === "P1") void announceMoment("p1_done");
  else if (status === "minimum") void announceMoment("minimum_done");
}

export async function rescheduleMission(mission: Mission): Promise<void> {
  const [moved, copy] = reschedule(mission);
  await write("missions", moved);
  await write("missions", copy);
}

/** Create or update a mission. Pass lockReason when the change touches a locked plan. */
export async function upsertMission(m: Mission | NewMission, opts?: { lockReason?: string }): Promise<Mission> {
  const row = "updatedAt" in m ? m : blankMission(m);
  return write("missions", row, opts);
}

/** True when saving `next` over `prev` would change a locked (forged) plan and needs a reason. */
export function needsLockReason(prev: Mission | null, next: Mission, dayForged: boolean): boolean {
  return isLockedChange(prev, next, dayForged);
}

/** Locked edit with a typed reason; the server records it as a mura event for Sunday. */
export async function editLocked(mission: Mission, patch: Partial<Mission>, reason: string): Promise<Mission> {
  return write("missions", { ...mission, ...patch }, { lockReason: reason.trim() });
}

/** Free-field update (status, resumeNote, actualMin, estMin): never needs a reason. */
export async function patchMissionFree(
  mission: Mission,
  patch: Partial<Pick<Mission, "status" | "resumeNote" | "actualMin" | "estMin">>,
): Promise<void> {
  await write("missions", { ...mission, ...patch });
}

export async function deleteMission(mission: Mission, opts?: { lockReason?: string }): Promise<void> {
  await remove("missions", mission.id, opts);
}

/** Move a mission back to the backlog (unforged days only). */
export async function toBacklog(mission: Mission): Promise<void> {
  await write("missions", { ...mission, dayDate: null, slot: "backlog", status: "backlog" });
}

// ---------- days ----------

/** Patch a day row, creating it if needed. forgedAt is kept as-is (server-owned). */
export async function updateDay(date: ISODate, patch: DayPatch): Promise<Day> {
  const existing = await store.get("days", date);
  const base = existing ?? blankDay(date);
  const clean: Partial<Day> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) (clean as Record<string, unknown>)[k] = v;
  return write("days", { ...base, ...clean, forgedAt: base.forgedAt });
}

/**
 * Forge (lock) a day's plan: validates locally with core validateForge, then writes the day with
 * forgedAt = now. The server re-validates and sets the real timestamp (or answers with a conflict).
 */
export async function forge(date: ISODate): Promise<ForgeProblem[]> {
  const missions = missionsOn(await store.getAll("missions"), date);
  const problems = validateForge(missions);
  if (problems.length > 0) return problems;
  const existing = await store.get("days", date);
  await write("days", { ...(existing ?? blankDay(date)), forgedAt: nowIso() });
  return [];
}

/** Write-off day (max 2 per month, enforced by the server). The reason is kept in qDrift. */
export async function writeOff(date: ISODate, reason: string): Promise<void> {
  const existing = await store.get("days", date);
  const prev = existing?.qDrift?.trim();
  const note = `Write-off: ${reason.trim()}`;
  await updateDay(date, { kind: "write_off", qDrift: prev ? `${prev} · ${note}` : note });
}

// ---------- habits ----------

export async function logHabit(habitId: string, date: ISODate, done: boolean): Promise<void> {
  await write("habit_logs", { habitId, date, done });
}

export async function saveHabit(h: Partial<Habit> & { behaviour: string }): Promise<void> {
  await write("habits", {
    id: h.id ?? newId(),
    anchor: h.anchor ?? null,
    behaviour: h.behaviour,
    minimum: h.minimum ?? null,
    frequency: h.frequency ?? "daily",
    areaId: h.areaId ?? null,
    active: h.active ?? true,
  });
}

export async function removeHabit(id: string): Promise<void> {
  await remove("habits", id);
}

// ---------- inbox ----------

export async function capture(text: string): Promise<InboxItem | null> {
  const t = text.trim();
  if (!t) return null;
  return write("inbox", { id: newId(), text: t.slice(0, 1000), createdAt: nowIso(), processed: false });
}

export async function markProcessed(item: InboxItem, text?: string): Promise<void> {
  await write("inbox", { ...item, text: text ?? item.text, processed: true });
}

export async function discardInbox(item: InboxItem): Promise<void> {
  await remove("inbox", item.id);
}

/** Undo a discard / processing: the item comes back unprocessed. */
export async function restoreInbox(item: InboxItem): Promise<void> {
  await write("inbox", { ...item, processed: false, deletedAt: null });
}

export async function editInbox(item: InboxItem, text: string): Promise<void> {
  const t = text.trim();
  if (t) await write("inbox", { ...item, text: t.slice(0, 1000) });
}

/** Inbox item → mission (backlog, or a slot on a date) and mark the item processed. */
export async function inboxToMission(item: InboxItem, target: { dayDate: ISODate | null; slot: Slot }): Promise<void> {
  await upsertMission({ title: item.text.slice(0, 200), dayDate: target.dayDate, slot: target.slot });
  await markProcessed(item);
}

// ---------- stuck ----------

export async function logStuck(missionId: string, blocker: Blocker, unblocker: string | null): Promise<void> {
  await write("stuck_events", { id: newId(), missionId, blocker, unblocker: unblocker?.trim() || null, at: nowIso() });
  if (blocker === "fear") void announceMoment("stuck_fear");
  else if (blocker === "inertia") void announceMoment("stuck_inertia");
}

// ---------- focus sessions ----------

/** Start a focus block now. The area comes from the mission's goal when there is one. */
export async function startFocusSession(input: { missionId: string | null; plannedMin: number }): Promise<FocusSession> {
  let areaId: string | null = null;
  if (input.missionId) {
    const m = await store.get("missions", input.missionId);
    if (m?.goalId) areaId = (await store.get("goals", m.goalId))?.areaId ?? null;
  }
  return write("focus_sessions", {
    id: newId(),
    missionId: input.missionId,
    areaId,
    startedAt: nowIso(),
    endedAt: null,
    plannedMin: Math.max(1, Math.min(600, Math.round(input.plannedMin))),
    completed: false,
  });
}

/**
 * End a block. `completed` = it ran to the end (endedAt capped at the planned end). Adds the minutes to
 * the mission's actualMin. Returns the minutes counted.
 */
export async function endFocusSession(session: FocusSession, opts: { completed: boolean; now?: Date }): Promise<number> {
  const now = opts.now ?? new Date();
  const plannedEnd = Date.parse(session.startedAt) + session.plannedMin * 60_000;
  const endMs = Math.min(now.getTime(), plannedEnd);
  const endedAt = new Date(Math.max(endMs, Date.parse(session.startedAt))).toISOString();
  const stored = await write("focus_sessions", { ...session, endedAt, completed: opts.completed });
  const minutes = Math.max(0, Math.round((Date.parse(stored.endedAt ?? endedAt) - Date.parse(session.startedAt)) / 60_000));
  if (session.missionId && minutes > 0) {
    const m = await store.get("missions", session.missionId);
    if (m && m.deletedAt == null) await write("missions", { ...m, actualMin: (m.actualMin ?? 0) + minutes });
  }
  return minutes;
}

// ---------- areas, goals, story ----------

export async function saveArea(a: Partial<Area> & { name: string }): Promise<Area> {
  return write("areas", {
    id: a.id ?? newId(),
    name: a.name.trim(),
    standard: a.standard ?? null,
    why: a.why ?? null,
    alignmentScore: a.alignmentScore ?? null,
    color: a.color ?? null,
    icon: a.icon ?? null,
  });
}

export async function removeArea(id: string): Promise<void> {
  await remove("areas", id);
}

/** Import a validated reference pack: one story_refs row per entry (new ids; existing refs untouched). */
export async function importStoryPack(pack: StoryPack): Promise<number> {
  const existing = await store.getAll("story_refs");
  const seen = new Set(existing.map((r) => `${r.title}|${r.moment}|${r.lesson}`.toLowerCase()));
  let added = 0;
  for (const ref of pack.refs) {
    const key = `${ref.title}|${ref.moment}|${ref.lesson}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    await write("story_refs", { id: newId(), ...ref, muted: false, lastShownAt: null });
    added++;
  }
  return added;
}

export async function setStoryMuted(ref: StoryRef, muted: boolean): Promise<void> {
  await write("story_refs", { ...ref, muted });
}

export async function saveWatch(w: Omit<WatchQueueItem, "updatedAt" | "deletedAt">): Promise<void> {
  await write("watch_queue", w);
}

export async function removeWatch(title: string): Promise<void> {
  await remove("watch_queue", title);
}

// ---------- settings, anchors, recharge ----------

export async function saveSetting<K extends SettingKey>(key: K, value: SettingValues[K]): Promise<void> {
  await write("settings", { key, value: JSON.stringify(value), editableFrom: EDITABLE_FROM[key] ?? null });
}

export async function saveAnchor(a: Omit<Anchor, "id" | "updatedAt" | "deletedAt"> & { id?: string }): Promise<void> {
  await write("anchors", { ...a, id: a.id ?? newId() });
}

export async function removeAnchor(id: string): Promise<void> {
  await remove("anchors", id);
}

export async function saveRecharge(r: { id?: string; name: string; kind?: string | null }): Promise<void> {
  await write("recharge_items", { id: r.id ?? newId(), name: r.name.trim(), kind: r.kind ?? null });
}

export async function removeRecharge(id: string): Promise<void> {
  await remove("recharge_items", id);
}

export type { RechargeItem };
