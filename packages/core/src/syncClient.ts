import { syncResponse, type ClientKind, type OutboxItem, type SyncRequest, type SyncResponse } from "./schemas";
import { compareIso, primaryKeyOf, type SyncTable } from "./sync";
import type { ISOTime, Mission, SyncRowMap } from "./types";

// Offline-first sync engine shared by web (IndexedDB) and mobile (expo-sqlite).
// Every write goes to the local store + outbox first (optimistic); flush() pushes the outbox to
// POST /api/sync and applies the server's changes with LWW. Pure TS: storage, HTTP and timers are
// injected or looked up on globalThis at call time (so fake timers work in tests).

/** Max outbox items per request (server limit). */
export const SYNC_BATCH = 500;
/** Debounce between a write and the automatic flush. */
export const FLUSH_DELAY_MS = 2_000;
/** Backoff after a failed flush: 2 s, 4 s, 8 s … capped at 60 s. */
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;
/** Meta key holding the server cursor (null/missing = full snapshot on next pull). */
export const CURSOR_META_KEY = "cursor";

/** A row as written by callers: updatedAt is always set by the client; deletedAt defaults to null. */
export type RowWrite<T extends SyncTable> = Omit<SyncRowMap[T], "updatedAt" | "deletedAt"> & {
  updatedAt?: ISOTime;
  deletedAt?: ISOTime | null;
};

/**
 * Local persistence each client implements. Rows are keyed by primaryKeyOf(table, row).
 * Generic row store is enough: rows(tbl, pk, data JSON, updated_at, deleted_at) + outbox + meta.
 */
export interface LocalStore {
  get<T extends SyncTable>(table: T, pk: string): Promise<SyncRowMap[T] | null>;
  /** Excludes soft-deleted rows unless includeDeleted. */
  getAll<T extends SyncTable>(table: T, opts?: { includeDeleted?: boolean }): Promise<SyncRowMap[T][]>;
  /** Insert or replace by primary key. */
  put<T extends SyncTable>(table: T, row: SyncRowMap[T]): Promise<void>;
  enqueue(item: OutboxItem): Promise<void>;
  /** Oldest first. */
  peekOutbox(limit: number): Promise<OutboxItem[]>;
  removeOutbox(ids: readonly string[]): Promise<void>;
  /** Optional fast count; falls back to peekOutbox(10_000).length. */
  countOutbox?(): Promise<number>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}

export type SyncState = "idle" | "syncing" | "offline" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSyncAt: ISOTime | null;
  /** Outbox items not yet acknowledged by the server. */
  pending: number;
  /** Last error message ("auth" after a 401); null when healthy. */
  error: string | null;
}

export interface SyncConflictEvent {
  item: OutboxItem;
  /** Server's current row (already written locally), or null if the server has none. */
  server: Record<string, unknown> | null;
}

export interface SyncClientOptions {
  store: LocalStore;
  client: ClientKind;
  /** POST /api/sync. Throw an error with a numeric `status` for HTTP errors (see SyncHttpError); any other throw = offline. */
  post(req: SyncRequest): Promise<SyncResponse>;
  /** Tables whose local rows changed (invalidate query caches). */
  onChange(tables: ReadonlySet<SyncTable>): void;
  /** Session expired/revoked (HTTP 401). The engine stops retrying until flush() is called again. */
  onAuthError(): void;
  onConflict?(c: SyncConflictEvent): void;
  now?(): Date;
  flushDelayMs?: number;
}

export interface SyncClient {
  /** Optimistic write: sets updatedAt, stores locally, enqueues, notifies, schedules a flush. Returns the stored row. */
  write<T extends SyncTable>(table: T, row: RowWrite<T>, opts?: { lockReason?: string }): Promise<SyncRowMap[T]>;
  /** Soft delete (deletedAt = updatedAt = now). No-op if the row is missing or already deleted. */
  remove(table: SyncTable, pk: string, opts?: { lockReason?: string }): Promise<void>;
  /** Push the outbox and pull changes. Single-flight: concurrent calls share one run (and trigger one more pass). */
  flush(): Promise<void>;
  /** Re-enable auto flushing and flush now (call on app start, focus, reconnect). */
  start(): void;
  /** Cancel timers and stop auto flushing (writes still go to the outbox). */
  stop(): void;
  getStatus(): SyncStatus;
  /** Listener is called immediately and on every status change. Returns unsubscribe. */
  subscribe(listener: (status: SyncStatus) => void): () => void;
}

