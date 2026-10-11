import { openDB } from "idb";

export interface OutboxItem {
  id: string;
  table: string;
  op: "upsert" | "delete";
  row: Record<string, unknown>;
  updatedAt: string;
}

export const dbPromise = () =>
  openDB("tatakae", 1, {
    upgrade(db) {
      db.createObjectStore("outbox", { keyPath: "id" });
      db.createObjectStore("cache");       // last server snapshot per query key
      db.createObjectStore("meta");        // sync cursor, persist flag
    },
  });

export async function enqueue(item: OutboxItem): Promise<void> {
  // TODO(v1)
}

export async function drain(limit = 500): Promise<OutboxItem[]> {
  // TODO(v1)
  return [];
}
