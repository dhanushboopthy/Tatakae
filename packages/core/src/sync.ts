import type { ISOTime, Mission, SyncRowMap } from "./types";

// Pure sync helpers shared by web, mobile and api. No I/O. See docs/plans/overnight.md (Sync).

/** Every table that travels through POST /api/sync (SQL table names). Notes/sessions/etc. never sync. */
export const SYNC_TABLES = [
  // v1
  "days",
  "missions",
  "habits",
  "habit_logs",
  "anchors",
  "settings",
  "inbox",
  "mura_events",
  "focus_sessions",
  "stuck_events",
  "recharge_items",
  // v2
  "areas",
  "goals",
  "reviews",
  "experiments",
  "story_refs",
  "watch_queue",
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

/** Primary-key fields per synced table (camelCase row keys). Composite keys are joined with "|". */
export const SYNC_TABLE_PK: { readonly [T in SyncTable]: readonly (keyof SyncRowMap[T] & string)[] } = {
  days: ["date"],
  missions: ["id"],
  habits: ["id"],
  habit_logs: ["habitId", "date"],
  anchors: ["id"],
  settings: ["key"],
  inbox: ["id"],
  mura_events: ["id"],
  focus_sessions: ["id"],
  stuck_events: ["id"],
  recharge_items: ["id"],
  areas: ["id"],
  goals: ["id"],
  reviews: ["id"],
  experiments: ["id"],
  story_refs: ["id"],
  watch_queue: ["title"],
};

export function isSyncTable(table: string): table is SyncTable {
  return (SYNC_TABLES as readonly string[]).includes(table);
}

/** Stable string key of a row: `id`, or `date` (days), `key` (settings), `habitId|date`, `title` (watch_queue). */
export function primaryKeyOf(table: SyncTable, row: object): string {
  const fields: readonly string[] = SYNC_TABLE_PK[table];
  const rec = row as Record<string, unknown>;
  return fields
    .map((field) => {
      const v = rec[field];
      if (typeof v !== "string" || v === "") throw new Error(`${table}: missing primary key field ${field}`);
      return v;
    })
    .join("|");
}

/** Inverse of primaryKeyOf: `{ habitId, date }` from "habitId|date", etc. */
export function splitPrimaryKey(table: SyncTable, pk: string): Record<string, string> {
  const fields: readonly string[] = SYNC_TABLE_PK[table];
  const parts = fields.length === 1 ? [pk] : pk.split("|");
  const out: Record<string, string> = {};
  fields.forEach((f, i) => {
    out[f] = parts[i] ?? "";
  });
  return out;
}

/** Compare ISO timestamps by instant (tolerates "…Z" vs "….000Z"); falls back to string order. */
export function compareIso(a: ISOTime, b: ISOTime): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a < b ? -1 : a > b ? 1 : 0;
  return ta - tb;
}

/**
 * Client-side last-write-wins: returns the row to keep. `remote` is the server's copy, so on a tie
 * the remote/server row wins (the server already decided; keeping it makes all devices converge).
 */
export function mergeLww<T extends { updatedAt: ISOTime }>(local: T, remote: T): T {
  return compareIso(remote.updatedAt, local.updatedAt) >= 0 ? remote : local;
}

/**
 * Server-side LWW: apply an incoming client row only if there is no server row or it is strictly
 * newer. Ties go to the server (→ conflict).
 */
export function shouldApplyIncoming(
  server: { updatedAt: ISOTime } | null | undefined,
  incoming: { updatedAt: ISOTime },
): boolean {
  return server == null || compareIso(incoming.updatedAt, server.updatedAt) > 0;
}

/** Mission fields frozen once the mission's day is forged (changing them needs a lock reason → mura event). */
export const LOCKED_MISSION_FIELDS = ["title", "slot", "points", "minimum", "ifThen", "dayDate"] as const satisfies readonly (keyof Mission)[];
/** Mission fields that stay editable on a forged day. */
export const FREE_MISSION_FIELDS = ["status", "resumeNote", "actualMin", "estMin", "rescheduleCount"] as const satisfies readonly (keyof Mission)[];

/**
 * True when a write needs the server's plan-lock handling instead of plain LWW:
 * - any `days` row (forgedAt is server-owned; a client may only *request* a forge);
 * - a `missions` row whose `dayDate` is forged. With `forgedDates` omitted, any mission with a
 *   non-null dayDate is treated as possibly locked (caller must look the day up).
 * The API should also check the *previous* row's dayDate (moving a mission off a forged day).
 */
export function isServerAuthoritative(
  table: string,
  row: object,
  forgedDates?: ReadonlySet<string> | readonly string[],
): boolean {
  if (table === "days") return true;
  if (table !== "missions") return false;
  const dayDate = (row as Record<string, unknown>)["dayDate"];
  if (typeof dayDate !== "string") return false;
  if (!forgedDates) return true;
  return "has" in forgedDates ? forgedDates.has(dayDate) : forgedDates.includes(dayDate);
}

/**
 * Does `prev → next` change a locked plan? `forged` = the previous OR next dayDate is forged.
 * Locked: creating a mission on a forged day, (soft-)deleting one, or changing a LOCKED_MISSION_FIELD.
 * Changes to free fields only (status, resumeNote, …) are never locked.
 */
export function isLockedChange(prev: Mission | null, next: Mission, forged: boolean): boolean {
  if (!forged) return false;
  if (prev === null || prev.deletedAt != null) return next.deletedAt == null; // create (or revive)
  if (next.deletedAt != null) return true; // delete
  return LOCKED_MISSION_FIELDS.some((f) => prev[f] !== next[f]);
}
