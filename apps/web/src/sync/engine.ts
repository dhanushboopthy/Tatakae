import type { QueryClient } from "@tanstack/react-query";
import {
  SyncHttpError,
  createSyncClient,
  type RowWrite,
  type SyncClient,
  type SyncRequest,
  type SyncResponse,
  type SyncRowMap,
  type SyncTable,
} from "@tatakae/core";
import { notifyUnauthorized } from "../lib/api";
import { recordConflict } from "../lib/conflicts";
import { platform, requestPersistentStorage } from "../lib/platform";
import { onSessionEvent } from "../lib/session";
import { createIdbStore } from "./outbox";

// Web sync engine: core's createSyncClient over IndexedDB + fetch POST /api/sync.
// Flushes on load, tab visible, focus, online and 2 s after every write; invalidates TanStack Query
// keys of the tables that changed. Android/Chromium Background Sync (tag "outbox") pokes open tabs.

export const store = createIdbStore();

/** Query keys for local-store reads: ["local", tables, ...params]. onChange invalidates by table. */
export function localKey(tables: readonly SyncTable[], ...params: readonly unknown[]): readonly unknown[] {
  return ["local", tables, ...params];
}

let qcRef: QueryClient | null = null;
let client: SyncClient | null = null;

async function post(req: SyncRequest): Promise<SyncResponse> {
  const res = await fetch("/api/sync", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  }); // a network failure throws a TypeError → the client reports "offline"
  if (!res.ok) throw new SyncHttpError(res.status);
  // Validated by the sync client (syncResponse.safeParse) before use.
  return (await res.json()) as SyncResponse;
}

function invalidate(tables: ReadonlySet<SyncTable>): void {
  void qcRef?.invalidateQueries({
    predicate: (q) => {
      const [scope, keyTables] = q.queryKey;
      return scope === "local" && Array.isArray(keyTables) && keyTables.some((t) => tables.has(t as SyncTable));
    },
  });
}

export function getSyncClient(): SyncClient {
  client ??= createSyncClient({
    store,
    client: "web",
    post,
    onChange: invalidate,
    onAuthError: notifyUnauthorized,
    onConflict: recordConflict,
  });
  return client;
}

async function registerBackgroundSync(): Promise<void> {
  if (!platform.hasBackgroundSync()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as unknown as { sync?: { register(tag: string): Promise<void> } }).sync;
    await sync?.register("outbox");
  } catch {
    /* not supported or denied: the online/visibility listeners still flush */
  }
}

/** Optimistic write through the outbox (see core SyncClient.write). */
export async function write<T extends SyncTable>(
  table: T,
  row: RowWrite<T>,
  opts?: { lockReason?: string },
): Promise<SyncRowMap[T]> {
  const stored = await getSyncClient().write(table, row, opts);
  void registerBackgroundSync();
  return stored;
}

/** Soft delete through the outbox. */
export async function remove(table: SyncTable, pk: string, opts?: { lockReason?: string }): Promise<void> {
  await getSyncClient().remove(table, pk, opts);
  void registerBackgroundSync();
}

/** "Sync now". */
export function flushNow(): Promise<void> {
  return getSyncClient().flush();
}

let started = false;

/** Called once from main.tsx. */
export function initSync(qc: QueryClient): void {
  qcRef = qc;
  if (started || typeof window === "undefined") return;
  started = true;
  const c = getSyncClient();
  c.start();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void c.flush();
  });
  window.addEventListener("focus", () => void c.flush());
  window.addEventListener("online", () => c.start());

  onSessionEvent((event) => {
    if (event === "login") c.start();
    else c.stop();
  });

  // Background Sync: the service worker posts { type: "flush-outbox" } to open tabs.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e: MessageEvent<unknown>) => {
      const data = e.data;
      if (typeof data === "object" && data !== null && (data as { type?: unknown }).type === "flush-outbox") void c.flush();
    });
  }

  void firstRun();
}

/** Ask for persistent storage once, so the browser doesn't evict the outbox under pressure. */
async function firstRun(): Promise<void> {
  try {
    if ((await store.getMeta("persist_requested")) !== null) return;
    const granted = await requestPersistentStorage();
    await store.setMeta("persist_requested", granted ? "granted" : "denied");
  } catch {
    /* IndexedDB unavailable (private mode): the app still renders, writes will fail visibly */
  }
}
