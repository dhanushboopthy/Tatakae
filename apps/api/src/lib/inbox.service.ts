import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { blocksToText, firstFreeRanked, isoDate, slot, textToBlocks, type InboxItem, type InboxPatch, type Mission, type MuraEvent } from "@tatakae/core";
import { inbox, notes } from "../../../../db/schema";
import { transaction, type Db } from "./db";
import { Conflict, NotFound } from "./errors";
import { newId } from "./ids";
import { createMission } from "./missions.service";
import { allRows, bumpUpdatedAt, getRow, upsertRow, withoutUndefined } from "./rows.service";

// Quick capture. Processing turns an item into a mission (backlog by default), a note, or discards it.

/** PATCH /inbox/:id body when processing (has `to`). Otherwise the body is core inboxPatch. */
export const inboxProcess = z.discriminatedUnion("to", [
  z.object({
    to: z.literal("mission"),
    mission: z
      .object({
        title: z.string().min(1).max(200),
        dayDate: isoDate.nullable(),
        slot,
        points: z.number().int().min(1).max(5).nullable(),
        minimum: z.string().max(200).nullable(),
        ifThen: z.string().max(300).nullable(),
        goalId: z.string().nullable(),
        estMin: z.number().int().positive().nullable(),
      })
      .partial()
      .default({}),
    reason: z.string().min(3).max(300).optional(), // needed when the target day is forged
  }),
  z.object({ to: z.literal("note"), title: z.string().min(1).max(300).optional() }),
  z.object({ to: z.literal("discard") }),
]);
export type InboxProcess = z.infer<typeof inboxProcess>;

export function listUnprocessed(db: Db): InboxItem[] {
  return db
    .select()
    .from(inbox)
    .where(and(eq(inbox.processed, false), isNull(inbox.deletedAt)))
    .all()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function requireItem(db: Db, id: string): InboxItem {
  const item = getRow(db, "inbox", id);
  if (!item || item.deletedAt != null) throw new NotFound("No such inbox item.");
  return item;
}

export function createItem(db: Db, text: string, id: string = newId(), now: Date = new Date()): InboxItem {
  if (getRow(db, "inbox", id)) throw new Conflict("An inbox item with this id already exists.", "exists");
  const at = now.toISOString();
  return upsertRow(db, "inbox", { id, text: text.trim(), createdAt: at, processed: false, updatedAt: at, deletedAt: null });
}

export function patchItem(db: Db, id: string, patch: InboxPatch, now: Date = new Date()): InboxItem {
  const prev = requireItem(db, id);
  return upsertRow(db, "inbox", { ...prev, ...withoutUndefined(patch), id, updatedAt: bumpUpdatedAt(prev.updatedAt, now) });
}

/** BlockNote document with one paragraph per line. */
export interface ProcessResult {
  item: InboxItem;
  mission?: Mission;
  muraEvent?: MuraEvent | null;
  noteId?: string;
}

export function processItem(db: Db, id: string, action: InboxProcess, now: Date = new Date()): ProcessResult {
  return transaction(db, () => {
    const prev = requireItem(db, id);
    const at = bumpUpdatedAt(prev.updatedAt, now);
    const result: ProcessResult = { item: prev };

    if (action.to === "mission") {
      const m = action.mission;
      const dayDate = m.dayDate ?? null;
      // A dated mission without a slot takes the first free ranked slot after P1 (P2…P9).
      const freeSlot = dayDate ? firstFreeRanked(allRows(db, "missions", { includeDeleted: false }).filter((x) => x.dayDate === dayDate)) : null;
      if (dayDate && !m.slot && !freeSlot) throw new Conflict("All nine slots on that day are taken. Send it to the backlog instead.", "day_full");
      const write = createMission(
        db,
        {
          title: m.title ?? prev.text.slice(0, 200),
          dayDate,
          slot: m.slot ?? freeSlot ?? "backlog",
          points: m.points ?? null,
          minimum: m.minimum ?? null,
          ifThen: m.ifThen ?? null,
          goalId: m.goalId ?? null,
          estMin: m.estMin ?? null,
        },
        action.reason,
        now,
      );
      result.mission = write.mission;
      result.muraEvent = write.muraEvent;
    } else if (action.to === "note") {
      // Notes are REST-only (v3) and not synced, so they skip the change log.
      const firstLine = prev.text.split(/\r?\n/)[0]?.trim() || prev.text.trim();
      const noteId = newId();
      const blocks = textToBlocks(prev.text);
      db.insert(notes)
        .values({
          id: noteId,
          title: (action.title ?? firstLine).slice(0, 300),
          tags: "[]",
          bodyJson: JSON.stringify(blocks),
          bodyText: blocksToText(blocks),
          updatedAt: at,
          deletedAt: null,
        })
        .run();
      result.noteId = noteId;
    }

    result.item = upsertRow(db, "inbox", {
      ...prev,
      processed: true,
      updatedAt: at,
      deletedAt: action.to === "discard" ? at : null,
    });
    return result;
  });
}
