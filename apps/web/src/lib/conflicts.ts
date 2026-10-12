import { useSyncExternalStore } from "react";
import { compareIso, isSyncTable, primaryKeyOf, type SyncConflictEvent, type SyncTable } from "@tatakae/core";

// Sync conflicts (core onConflict) → a subtle "edited elsewhere" note (v4). The sync client already
// put the server's row locally; this only tells the owner why something changed under them.
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

// ---------- store ----------

/** How long an item keeps its "Edited elsewhere" pill. */
export const NOTE_WINDOW_MS = 10 * 60_000;

let notes: ConflictNote[] = [];
const listeners = new Set<() => void>();
const batchListeners = new Set<(batch: ConflictNote[]) => void>();
let batch: ConflictNote[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

export function recordConflict(ev: SyncConflictEvent): void {
  const note = describeConflict(ev);
  if (!note) return;
  const cutoff = note.at - NOTE_WINDOW_MS;
  notes = [...notes.filter((n) => n.at >= cutoff && !(n.table === note.table && n.pk === note.pk)), note];
  for (const l of listeners) l();
  // One toast per sync round, not one per item.
  batch.push(note);
  batchTimer ??= setTimeout(() => {
    const done = batch;
    batch = [];
    batchTimer = null;
    for (const l of batchListeners) l(done);
  }, 300);
}

export function onConflictBatch(listener: (batch: ConflictNote[]) => void): () => void {
  batchListeners.add(listener);
  return () => batchListeners.delete(listener);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The latest conflict note for a row within the last 10 minutes, if any. */
export function useConflictNote(table: SyncTable, pk: string): ConflictNote | null {
  const all = useSyncExternalStore(
    subscribe,
    () => notes,
    () => notes,
  );
  const n = all.find((x) => x.table === table && x.pk === pk);
  return n && Date.now() - n.at < NOTE_WINDOW_MS ? n : null;
}
