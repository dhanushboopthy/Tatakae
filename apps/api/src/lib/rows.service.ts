import { getTableColumns, getTableName, type Column } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import {
  primaryKeyOf,
  rowSchemas,
  splitPrimaryKey,
  SYNC_TABLE_PK,
  SYNC_TABLES,
  type SyncRowMap,
  type SyncTable,
} from "@tatakae/core";
import * as schema from "../../../../db/schema";
import { sqliteOf, type Db } from "./db";

// Generic row store over the synced tables. Every REST and sync write goes through upsertRow(),
// which validates the row with core's rowSchemas and appends to the `changes` log, so pulls see
// every server-side change. Rows in and out use camelCase keys (Drizzle property names) with
// real booleans; SQL is generated from the Drizzle column metadata.

/** Synced table name → Drizzle table. */
export const TABLES = {
  days: schema.days,
  missions: schema.missions,
  habits: schema.habits,
  habit_logs: schema.habitLogs,
  anchors: schema.anchors,
  settings: schema.settings,
  inbox: schema.inbox,
  mura_events: schema.muraEvents,
  focus_sessions: schema.focusSessions,
  stuck_events: schema.stuckEvents,
  recharge_items: schema.rechargeItems,
  areas: schema.areas,
  goals: schema.goals,
  reviews: schema.reviews,
  experiments: schema.experiments,
  story_refs: schema.storyRefs,
  watch_queue: schema.watchQueue,
} as const satisfies Record<SyncTable, SQLiteTable>;

export type Row<T extends SyncTable> = SyncRowMap[T];
export type Change = { [T in SyncTable]: { table: T; row: Row<T> } }[SyncTable];

interface ColMeta {
  key: string;
  name: string;
  column: Column;
}
interface TableMeta {
  sqlName: string;
  cols: ColMeta[];
  selectByPk: string;
  selectAll: string;
  upsert: string;
}

const q = (ident: string): string => `"${ident.replace(/"/g, '""')}"`;
const metaCache = new Map<SyncTable, TableMeta>();

function tableMeta(table: SyncTable): TableMeta {
  const cached = metaCache.get(table);
  if (cached) return cached;
  const t: SQLiteTable = TABLES[table];
  const columns = getTableColumns(t) as Record<string, Column>;
  const cols: ColMeta[] = Object.entries(columns).map(([key, column]) => ({ key, name: column.name, column }));
  const pkKeys: readonly string[] = SYNC_TABLE_PK[table];
  const pk = pkKeys.map((k) => {
    const col = cols.find((c) => c.key === k);
    if (!col) throw new Error(`${table}: primary key column ${k} missing from schema`);
    return col;
  });
  const nonPk = cols.filter((c) => !pk.includes(c));
  const sqlName = q(getTableName(t));
  const meta: TableMeta = {
    sqlName,
    cols,
    selectByPk: `SELECT * FROM ${sqlName} WHERE ${pk.map((c) => `${q(c.name)} = ?`).join(" AND ")}`,
    selectAll: `SELECT * FROM ${sqlName}`,
    upsert:
      `INSERT INTO ${sqlName} (${cols.map((c) => q(c.name)).join(", ")}) ` +
      `VALUES (${cols.map(() => "?").join(", ")}) ` +
      `ON CONFLICT (${pk.map((c) => q(c.name)).join(", ")}) DO UPDATE SET ` +
      nonPk.map((c) => `${q(c.name)} = excluded.${q(c.name)}`).join(", "),
  };
  metaCache.set(table, meta);
  return meta;
}

function fromDb<T extends SyncTable>(table: T, raw: Record<string, unknown>): Row<T> {
  const out: Record<string, unknown> = {};
  for (const c of tableMeta(table).cols) {
    const v = raw[c.name];
    out[c.key] = v === null || v === undefined ? null : c.column.mapFromDriverValue(v);
  }
  return out as unknown as Row<T>; // written through rowSchemas, so the shape is trusted
}

function toDb(table: SyncTable, row: Record<string, unknown>): unknown[] {
  return tableMeta(table).cols.map((c) => {
    const v = row[c.key];
    return v === null || v === undefined ? null : c.column.mapToDriverValue(v);
  });
}

function asRecord(row: unknown): Record<string, unknown> {
  return row as Record<string, unknown>;
}

/**
 * updatedAt for a server-side (REST) write: now, but always strictly after the previous value so
 * the write wins LWW on every client even if a device clock ran ahead.
 */
export function bumpUpdatedAt(prev: string | null | undefined, now: Date = new Date()): string {
  const prevMs = prev ? Date.parse(prev) : Number.NaN;
  const ms = Number.isNaN(prevMs) ? now.getTime() : Math.max(now.getTime(), prevMs + 1);
  return new Date(ms).toISOString();
}

