import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import type { QueryClient } from "@tanstack/react-query";
import {
  createSyncClient,
  SyncHttpError,
  type RowWrite,
  type SyncClient,
  type SyncRequest,
  type SyncResponse,
  type SyncRowMap,
  type SyncStatus,
  type SyncTable,
} from "@tatakae/core";
import { API_URL } from "../config";
import { getToken } from "../auth/session";
import { handleUnauthorized } from "../api/client";
import { sqliteStore } from "./outbox";

/**
 * Phone sync engine = core's createSyncClient on the SQLite store.
 * Flushes: 2 s after each write (core), on AppState → active, when the app goes to the background,
 * on NetInfo reconnect, and opportunistically from expo-background-task (Android decides when).
 * Every local change invalidates the TanStack Query caches that read the affected tables.
 */

export const BACKGROUND_SYNC_TASK = "tatakae-background-sync";
const POST_TIMEOUT_MS = 30_000;

// ---------- change fan-out (query cache + listeners such as notification rescheduling) ----------

/** Query keys that read local data look like ["local", [tables…], …]. */
export const LOCAL = "local";

let queryClient: QueryClient | null = null;
const changeListeners = new Set<(tables: ReadonlySet<string>) => void>();

/** Tell caches and listeners that local data changed. Also used for device-only "meta" state. */
export function notifyLocalChange(tables: Iterable<string>): void {
  const set = new Set(tables);
  if (set.size === 0) return;
  void queryClient?.invalidateQueries({
    predicate: (q) => {
      const [scope, deps] = q.queryKey;
      return scope === LOCAL && Array.isArray(deps) && deps.some((t) => typeof t === "string" && set.has(t));
    },
  });
  for (const l of changeListeners) l(set);
}

export function addChangeListener(listener: (tables: ReadonlySet<string>) => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

// ---------- transport ----------

async function post(req: SyncRequest): Promise<SyncResponse> {
  const token = await getToken();
  if (!token) throw new SyncHttpError(401, "no session");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), POST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new SyncHttpError(res.status);
  // Shape is validated by the core client (syncResponse.safeParse).
  return (await res.json()) as SyncResponse;
}

// ---------- client singleton ----------

let client: SyncClient | null = null;

export function getSyncClient(): SyncClient {
  if (!client) {
    client = createSyncClient({
      store: sqliteStore,
      client: "mobile",
      post,
      onChange: (tables) => notifyLocalChange(tables),
      onAuthError: () => {
        void handleUnauthorized();
      },
    });
  }
  return client;
}

// ---------- public API used by hooks and screens ----------

export function write<T extends SyncTable>(table: T, row: RowWrite<T>, opts?: { lockReason?: string }): Promise<SyncRowMap[T]> {
  return getSyncClient().write(table, row, opts);
}

export function remove(table: SyncTable, pk: string, opts?: { lockReason?: string }): Promise<void> {
  return getSyncClient().remove(table, pk, opts);
}

export function flush(): Promise<void> {
  return getSyncClient().flush();
}

export function getStatus(): SyncStatus {
  return getSyncClient().getStatus();
}

export function subscribe(listener: (s: SyncStatus) => void): () => void {
  return getSyncClient().subscribe(listener);
}

// ---------- background task (must be defined at module scope) ----------

/** Extra work after a background flush (notifications register this to reschedule). */
let afterBackgroundFlush: (() => Promise<void>) | null = null;
export function setAfterBackgroundFlush(fn: (() => Promise<void>) | null): void {
  afterBackgroundFlush = fn;
}

try {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      if (!(await getToken())) return BackgroundTask.BackgroundTaskResult.Success;
      await getSyncClient().flush();
      await afterBackgroundFlush?.();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
} catch {
  // Native module missing (e.g. Expo Go); foreground sync still works.
}

async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) return;
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: 30 });
  } catch {
    // Best effort only.
  }
}

// ---------- lifecycle ----------

/** Start syncing for a signed-in session. Returns cleanup (call on logout / unmount). */
export function initSync(qc: QueryClient): () => void {
  queryClient = qc;
  const sync = getSyncClient();
  sync.start();

  let appState: AppStateStatus = AppState.currentState;
  const appSub = AppState.addEventListener("change", (next) => {
    if (next === "active" && appState !== "active") sync.start();
    else if (next === "background" && appState === "active") void sync.flush(); // push before suspension
    appState = next;
  });

  let wasOffline = false;
  const netOff = NetInfo.addEventListener((s) => {
    const offline = s.isConnected === false;
    if (wasOffline && !offline) sync.start();
    wasOffline = offline;
  });

  void registerBackgroundSync();

  return () => {
    appSub.remove();
    netOff();
    sync.stop();
  };
}
