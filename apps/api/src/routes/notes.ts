import { Hono } from "hono";
import { noteInput, noteListQuery, notePatch, noteSearchQuery } from "@tatakae/core";
import type { AppBindings } from "../env";
import { localCrudRoutes } from "../lib/crud";
import { decodeNote, encodeNote, listNotes, searchNotes } from "../lib/notes.service";
import { parseQuery } from "../lib/validate";

// Phase v3. Notes (REST only, not synced).
//   GET    /notes?tag=&goalId=   → { items: NoteSummary[] }  (no body; plain-text excerpt; newest first)
//   GET    /notes/search?q=      → { items: NoteSearchHit[] } (FTS5, title weighted)
//   GET    /notes/:id            → { item: Note }
//   POST   /notes                noteInput (+ id?) → 201 { item }
//   PATCH  /notes/:id            notePatch → { item }
//   DELETE /notes/:id            → { item } (soft delete; drops it from the index)
export const notes = new Hono<AppBindings>();

notes.get("/search", (c) => {
  const { q } = parseQuery(c, noteSearchQuery);
  return c.json({ items: searchNotes(c.get("db"), q) });
});

notes.route(
  "/",
  localCrudRoutes({
    table: "notes",
    input: noteInput,
    patch: notePatch,
    label: "note",
    decode: decodeNote,
    encode: encodeNote,
    sort: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    list: (items, query) => listNotes(items, noteListQuery.parse(query)),
  }),
);
