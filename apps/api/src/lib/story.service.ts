import { nowIso, pickStory, readSettings, recentlyShownIds, rewardTarget, type StoryMoment, type StoryPack, type StoryRef, type WatchQueueItem } from "@tatakae/core";
import { liveRows } from "./crud";
import type { Db } from "./db";
import { transaction } from "./db";
import { newId } from "./ids";
import { allRows, bumpUpdatedAt, upsertRow } from "./rows.service";

/** Import a validated pack: one story_refs row per new (title, moment, lesson). Returns rows added. */
export function importPack(db: Db, pack: StoryPack): { added: number; skipped: number } {
  return transaction(db, () => {
    const seen = new Set(allRows(db, "story_refs").map((r) => `${r.title}|${r.moment}|${r.lesson}`.toLowerCase()));
    let added = 0;
    for (const ref of pack.refs) {
      const key = `${ref.title}|${ref.moment}|${ref.lesson}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      upsertRow(db, "story_refs", { id: newId(), ...ref, muted: false, lastShownAt: null, updatedAt: nowIso(), deletedAt: null });
      added++;
    }
    return { added, skipped: pack.refs.length - added };
  });
}

/** GET /story/next: pick (1 in 3, no repeat in 14 days, unmuted) and stamp lastShownAt. Null when off. */
export function nextStory(db: Db, moment: StoryMoment, rand: () => number = Math.random): StoryRef | null {
  if (!readSettings(allRows(db, "settings", { includeDeleted: false })).story_enabled) return null;
  const refs = liveRows(db, "story_refs");
  const pick = pickStory(refs, moment, recentlyShownIds(refs), rand);
  if (!pick) return null;
  return upsertRow(db, "story_refs", { ...pick, lastShownAt: nowIso(), updatedAt: bumpUpdatedAt(pick.updatedAt) });
}

/** A completed weekly review unlocks one episode of the show being watched (or the next queued one). */
export function unlockReward(db: Db): WatchQueueItem | null {
  const target = rewardTarget(liveRows(db, "watch_queue"));
  if (!target) return null;
  return upsertRow(db, "watch_queue", {
    ...target,
    unlocked: target.unlocked + 1,
    status: target.status === "queued" ? "watching" : target.status,
    updatedAt: bumpUpdatedAt(target.updatedAt),
  });
}
