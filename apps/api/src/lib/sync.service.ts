import { eq } from "drizzle-orm";
import {
  EDITABLE_FROM,
  isSettingKey,
  parseSettingValue,
  primaryKeyOf,
  rowSchemas,
  shouldApplyIncoming,
  validateForge,
  type Day,
  type Goal,
  type Mission,
  type OutboxItem,
  type SettingRow,
  type SyncConflict,
  type SyncRequest,
  type SyncResponse,
} from "@tatakae/core";
import { syncItems } from "../../../../db/schema";
import { transaction, type Db } from "./db";
import { missionsOn, scoringSettings, writeOffsUsed } from "./days.service";
import { goalProblem } from "./goals.service";
import { isLockedWrite, recordMura } from "./missions.service";
import { getRow, listChangedSince, upsertRow } from "./rows.service";
import { isSettingWritable } from "./settings.service";

// POST /api/sync (shared design, docs/plans/overnight.md → Sync). One transaction per request:
// apply outbox items in order (each in its own savepoint), then pull changes since the cursor.
// Every item ends up in `applied` or `conflicts`; a conflict carries the server's current row
// (null when there is none, e.g. a rejected create), which the client stores as-is.

type Rec = Record<string, unknown>;
type ItemResult = { ok: true } | { ok: false; server: Rec | null };

const OK: ItemResult = { ok: true };
const conflict = (server: object | null): ItemResult => ({ ok: false, server: server as Rec | null });

function seen(db: Db, id: string): boolean {
  return db.select({ id: syncItems.id }).from(syncItems).where(eq(syncItems.id, id)).get() !== undefined;
}

function markSeen(db: Db, id: string, now: Date): void {
  db.insert(syncItems).values({ id, at: now.toISOString() }).onConflictDoNothing().run();
}

function serverRowOf(db: Db, item: OutboxItem): Rec | null {
  try {
    return getRow(db, item.table, primaryKeyOf(item.table, item.row)) as Rec | null;
  } catch {
    return null;
  }
}

/**
 * days: forgedAt is server-owned. A client may request a forge (forgedAt non-null while the
 * server's is null): validated with core validateForge and stamped with server time. Once forged,
 * it stays forged. Write-offs beyond the monthly limit keep the previous kind. A rejected forge or
 * write-off still stores the other fields and answers with a conflict carrying the stored row,
 * so the client converges without losing its answers.
 */
function applyDay(db: Db, incoming: Day, server: Day | null, now: Date): ItemResult {
  const next: Day = { ...incoming };
  let rejected = false;

  if (server?.forgedAt) {
    next.forgedAt = server.forgedAt;
  } else if (incoming.forgedAt) {
    if (validateForge(missionsOn(db, incoming.date)).length > 0) {
      next.forgedAt = null;
      rejected = true;
    } else {
      next.forgedAt = now.toISOString();
    }
  }

  const prevKind = server && server.deletedAt == null ? server.kind : "normal";
  if (next.kind === "write_off" && prevKind !== "write_off") {
    if (writeOffsUsed(db, incoming.date) >= scoringSettings(db).writeOffsPerMonth) {
      next.kind = prevKind;
      rejected = true;
    }
  }

  const stored = upsertRow(db, "days", next);
  return rejected ? conflict(stored) : OK;
}

/** missions: locked changes on a forged day need meta.lockReason (→ mura event), else conflict. */
function applyMission(db: Db, incoming: Mission, server: Mission | null, item: OutboxItem, now: Date): ItemResult {
  if (isLockedWrite(db, server, incoming)) {
    const reason = item.meta?.lockReason?.trim();
    if (!reason) return conflict(server);
    upsertRow(db, "missions", incoming);
    recordMura(db, incoming.id, reason, now);
    return OK;
  }
  upsertRow(db, "missions", incoming);
  return OK;
}

/** settings: even-Sunday guard, known keys validated, editableFrom stays server-owned. */
function applySetting(db: Db, incoming: SettingRow, server: SettingRow | null, now: Date): ItemResult {
  const key = incoming.key;
  if (!isSettingWritable(key, server, now)) return conflict(server);
  if (isSettingKey(key) && incoming.deletedAt == null) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(incoming.value);
    } catch {
      return conflict(server);
    }
    if (!parseSettingValue(key, decoded).ok) return conflict(server);
  }
  const editableFrom = server?.editableFrom ?? (isSettingKey(key) ? (EDITABLE_FROM[key] ?? null) : incoming.editableFrom);
  upsertRow(db, "settings", { ...incoming, editableFrom });
  return OK;
}

function applyItem(db: Db, item: OutboxItem, now: Date): ItemResult {
  const table = item.table;
  let pk: string;
  try {
    pk = primaryKeyOf(table, item.row);
  } catch {
    return conflict(null);
  }
  const server = getRow(db, table, pk);
  const rowUpdatedAt = item.row["updatedAt"];
  const updatedAt = typeof rowUpdatedAt === "string" ? rowUpdatedAt : item.updatedAt;
  const candidate: Rec =
    item.op === "delete"
      ? { ...((server as Rec | null) ?? {}), ...item.row, updatedAt, deletedAt: updatedAt }
      : { deletedAt: null, ...item.row, updatedAt };

  const parsed = rowSchemas[table].safeParse(candidate);
  if (!parsed.success) {
    // Deleting a row the server never saw (created and removed offline): nothing to do.
    if (item.op === "delete" && server === null) return OK;
    return conflict(server);
  }
  const incoming = parsed.data;
  if (!shouldApplyIncoming(server, incoming)) return conflict(server);

  switch (table) {
    case "days":
      return applyDay(db, incoming as Day, server as Day | null, now);
    case "missions":
      return applyMission(db, incoming as Mission, server as Mission | null, item, now);
    case "settings":
      return applySetting(db, incoming as SettingRow, server as SettingRow | null, now);
    case "goals":
      if (goalProblem(db, incoming as Goal, server as Goal | null)) return conflict(server);
      upsertRow(db, "goals", incoming);
      return OK;
    default:
      upsertRow(db, table, incoming);
      return OK;
  }
}

/** Apply outbox items (LWW + plan lock + guards, idempotent by item id) and pull changes since the cursor. */
export function applySync(db: Db, req: SyncRequest, now: Date = new Date()): SyncResponse {
  return transaction(db, () => {
    const applied: string[] = [];
    const conflicts: SyncConflict[] = [];

    for (const item of req.items) {
      if (seen(db, item.id)) {
        applied.push(item.id);
        continue;
      }
      let res: ItemResult;
      try {
        res = transaction(db, () => applyItem(db, item, now)); // savepoint: a failing item rolls back alone
      } catch (err) {
        console.error(`[sync] item ${item.id} (${item.table}) failed:`, err);
        res = conflict(serverRowOf(db, item));
      }
      if (res.ok) {
        markSeen(db, item.id, now);
        applied.push(item.id);
      } else {
        conflicts.push({ id: item.id, server: res.server });
      }
    }

    const pull = listChangedSince(db, req.cursor);
    return {
      applied,
      conflicts,
      changes: pull.changes.map((c) => ({ table: c.table, row: c.row as unknown as Rec })),
      cursor: pull.cursor,
    };
  });
}