/** Drop keys whose value is undefined (zod partials), so spreading a patch never erases fields. */
export function withoutUndefined<T extends object>(obj: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as { [K in keyof T]?: Exclude<T[K], undefined> };
}

/** Current row by primary key (see core primaryKeyOf), soft-deleted rows included. */
export function getRow<T extends SyncTable>(db: Db, table: T, pk: string): Row<T> | null {
  const parts = splitPrimaryKey(table, pk);
  const keys: readonly string[] = SYNC_TABLE_PK[table];
  const raw = sqliteOf(db)
    .prepare(tableMeta(table).selectByPk)
    .get(...keys.map((k) => parts[k] ?? ""));
  return raw ? fromDb(table, asRecord(raw)) : null;
}

/** Every row of a table (soft-deleted included unless `includeDeleted: false`). */
export function allRows<T extends SyncTable>(db: Db, table: T, opts: { includeDeleted?: boolean } = {}): Row<T>[] {
  const meta = tableMeta(table);
  const sql = opts.includeDeleted === false ? `${meta.selectAll} WHERE "deleted_at" IS NULL` : meta.selectAll;
  return sqliteOf(db)
    .prepare(sql)
    .all()
    .map((raw) => fromDb(table, asRecord(raw)));
}

/** Append to the change log (cursor = seq). */
export function recordChange(db: Db, table: SyncTable, pk: string, at: string = new Date().toISOString()): number {
  const res = sqliteOf(db).prepare(`INSERT INTO "changes" ("tbl", "pk", "at") VALUES (?, ?, ?)`).run(table, pk, at);
  return Number(res.lastInsertRowid);
}

/**
 * Validate (core rowSchemas; unknown keys are dropped), insert-or-update by primary key and record
 * the change. Throws ZodError on an invalid row (→ 400 over REST). Returns the stored row.
 */
export function upsertRow<T extends SyncTable>(db: Db, table: T, row: unknown): Row<T> {
  const parsed = rowSchemas[table].parse(row) as Row<T>;
  const pk = primaryKeyOf(table, parsed);
  sqliteOf(db)
    .prepare(tableMeta(table).upsert)
    .run(...toDb(table, asRecord(parsed)));
  recordChange(db, table, pk);
  return parsed;
}

/** Soft delete: deletedAt = updatedAt = at. Returns the stored row, or null if missing. */
export function softDeleteRow<T extends SyncTable>(db: Db, table: T, pk: string, at: string): Row<T> | null {
  const prev = getRow(db, table, pk);
  if (!prev) return null;
  return upsertRow(db, table, { ...prev, updatedAt: at, deletedAt: at });
}

/** Highest change seq ("0" when the log is empty). */
export function currentCursor(db: Db): string {
  const raw = sqliteOf(db).prepare(`SELECT COALESCE(MAX("seq"), 0) AS "seq" FROM "changes"`).get();
  const seq = raw ? Number(asRecord(raw)["seq"]) : 0;
  return String(Number.isFinite(seq) ? seq : 0);
}

function parseCursor(cursor: string | null): number | null {
  if (cursor === null || !/^\d+$/.test(cursor)) return null;
  const n = Number(cursor);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Pull: current rows for every distinct (tbl, pk) changed after `cursor`. A null/invalid cursor,
 * or one ahead of the log (e.g. after a restore), returns a full snapshot of all synced tables
 * with soft-deleted rows. Call inside a transaction so rows and cursor are consistent.
 */
export function listChangedSince(db: Db, cursor: string | null): { changes: Change[]; cursor: string } {
  const next = currentCursor(db);
  const since = parseCursor(cursor);
  const out: Change[] = [];

  if (since === null || since > Number(next)) {
    for (const table of SYNC_TABLES) {
      for (const row of allRows(db, table)) out.push({ table, row } as Change);
    }
    return { changes: out, cursor: next };
  }

  const changed = sqliteOf(db)
    .prepare(`SELECT "tbl", "pk", MAX("seq") AS "seq" FROM "changes" WHERE "seq" > ? GROUP BY "tbl", "pk" ORDER BY 3`)
    .all(since);
  for (const raw of changed) {
    const rec = asRecord(raw);
    const table = rec["tbl"];
    const pk = rec["pk"];
    if (typeof table !== "string" || typeof pk !== "string") continue;
    if (!(SYNC_TABLES as readonly string[]).includes(table)) continue;
    const row = getRow(db, table as SyncTable, pk);
    if (row) out.push({ table: table as SyncTable, row } as Change);
  }
  return { changes: out, cursor: next };
}
