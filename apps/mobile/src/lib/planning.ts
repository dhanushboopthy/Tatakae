import { useQuery } from "@tanstack/react-query";
import {
  AFTER_P1,
  RITUAL_RESTART,
  firstFreeSlot,
  ifThenTemplates,
  newId,
  nowIso,
  validateForge,
  missionsOn,
  type Anchor,
  type ForgeProblem,
  type Goal,
  type ISODate,
  type InboxItem,
  type Mission,
  type Slot,
} from "@tatakae/core";
import { sqliteStore as store } from "../sync/outbox";
import { LOCAL, flush, notifyLocalChange, remove, write } from "../sync/engine";
import { ApiError, apiPost } from "../api/client";
import { emptyDay } from "./hooks";

// Planning on the phone: everything the night ritual (and later Inbox triage and the week planner) writes.
// Every write goes through the outbox (optimistic, works offline). The server stays authoritative for the
// plan lock: forgedAt is set here optimistically and re-validated on sync.

// ---------- reads ----------

export function useAnchors() {
  return useQuery({
    queryKey: [LOCAL, ["anchors"], "anchors"],
    queryFn: async (): Promise<Anchor[]> => (await store.getAll("anchors")).filter((a) => a.deletedAt == null),
  });
}

/** Backlog missions (no day yet), oldest first, so what keeps being pushed back shows up. */
export function useBacklog() {
  return useQuery({
    queryKey: [LOCAL, ["missions"], "backlog"],
    queryFn: async (): Promise<Mission[]> =>
      (await store.getAll("missions"))
        .filter((m) => m.deletedAt == null && m.slot === "backlog")
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
  });
}

export function useIfThenTemplates() {
  return useQuery({
    queryKey: [LOCAL, ["missions"], "if-then-templates"],
    queryFn: async (): Promise<string[]> => ifThenTemplates(await store.getAll("missions")),
  });
}

/** Missions planned on a date (live, no backlog), P1 → side; read straight from the local store. */
export async function missionsFor(date: ISODate): Promise<Mission[]> {
  return missionsOn(await store.getAll("missions"), date);
}

// ---------- missions ----------

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

/** Create or update a mission. Pass lockReason when the change touches a locked plan. */
export async function upsertMission(m: Mission | NewMission, opts?: { lockReason?: string }): Promise<Mission> {
  const row = "updatedAt" in m ? m : blankMission(m);
  return write("missions", row, opts);
}

/** Free-field update (resume note, estimate, actual minutes): never needs a reason. */
export async function patchMissionFree(m: Mission, patch: Partial<Pick<Mission, "status" | "resumeNote" | "actualMin" | "estMin">>): Promise<void> {
  await write("missions", { ...m, ...patch });
}

export async function deleteMission(m: Mission, opts?: { lockReason?: string }): Promise<void> {
  await remove("missions", m.id, opts);
}

/** Move a mission back to the backlog (unlocked days only). */
export async function toBacklog(m: Mission): Promise<void> {
  await write("missions", { ...m, dayDate: null, slot: "backlog", status: "backlog" });
}

// ---------- the plan lock ----------

/**
 * Lock a day's plan (the night ritual's last step). Validates with core `validateForge`, then writes the day with
 * forgedAt = now; the server re-validates and sets the real timestamp. Returns the problems, if any.
 */
export async function forge(date: ISODate): Promise<ForgeProblem[]> {
  const problems = validateForge(await missionsFor(date));
  if (problems.length > 0) return problems;
  const existing = await store.get("days", date);
  await write("days", { ...(existing ?? emptyDay(date)), forgedAt: nowIso() });
  return [];
}

export type RestartOutcome = "ok" | "offline" | "used" | "limit" | "failed";

/**
 * Unlock a locked plan so the ritual can be redone. Deliberately hard (the screen asks for a reason, a pause, the
 * word and a hold); the server allows it once per plan and a limited number of times a week, and needs a connection.
 */
export async function restartRitual(date: ISODate, reason: string): Promise<RestartOutcome> {
  try {
    await apiPost(`/days/${date}/restart`, { reason: reason.trim(), confirm: RITUAL_RESTART.word });
    await flush();
    notifyLocalChange(["days", "missions"]);
    return "ok";
  } catch (e) {
    if (e instanceof ApiError && e.status !== 0) {
      const code = typeof e.body === "object" && e.body !== null ? (e.body as { error?: unknown }).error : null;
      if (code === "restart_used") return "used";
      if (code === "restart_limit") return "limit";
      return "failed";
    }
    return "offline";
  }
}

// ---------- ritual progress (device only, not synced) ----------

export interface RitualProgress {
  step: number;
  reached: number;
  freeMin: number | null;
}
const EMPTY: RitualProgress = { step: 0, reached: 0, freeMin: null };
const progressKey = (date: ISODate) => `ritual:${date}`;

export async function loadRitualProgress(date: ISODate): Promise<RitualProgress> {
  try {
    const raw = await store.getMeta(progressKey(date));
    const v = raw ? (JSON.parse(raw) as Partial<RitualProgress>) : null;
    return v ? { step: Number(v.step) || 0, reached: Number(v.reached) || 0, freeMin: typeof v.freeMin === "number" ? v.freeMin : null } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export async function saveRitualProgress(date: ISODate, p: RitualProgress): Promise<void> {
  await store.setMeta(progressKey(date), JSON.stringify(p));
}

// ---------- inbox ----------

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

/** Make an inbox item a mission (backlog, or the first free slot after P1 on a date) and mark it processed. */
export async function inboxToMission(
  item: InboxItem,
  input: { title: string; dayDate: ISODate | null; slot: Slot },
  opts?: { lockReason?: string },
): Promise<void> {
  await upsertMission({ title: input.title.trim().slice(0, 200), dayDate: input.dayDate, slot: input.slot }, opts);
  await markProcessed(item);
}

/** First free slot after P1 on a date (null = every slot taken), from the local store. */
export async function nextFreeSlot(date: ISODate): Promise<Slot | null> {
  return firstFreeSlot(await missionsFor(date), AFTER_P1);
}

// ---------- goals (Cycle) ----------

export function useGoals() {
  return useQuery({
    queryKey: [LOCAL, ["goals"], "goals"],
    queryFn: async (): Promise<Goal[]> => (await store.getAll("goals")).filter((g) => g.deletedAt == null).sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export async function saveGoal(g: Omit<Goal, "id" | "updatedAt" | "deletedAt"> & { id?: string }): Promise<Goal> {
  return write("goals", { ...g, id: g.id ?? newId() });
}

export async function removeGoal(id: string): Promise<void> {
  await remove("goals", id);
}
