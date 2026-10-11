-- Full-text search for notes (v3). Hand-written: drizzle-kit cannot model FTS5 virtual tables.
-- notes.id is TEXT (ULID), so instead of an external-content table keyed by rowid we keep a
-- standalone FTS5 table keyed by note_id and maintain it with triggers. Soft-deleted notes are
-- removed from the index. body = raw body_json text (good enough for v3; BlockNote keys are noise).
-- Query: SELECT note_id, snippet(notes_fts, 2, '[', ']', '…', 12) AS snip
--        FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT 50;
CREATE VIRTUAL TABLE `notes_fts` USING fts5(note_id UNINDEXED, title, body, tokenize = 'porter unicode61');
--> statement-breakpoint
CREATE TRIGGER `notes_fts_ai` AFTER INSERT ON `notes` BEGIN
  INSERT INTO notes_fts (note_id, title, body)
  SELECT new.id, new.title, coalesce(new.body_json, '') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `notes_fts_au` AFTER UPDATE ON `notes` BEGIN
  DELETE FROM notes_fts WHERE note_id = old.id;
  INSERT INTO notes_fts (note_id, title, body)
  SELECT new.id, new.title, coalesce(new.body_json, '') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `notes_fts_ad` AFTER DELETE ON `notes` BEGIN
  DELETE FROM notes_fts WHERE note_id = old.id;
END;
--> statement-breakpoint
INSERT INTO notes_fts (note_id, title, body)
SELECT id, title, coalesce(body_json, '') FROM notes WHERE deleted_at IS NULL;
