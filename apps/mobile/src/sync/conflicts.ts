import { useSyncExternalStore } from "react";
import { createConflictLog, type ConflictNote, type SyncConflictEvent, type SyncTable } from "@tatakae/core";

// Sync conflicts → a subtle "edited elsewhere" note (v4.6), same kinds and copy as the laptop
// (core conflicts.ts). The sync client already wrote the server's row locally; this only says why.

const log = createConflictLog();

export function recordConflict(ev: SyncConflictEvent): void {
  log.record(ev);
}

export function onConflictBatch(listener: (batch: ConflictNote[]) => void): () => void {
  return log.onBatch(listener);
}

/** The latest conflict note for a row within the last 10 minutes, if any. */
export function useConflictNote(table: SyncTable, pk: string): ConflictNote | null {
  useSyncExternalStore(log.subscribe, log.snapshot, log.snapshot);
  return log.noteFor(table, pk);
}
