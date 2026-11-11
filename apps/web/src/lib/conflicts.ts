import { useSyncExternalStore } from "react";
import { createConflictLog, type ConflictNote, type SyncConflictEvent, type SyncTable } from "@tatakae/core";

// Sync conflicts → a subtle "edited elsewhere" note (v4). The kinds, messages and the log live in
// core (conflicts.ts) so the phone shows the same thing; this is the laptop's store and hook.

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
