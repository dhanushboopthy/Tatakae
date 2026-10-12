import { Hono, type Context } from "hono";
import { storyNextQuery, storyPack, storyRefPatch, watchQueueInput, type WatchQueueItem } from "@tatakae/core";
import type { AppBindings } from "../env";
import { liveRows, requireLive } from "../lib/crud";
import { Conflict, NotFound } from "../lib/errors";
import { bumpUpdatedAt, getRow, softDeleteRow, upsertRow, withoutUndefined } from "../lib/rows.service";
import { importPack, nextStory } from "../lib/story.service";
import { idParam, parseBody, parseQuery } from "../lib/validate";

// Phase v2. Story layer: refs import / list / mute, next pick, reward watch queue.
//   GET    /                 → { items }  (live refs)
//   POST   /import           storyPack → { added, skipped }   (one short line each, lesson ≤ 160 chars)
//   PATCH  /:id              storyRefPatch (muted, text) → { item }
//   GET    /next?moment=     → { story | null }  (1 in 3, no repeat in 14 days, off when story_enabled is false)
//   GET    /watch            → { items }
//   POST   /watch            watchQueueInput → 201 { item }
//   PATCH  /watch/:title     partial → { item }
//   DELETE /watch/:title     → { item }
export const story = new Hono<AppBindings>();

story.get("/", (c) => c.json({ items: liveRows(c.get("db"), "story_refs").sort((a, b) => a.title.localeCompare(b.title)) }));

story.post("/import", async (c) => {
  const pack = await parseBody(c, storyPack);
  return c.json(importPack(c.get("db"), pack));
});

story.get("/next", (c) => {
  const { moment } = parseQuery(c, storyNextQuery);
  return c.json({ story: nextStory(c.get("db"), moment) });
});

// Watch queue (PK = title). Registered before "/:id" so "/watch" isn't read as an id.
story.get("/watch", (c) => c.json({ items: liveRows(c.get("db"), "watch_queue").sort((a, b) => a.title.localeCompare(b.title)) }));

story.post("/watch", async (c) => {
  const db = c.get("db");
  const body = await parseBody(c, watchQueueInput);
  const prev = getRow(db, "watch_queue", body.title);
  if (prev && prev.deletedAt == null) throw new Conflict("That show is already in the queue.", "exists");
  const item: WatchQueueItem = { ...body, updatedAt: bumpUpdatedAt(prev?.updatedAt), deletedAt: null };
  return c.json({ item: upsertRow(db, "watch_queue", item) }, 201);
});

function requireWatch(c: Context<AppBindings>): WatchQueueItem {
  const title = decodeURIComponent(c.req.param("title") ?? "");
  const row = getRow(c.get("db"), "watch_queue", title);
  if (!row || row.deletedAt != null) throw new NotFound("No such show in the queue.");
  return row;
}

story.patch("/watch/:title", async (c) => {
  const prev = requireWatch(c);
  const patch = await parseBody(c, watchQueueInput.omit({ title: true }).partial());
  return c.json({
    item: upsertRow(c.get("db"), "watch_queue", { ...prev, ...withoutUndefined(patch), updatedAt: bumpUpdatedAt(prev.updatedAt) }),
  });
});

story.delete("/watch/:title", (c) => {
  const prev = requireWatch(c);
  return c.json({ item: softDeleteRow(c.get("db"), "watch_queue", prev.title, bumpUpdatedAt(prev.updatedAt)) });
});

story.patch("/:id", async (c) => {
  const db = c.get("db");
  const prev = requireLive(db, "story_refs", idParam(c), "story line");
  const patch = await parseBody(c, storyRefPatch);
  return c.json({ item: upsertRow(db, "story_refs", { ...prev, ...withoutUndefined(patch), updatedAt: bumpUpdatedAt(prev.updatedAt) }) });
});

