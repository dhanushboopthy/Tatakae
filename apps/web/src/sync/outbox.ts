import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { primaryKeyOf, type LocalStore, type OutboxItem, type SyncRowMap, type SyncTable } from "@tatakae/core";

// IndexedDB implementation of core's LocalStore (shared design: generic row store + outbox + meta).
//   rows   key [tbl, pk] → { tbl, pk, data, updatedAt, deletedAt }, index "tbl"
//   outbox auto-increment seq (keeps insertion order) → { id, item }, unique index "byId"
//   meta   key → string (sync cursor, first-run flags)

interface StoredRow {
  tbl: SyncTable;
  pk: string;
  data: Record<string, unknown>;
  updatedAt: string;
  deletedAt: string | null;
}

interface QueuedItem {
  seq?: number;
  id: string;
  item: OutboxItem;
}

interface TatakaeDB extends DBSchema {
  rows: { key: [string, string]; value: StoredRow; indexes: { tbl: string } };
  outbox: { key: number; value: QueuedItem; indexes: { byId: string } };
  meta: { key: string; value: string };
}

const DB_NAME = "tatakae";
const DB_VERSION = 2;

let dbp: Promise<IDBPDatabase<TatakaeDB>> | null = null;

export function openLocalDb(): Promise<IDBPDatabase<TatakaeDB>> {
  dbp ??= openDB<TatakaeDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // v1 (skeleton) had outbox keyed by id + an unused "cache" store; nothing real was stored.
      const raw = db as unknown as IDBPDatabase;
      if (oldVersion < 2) {
        for (const name of ["outbox", "cache"]) if (raw.objectStoreNames.contains(name)) raw.deleteObjectStore(name);
        const rows = db.createObjectStore("rows", { keyPath: ["tbl", "pk"] });
        rows.createIndex("tbl", "tbl");
        const outbox = db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
        outbox.createIndex("byId", "id", { unique: true });
        if (!raw.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      }
    },
    blocking() {
      // A newer tab wants to upgrade: close so it can, then reload on next use.
      void dbp?.then((db) => db.close());
      dbp = null;
    },
  });
  return dbp;
}

export function createIdbStore(): LocalStore {
  return {
    async get<T extends SyncTable>(table: T, pk: string): Promise<SyncRowMap[T] | null> {
      const rec = await (await openLocalDb()).get("rows", [table, pk]);
      return rec ? (rec.data as unknown as SyncRowMap[T]) : null;
    },

    async getAll<T extends SyncTable>(table: T, opts?: { includeDeleted?: boolean }): Promise<SyncRowMap[T][]> {
      const recs = await (await openLocalDb()).getAllFromIndex("rows", "tbl", table);
      const kept = opts?.includeDeleted ? recs : recs.filter((r) => r.deletedAt == null);
      return kept.map((r) => r.data as unknown as SyncRowMap[T]);
    },

    async put<T extends SyncTable>(table: T, row: SyncRowMap[T]): Promise<void> {
      const data = row as unknown as Record<string, unknown>;
      await (await openLocalDb()).put("rows", {
        tbl: table,
        pk: primaryKeyOf(table, row),
        data,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt ?? null,
      });
    },

    async enqueue(item: OutboxItem): Promise<void> {
      await (await openLocalDb()).add("outbox", { id: item.id, item });
    },

    async peekOutbox(limit: number): Promise<OutboxItem[]> {
      const recs = await (await openLocalDb()).getAll("outbox", undefined, limit);
      return recs.map((r) => r.item);
    },

    async removeOutbox(ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return;
      const tx = (await openLocalDb()).transaction("outbox", "readwrite");
      const byId = tx.store.index("byId");
      for (const id of ids) {
        const key = await byId.getKey(id);
        if (key !== undefined) await tx.store.delete(key);
      }
      await tx.done;
    },

    async countOutbox(): Promise<number> {
      return (await openLocalDb()).count("outbox");
    },

    async getMeta(key: string): Promise<string | null> {
      return (await (await openLocalDb()).get("meta", key)) ?? null;
    },

    async setMeta(key: string, value: string): Promise<void> {
      await (await openLocalDb()).put("meta", value, key);
    },
  };
}
