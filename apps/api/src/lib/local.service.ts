import { getTableColumns, getTableName, type Column } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../../../../db/schema";
import { sqliteOf, type Db } from "./db";

// Row store for the REST-only tables (v3: notes, files, applications, stories, japanese_log).
// They are never synced, so writes skip the change log. Same column-metadata SQL as rows.service;
// rows in and out are the raw Drizzle select shapes (JSON columns stay text; callers decode).

export const LOCAL_TABLES = {
  notes: schema.notes,
  files: schema.files,
  applications: schema.applications,
  stories: schema.stories,
  japanese_log: schema.japaneseLog,
} as const satisfies Record<string, SQLiteTable>;

export type LocalTable = keyof typeof LOCAL_TABLES;
export type LocalRow<T extends LocalTable> = (typeof LOCAL_TABLES)[T]["$inferSelect"];

interface ColMeta {
  key: string;
  name: string;
  column: Column;
}
interface TableMeta {
  cols: ColMeta[];
  selectById: string;
  selectAll: string;
  upsert: string;
}

const q = (ident: string): string => `"${ident.replace(/"/g, '""')}"`;
const metaCache = new Map<LocalTable, TableMeta>();

function tableMeta(table: LocalTable): TableMeta {
  const cached = metaCache.get(table);
  if (cached) return cached;
  const t: SQLiteTable = LOCAL_TABLES[table];
  const columns = getTableColumns(t) as Record<string, Column>;
  const cols: ColMeta[] = Object.entries(columns).map(([key, column]) => ({ key, name: column.name, column }));
  const sqlName = q(getTableName(t));
  const meta: TableMeta = {
    cols,
    selectById: `SELECT * FROM ${sqlName} WHERE "id" = ?`,
    selectAll: `SELECT * FROM ${sqlName}`,
    upsert:
      `INSERT INTO ${sqlName} (${cols.map((c) => q(c.name)).join(", ")}) ` +
      `VALUES (${cols.map(() => "?").join(", ")}) ` +
      `ON CONFLICT ("id") DO UPDATE SET ` +
      cols
        .filter((c) => c.key !== "id")
        .map((c) => `${q(c.name)} = excluded.${q(c.name)}`)
        .join(", "),
  };
  metaCache.set(table, meta);
  return meta;
}

function fromDb<T extends LocalTable>(table: T, raw: Record<string, unknown>): LocalRow<T> {
  const out: Record<string, unknown> = {};
  for (const c of tableMeta(table).cols) {
    const v = raw[c.name];
    out[c.key] = v === null || v === undefined ? null : c.column.mapFromDriverValue(v);
  }
  return out as LocalRow<T>;
}

export function getLocal<T extends LocalTable>(db: Db, table: T, id: string): LocalRow<T> | null {
  const raw = sqliteOf(db).prepare(tableMeta(table).selectById).get(id);
  return raw ? fromDb(table, raw as Record<string, unknown>) : null;
}

/** Every row (soft-deleted included unless `includeDeleted: false`). */
export function allLocal<T extends LocalTable>(db: Db, table: T, opts: { includeDeleted?: boolean } = {}): LocalRow<T>[] {
  const meta = tableMeta(table);
  const sql = opts.includeDeleted === false ? `${meta.selectAll} WHERE "deleted_at" IS NULL` : meta.selectAll;
  return sqliteOf(db)
    .prepare(sql)
    .all()
    .map((raw) => fromDb(table, raw as Record<string, unknown>));
}

/** Insert or replace by id. The caller validates (zod) before building the row. */
export function putLocal<T extends LocalTable>(db: Db, table: T, row: LocalRow<T>): LocalRow<T> {
  const rec = row as Record<string, unknown>;
  const values = tableMeta(table).cols.map((c) => {
    const v = rec[c.key];
    return v === null || v === undefined ? null : c.column.mapToDriverValue(v);
  });
  sqliteOf(db).prepare(tableMeta(table).upsert).run(...values);
  return row;
}

/** Parse a JSON-array text column; anything else becomes []. */
export function jsonArray(text: string | null): unknown[] {
  if (!text) return [];
  try {
    const v: unknown = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** JSON-array column of strings (tags). */
export function stringArray(text: string | null): string[] {
  return jsonArray(text).filter((v): v is string => typeof v === "string");
}
