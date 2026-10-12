import { useEffect } from "react";
import type { SyncTable } from "@tatakae/core";
import { conflictMessage, onConflictBatch, useConflictNote } from "../lib/conflicts";
import { InfoIcon } from "./icons";
import { useToast } from "./Toast";

/** Mounted once in the Shell: one calm toast per sync round that had conflicts. */
export function ConflictNoticeHost() {
  const toast = useToast();
  useEffect(
    () =>
      onConflictBatch((batch) => {
        const msg = conflictMessage(batch);
        if (msg) toast(msg, { durationMs: 6000 });
      }),
    [toast],
  );
  return null;
}

/** Small inline pill on a card whose row was just replaced by another device's version. */
export function EditedElsewhere({ table, pk, className = "" }: { table: SyncTable; pk: string; className?: string }) {
  const note = useConflictNote(table, pk);
  if (!note) return null;
  const label = note.kind === "newer" ? "Edited elsewhere" : "Change not saved";
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={label}>
      <InfoIcon size={14} /> {label}
    </span>
  );
}
