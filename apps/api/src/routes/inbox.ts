import { Hono } from "hono";
import { z } from "zod";
import { inboxInput, inboxPatch } from "@tatakae/core";
import type { AppBindings } from "../env";
import { createItem, inboxProcess, listUnprocessed, patchItem, processItem } from "../lib/inbox.service";
import { idParam, parseBody } from "../lib/validate";

// Phase v1. Quick capture
//   GET   /                         → { items }  (unprocessed, oldest first)
//   POST  /   { text, id? }         → 201 { item }
//   PATCH /:id { text?, processed? } → { item }
//   PATCH /:id { to: "mission", mission?: {title?, dayDate?, slot?, …}, reason? }
//              { to: "note", title? } | { to: "discard" }  → { item, mission?, muraEvent?, noteId? }
export const inbox = new Hono<AppBindings>();

inbox.get("/", (c) => c.json({ items: listUnprocessed(c.get("db")) }));

inbox.post("/", async (c) => {
  const body = await parseBody(c, inboxInput.extend({ id: z.string().min(1).max(64).optional() }));
  return c.json({ item: createItem(c.get("db"), body.text, body.id) }, 201);
});

inbox.patch("/:id", async (c) => {
  const raw = await parseBody(c, z.record(z.unknown()));
  const id = idParam(c);
  const db = c.get("db");
  if ("to" in raw) return c.json(processItem(db, id, inboxProcess.parse(raw)));
  return c.json({ item: patchItem(db, id, inboxPatch.parse(raw)) });
});
