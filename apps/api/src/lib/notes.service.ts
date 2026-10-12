import {
  blocksToText,
  excerptOf,
  ftsQuery,
  normalizeTags,
  snippetAround,
  type Note,
  type NoteSearchHit,
  type NoteSummary,
} from "@tatakae/core";
import { sqliteOf, type Db } from "./db";
import { jsonArray, stringArray, type LocalRow } from "./local.service";

// Notes (v3, REST only). body_json holds the BlockNote document; body_text is its plain text
// (core blocksToText), written on every save and indexed by notes_fts (migration 0003).

type NoteDb = LocalRow<"notes">;

export function decodeNote(row: NoteDb): Note {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    tags: stringArray(row.tags),
    areaId: row.areaId,
    goalId: row.goalId,
    sourceUrl: row.sourceUrl,
    bodyJson: row.bodyJson == null ? null : jsonArray(row.bodyJson),
    canExplain: row.canExplain,
    canImplement: row.canImplement,
    misunderstood: row.misunderstood,
    publishedUrl: row.publishedUrl,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function encodeNote(note: Note): NoteDb {
  return {
    id: note.id,
    title: note.title,
    type: note.type,
    status: note.status,
    tags: JSON.stringify(normalizeTags(note.tags)),
    areaId: note.areaId,
    goalId: note.goalId,
    sourceUrl: note.sourceUrl,
    bodyJson: note.bodyJson == null ? null : JSON.stringify(note.bodyJson),
    bodyText: blocksToText(note.bodyJson),
    canExplain: note.canExplain,
    canImplement: note.canImplement,
    misunderstood: note.misunderstood,
    publishedUrl: note.publishedUrl,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
  };
}

export function summarize(note: Note): NoteSummary {
  const { bodyJson, ...rest } = note;
  return { ...rest, excerpt: excerptOf(bodyJson) };
}

/** GET /notes: newest first, optional `tag` / `goalId` filters. */
export function listNotes(notes: Note[], query: { tag?: string; goalId?: string }): NoteSummary[] {
  const tag = query.tag ? normalizeTags([query.tag])[0] : undefined;
  return notes
    .filter((n) => (!tag || n.tags.includes(tag)) && (!query.goalId || n.goalId === query.goalId))
    .map(summarize);
}

/** Full-text search (title weighted 10×, body 1×), best 50 hits. */
export function searchNotes(db: Db, q: string): NoteSearchHit[] {
  const match = ftsQuery(q);
  if (!match) return [];
  const rows = sqliteOf(db)
    .prepare(
      `SELECT f.note_id AS id, f.title AS title, f.body AS body, n.updated_at AS updatedAt
       FROM notes_fts f JOIN notes n ON n.id = f.note_id
       WHERE notes_fts MATCH ? AND n.deleted_at IS NULL
       ORDER BY bm25(notes_fts, 0, 10, 1) LIMIT 50`,
    )
    .all(match) as { id: string; title: string; body: string; updatedAt: string }[];
  return rows.map((r) => ({ id: r.id, title: r.title, snippet: snippetAround(r.body, q), updatedAt: r.updatedAt }));
}
