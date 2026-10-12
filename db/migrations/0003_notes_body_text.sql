ALTER TABLE `files` ADD `name` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `body_text` text;--> statement-breakpoint
-- Hand-added: index the plain text (written by the API from body_json) instead of the raw BlockNote
-- JSON, whose keys ("paragraph", "styles", …) matched every search. Old rows fall back to body_json
-- until the API backfills body_text on boot.
DROP TRIGGER IF EXISTS `notes_fts_ai`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `notes_fts_au`;--> statement-breakpoint
CREATE TRIGGER `notes_fts_ai` AFTER INSERT ON `notes` BEGIN
  INSERT INTO notes_fts (note_id, title, body)
  SELECT new.id, new.title, coalesce(new.body_text, new.body_json, '') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `notes_fts_au` AFTER UPDATE ON `notes` BEGIN
  DELETE FROM notes_fts WHERE note_id = old.id;
  INSERT INTO notes_fts (note_id, title, body)
  SELECT new.id, new.title, coalesce(new.body_text, new.body_json, '') WHERE new.deleted_at IS NULL;
END;