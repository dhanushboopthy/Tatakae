import { compareIso, isSyncTable, primaryKeyOf, type SyncTable } from "./sync";
import type { SyncConflictEvent } from "./syncClient";

// Sync conflicts (createSyncClient onConflict) → a subtle "edited elsewhere" note on both clients
// (v4.6). The sync client already put the server's row locally; this only tells the owner why
// something changed under them.
//   newer   another device saved a newer version (LWW) — the usual case
//   kept    the server kept its version (plan lock without a reason, scoring guard, write-off limit)
//   undone  the server has no such row and refused this one, so the local copy was removed

export type ConflictKind = "newer" | "kept" | "undone";

export interface ConflictNote {
  table: SyncTable;
  pk: string;
  kind: ConflictKind;
  at: number;
}

export function describeConflict(ev: SyncConflictEvent, at: number = Date.now()): ConflictNote | null {
  const table = ev.item.table;
  if (!isSyncTable(table)) return null;
  let pk: string;
  try {
    pk = primaryKeyOf(table, ev.item.row as never);
  } catch {
    return null;
  }
  if (ev.server === null) return { table, pk, kind: "undone", at };
  const serverAt = typeof ev.server["updatedAt"] === "string" ? ev.server["updatedAt"] : "";
  const kind: ConflictKind = serverAt && compareIso(serverAt, ev.item.updatedAt) > 0 ? "newer" : "kept";
  return { table, pk, kind, at };
}

/** One calm line for a batch of conflicts (shown as a toast). */
export function conflictMessage(notes: readonly ConflictNote[]): string | null {
  if (notes.length === 0) return null;
  if (notes.some((n) => n.kind === "newer")) {
    return notes.length === 1
      ? "Edited on another device. Showing the newest version."
      : `${notes.length} items were edited on another device. Showing the newest versions.`;
  }
  if (notes.some((n) => n.kind === "kept")) return "A change didn't go through. The saved version stays.";
  return "A change didn't go through, so it was undone.";
}

/** Short label for the pill on a card. */
export const conflictLabel = (kind: ConflictKind): string => (kind === "newer" ? "Edited elsewhere" : "Change not saved");

// ---------- log ----------

/** How long an item keeps its "Edited elsewhere" pill. */
export const NOTE_WINDOW_MS = 10 * 60_000;

export interface ConflictLog {
  record(ev: SyncConflictEvent): void;
  /** Current notes (a new array after every change, for useSyncExternalStore). */
  snapshot(): readonly ConflictNote[];
  subscribe(listener: () => void): () => void;
  /** One call per sync round that had conflicts. */
  onBatch(listener: (batch: ConflictNote[]) => void): () => void;
  /** The latest note for a row within the window, if any. */
  noteFor(table: SyncTable, pk: string, now?: number): ConflictNote | null;
}

export function createConflictLog(opts: { windowMs?: number; batchMs?: number; now?: () => number } = {}): ConflictLog {
  const windowMs = opts.windowMs ?? NOTE_WINDOW_MS;
  const batchMs = opts.batchMs ?? 300;
  const now = opts.now ?? Date.now;
  let notes: ConflictNote[] = [];
  let batch: ConflictNote[] = [];
  let batchTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const batchListeners = new Set<(batch: ConflictNote[]) => void>();

  return {
    record(ev) {
      const note = describeConflict(ev, now());
      if (!note) return;
      const cutoff = note.at - windowMs;
      notes = [...notes.filter((n) => n.at >= cutoff && !(n.table === note.table && n.pk === note.pk)), note];
      for (const l of listeners) l();
      // One toast per sync round, not one per item.
      batch.push(note);
      batchTimer ??= setTimeout(() => {
        const done = batch;
        batch = [];
        batchTimer = null;
        for (const l of batchListeners) l(done);
      }, batchMs);
    },
    snapshot: () => notes,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    onBatch(l) {
      batchListeners.add(l);
      return () => batchListeners.delete(l);
    },
    noteFor(table, pk, at = now()) {
      const n = notes.find((x) => x.table === table && x.pk === pk);
      return n && at - n.at < windowMs ? n : null;
    },
  };
}