/** Convenience error for `post` implementations: carries the HTTP status. */
export class SyncHttpError extends Error {
  readonly status: number;
  constructor(status: number, message?: string) {
    super(message ?? `sync failed with HTTP ${status}`);
    this.name = "SyncHttpError";
    this.status = status;
  }
}

/** Server reply we cannot use (bad shape, nothing acknowledged). Shown as state "error", not "offline". */
class SyncProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncProtocolError";
  }
}

function httpStatusOf(e: unknown): number | null {
  if (typeof e === "object" && e !== null && "status" in e) {
    const s = (e as { status: unknown }).status;
    if (typeof s === "number") return s;
  }
  return null;
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

type TimerHandle = unknown;
const timers = (): { setTimeout(cb: () => void, ms: number): TimerHandle; clearTimeout(h: TimerHandle): void } =>
  globalThis as unknown as { setTimeout(cb: () => void, ms: number): TimerHandle; clearTimeout(h: TimerHandle): void };

export function createSyncClient(opts: SyncClientOptions): SyncClient {
  const { store } = opts;
  const now = opts.now ?? (() => new Date());
  const flushDelay = opts.flushDelayMs ?? FLUSH_DELAY_MS;

  let status: SyncStatus = { state: "idle", lastSyncAt: null, pending: 0, error: null };
  const listeners = new Set<(s: SyncStatus) => void>();
  let timer: TimerHandle | null = null;
  let inflight: Promise<void> | null = null;
  let again = false;
  let stopped = false;
  let attempt = 0;

  function setStatus(patch: Partial<SyncStatus>): void {
    status = { ...status, ...patch };
    for (const l of listeners) l(status);
  }

  function clearTimer(): void {
    if (timer !== null) timers().clearTimeout(timer);
    timer = null;
  }

  function schedule(ms: number): void {
    if (stopped) return;
    clearTimer();
    timer = timers().setTimeout(() => {
      timer = null;
      void flush();
    }, ms);
  }

  async function refreshPending(): Promise<void> {
    const pending = store.countOutbox ? await store.countOutbox() : (await store.peekOutbox(10_000)).length;
    if (pending !== status.pending) setStatus({ pending });
  }

  async function applyRemote(table: SyncTable, row: Record<string, unknown>, changed: Set<SyncTable>): Promise<void> {
    const updatedAt = row["updatedAt"];
    if (typeof updatedAt !== "string") return;
    let pk: string;
    try {
      pk = primaryKeyOf(table, row);
    } catch {
      return;
    }
    const local = await store.get(table, pk);
    if (local && compareIso(updatedAt, local.updatedAt) < 0) return; // local is newer (pending write)
    await store.put(table, { deletedAt: null, ...row } as unknown as SyncRowMap[typeof table]);
    changed.add(table);
  }

  async function applyConflict(item: OutboxItem, server: Record<string, unknown> | null, changed: Set<SyncTable>): Promise<void> {
    if (server && typeof server["updatedAt"] === "string") {
      // Server wins: replace the optimistic local row.
      await store.put(item.table, { deletedAt: null, ...server } as unknown as SyncRowMap[typeof item.table]);
    } else {
      // Rejected create (e.g. new mission on a forged day): hide the local-only row.
      const at = now().toISOString();
      await store.put(item.table, { ...item.row, updatedAt: at, deletedAt: at } as unknown as SyncRowMap[typeof item.table]);
    }
    changed.add(item.table);
  }

  /** One push/pull pass (repeats while the outbox has items). Returns false on failure. */
  async function runOnce(): Promise<boolean> {
    clearTimer();
    setStatus({ state: "syncing" });
    try {
      let pulled = false;
      for (;;) {
        const items = await store.peekOutbox(SYNC_BATCH);
        if (pulled && items.length === 0) break; // always pull at least once
        const cursor = await store.getMeta(CURSOR_META_KEY);
        const parsed = syncResponse.safeParse(await opts.post({ client: opts.client, cursor, items }));
        if (!parsed.success) throw new SyncProtocolError("invalid sync response");
        const res = parsed.data;
        pulled = true;

        const byId = new Map(items.map((i) => [i.id, i] as const));
        const acked = [...res.applied, ...res.conflicts.map((c) => c.id)].filter((id) => byId.has(id));
        if (acked.length > 0) await store.removeOutbox(acked);

        const changed = new Set<SyncTable>();
        for (const c of res.conflicts) {
          const item = byId.get(c.id);
          if (!item) continue;
          await applyConflict(item, c.server, changed);
          opts.onConflict?.({ item, server: c.server });
        }
        for (const ch of res.changes) await applyRemote(ch.table, ch.row, changed);
        await store.setMeta(CURSOR_META_KEY, res.cursor);
        if (changed.size > 0) opts.onChange(changed);
        await refreshPending();

        // Guard against an endless loop if the server acknowledges nothing.
        if (items.length > 0 && acked.length === 0) throw new SyncProtocolError("server acknowledged no outbox items");
      }
      attempt = 0;
      setStatus({ state: "idle", lastSyncAt: now().toISOString(), error: null });
      return true;
    } catch (e) {
      const code = httpStatusOf(e);
      if (code === 401) {
        setStatus({ state: "error", error: "auth" });
        opts.onAuthError();
        return false;
      }
      attempt += 1;
      const offline = code === null && !(e instanceof SyncProtocolError);
      setStatus({ state: offline ? "offline" : "error", error: messageOf(e) });
      schedule(Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1)));
      return false;
    }
  }

  function flush(): Promise<void> {
    if (inflight) {
      again = true;
      return inflight;
    }
    inflight = (async () => {
      try {
        let ok = true;
        do {
          again = false;
          ok = await runOnce();
        } while (ok && again && !stopped);
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  async function enqueueWrite<T extends SyncTable>(
    table: T,
    row: SyncRowMap[T],
    op: OutboxItem["op"],
    lockReason: string | undefined,
  ): Promise<void> {
    await store.put(table, row);
    const item: OutboxItem = {
      id: newId(),
      table,
      op,
      row: { ...row } as unknown as Record<string, unknown>,
      updatedAt: row.updatedAt,
      ...(lockReason ? { meta: { lockReason } } : {}),
    };
    await store.enqueue(item);
    opts.onChange(new Set([table]));
    await refreshPending();
    schedule(flushDelay);
  }

  return {
    async write<T extends SyncTable>(
      table: T,
      row: RowWrite<T>,
      writeOpts?: { lockReason?: string },
    ): Promise<SyncRowMap[T]> {
      const at = now().toISOString();
      const full = { ...row, updatedAt: at, deletedAt: row.deletedAt ?? null } as unknown as SyncRowMap[T];
      await enqueueWrite(table, full, full.deletedAt ? "delete" : "upsert", writeOpts?.lockReason);
      return full;
    },

    async remove(table, pk, removeOpts) {
      const local = await store.get(table, pk);
      if (!local || local.deletedAt != null) return;
      const at = now().toISOString();
      await enqueueWrite(table, { ...local, updatedAt: at, deletedAt: at }, "delete", removeOpts?.lockReason);
    },

    flush,

    start() {
      stopped = false;
      void refreshPending();
      void flush();
    },

    stop() {
      stopped = true;
      clearTimer();
    },

    getStatus: () => status,

    subscribe(listener) {
      listeners.add(listener);
      listener(status);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// ===================== ids + mission helpers =====================

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(out);
  else for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/**
 * New ULID (26 chars, Crockford base32, time-sortable). Implemented here instead of importing
 * `ulid`, whose module init throws on React Native when crypto is not yet polyfilled.
 */
export function newId(timeMs: number = Date.now()): string {
  let t = Math.max(0, Math.floor(timeMs));
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD.charAt(t % 32) + time;
    t = Math.floor(t / 32);
  }
  const bytes = randomBytes(16);
  let rand = "";
  for (let i = 0; i < 16; i++) rand += CROCKFORD.charAt((bytes[i] ?? 0) % 32);
  return time + rand;
}

/**
 * Reschedule chip (shared design): the original becomes `rescheduled` with rescheduleCount + 1, and
 * a backlog copy (new id, dayDate null, slot/status backlog) carries the same count.
 * Write both rows with client.write("missions", …); status is a free field, so no lock reason is needed.
 */
export function reschedule(mission: Mission): [rescheduled: Mission, backlogCopy: Mission] {
  const count = mission.rescheduleCount + 1;
  return [
    { ...mission, status: "rescheduled", rescheduleCount: count },
    {
      ...mission,
      id: newId(),
      dayDate: null,
      slot: "backlog",
      status: "backlog",
      actualMin: null,
      rescheduleCount: count,
      deletedAt: null,
    },
  ];
}
