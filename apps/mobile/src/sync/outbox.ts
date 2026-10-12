import type { LocalStore, OutboxItem, SyncRowMap, SyncTable } from "@tatakae/core";
import { primaryKeyOf } from "@tatakae/core";
import { getDb } from "../db/client";

// LocalStore (packages/core/src/syncClient.ts) on expo-sqlite. Rows are stored as JSON under
// (tbl, pk) with updated_at / deleted_at copied out for cheap filtering. Same shape as the web store.

interface RowRecord {
  data: string;
}

function parseRow<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function parseRows<T>(records: readonly RowRecord[]): T[] {
  const out: T[] = [];
  for (const r of records) {
    const row = parseRow<T>(r.data);
    if (row) out.push(row);
  }
  return out;
}

export interface MobileStore extends LocalStore {
  /** Live rows whose top-level JSON `field` equals `value` (e.g. missions by dayDate). */
  getWhere<T extends SyncTable>(table: T, field: string, value: string | number | boolean | null): Promise<SyncRowMap[T][]>;
  deleteMeta(key: string): Promise<void>;
}

export const sqliteStore: MobileStore = {
  async get<T extends SyncTable>(table: T, pk: string): Promise<SyncRowMap[T] | null> {
    const rec = await getDb().getFirstAsync<RowRecord>("SELECT data FROM rows WHERE tbl = ? AND pk = ?", table, pk);
    return rec ? parseRow<SyncRowMap[T]>(rec.data) : null;
  },

  async getAll<T extends SyncTable>(table: T, opts?: { includeDeleted?: boolean }): Promise<SyncRowMap[T][]> {
    const sql = opts?.includeDeleted
      ? "SELECT data FROM rows WHERE tbl = ?"
      : "SELECT data FROM rows WHERE tbl = ? AND deleted_at IS NULL";
    return parseRows<SyncRowMap[T]>(await getDb().getAllAsync<RowRecord>(sql, table));
  },

  async getWhere<T extends SyncTable>(
    table: T,
    field: string,
    value: string | number | boolean | null,
  ): Promise<SyncRowMap[T][]> {
    if (!/^[A-Za-z0-9_]+$/.test(field)) throw new Error(`invalid field: ${field}`);
    const path = `$.${field}`;
    const records =
      value === null
        ? await getDb().getAllAsync<RowRecord>(
            "SELECT data FROM rows WHERE tbl = ? AND deleted_at IS NULL AND json_extract(data, ?) IS NULL",
            table,
            path,
          )
        : await getDb().getAllAsync<RowRecord>(
            "SELECT data FROM rows WHERE tbl = ? AND deleted_at IS NULL AND json_extract(data, ?) = ?",
            table,
            path,
            typeof value === "boolean" ? (value ? 1 : 0) : value,
          );
    return parseRows<SyncRowMap[T]>(records);
  },

  async put<T extends SyncTable>(table: T, row: SyncRowMap[T]): Promise<void> {
    const pk = primaryKeyOf(table, row);
    await getDb().runAsync(
      "INSERT OR REPLACE INTO rows (tbl, pk, data, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?)",
      table,
      pk,
      JSON.stringify(row),
      row.updatedAt,
      row.deletedAt ?? null,
    );
  },

  async enqueue(item: OutboxItem): Promise<void> {
    await getDb().runAsync(
      "INSERT OR REPLACE INTO outbox (id, json, created_at) VALUES (?, ?, ?)",
      item.id,
      JSON.stringify(item),
      new Date().toISOString(),
    );
  },

  async peekOutbox(limit: number): Promise<OutboxItem[]> {
    const records = await getDb().getAllAsync<{ json: string }>(
      "SELECT json FROM outbox ORDER BY rowid ASC LIMIT ?",
      Math.max(0, Math.floor(limit)),
    );
    const out: OutboxItem[] = [];
    for (const r of records) {
      const item = parseRow<OutboxItem>(r.json);
      if (item) out.push(item);
    }
    return out;
  },

  async removeOutbox(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = getDb();
    // Chunk to stay well under SQLite's bound-parameter limit.
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await db.runAsync(`DELETE FROM outbox WHERE id IN (${chunk.map(() => "?").join(",")})`, ...chunk);
    }
  },

  async countOutbox(): Promise<number> {
    const rec = await getDb().getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
    return rec?.n ?? 0;
  },

  async getMeta(key: string): Promise<string | null> {
    const rec = await getDb().getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", key);
    return rec?.value ?? null;
  },

  async setMeta(key: string, value: string): Promise<void> {
    await getDb().runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", key, value);
  },

  async deleteMeta(key: string): Promise<void> {
    await getDb().runAsync("DELETE FROM meta WHERE key = ?", key);
  },
};
