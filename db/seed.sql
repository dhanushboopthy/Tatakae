-- Default settings and recharge menu. Idempotent (INSERT OR IGNORE), so it never overwrites edits.
-- Values must stay identical to packages/core/src/settings.ts (DEFAULT_SETTINGS, DEFAULT_RECHARGE_ITEMS);
-- the API seeds the same rows from TypeScript on boot. updated_at is the epoch so any real edit wins LWW.
-- Apply by hand: sqlite3 "$DATABASE_PATH" < db/seed.sql

INSERT OR IGNORE INTO settings (key, value, editable_from, updated_at, deleted_at) VALUES
  ('scoring', '{"screenFreeMin":120,"screenStepMin":30,"screenStepPenalty":5,"screenPenaltyCap":20,"comebackBonus":10,"strongAt":80,"solidAt":50,"missedExecBelow":25,"capacityRatio":0.8,"writeOffsPerMonth":2}', 'even_sunday', '1970-01-01T00:00:00.000Z', NULL),
  ('wake_time', '"06:30"', NULL, '1970-01-01T00:00:00.000Z', NULL),
  ('ritual_time', '"21:30"', NULL, '1970-01-01T00:00:00.000Z', NULL),
  ('focus_default', '50', NULL, '1970-01-01T00:00:00.000Z', NULL),
  ('story_enabled', 'true', NULL, '1970-01-01T00:00:00.000Z', NULL),
  ('haptics_enabled', 'true', NULL, '1970-01-01T00:00:00.000Z', NULL),
  ('afternoon_nudge', '{"enabled":false,"time":"14:00"}', NULL, '1970-01-01T00:00:00.000Z', NULL),
  ('focus_week_target', '600', NULL, '1970-01-01T00:00:00.000Z', NULL);

INSERT OR IGNORE INTO recharge_items (id, name, kind, updated_at, deleted_at) VALUES
  ('0000000000RECHARGE00000001', 'Walk', 'walk', '1970-01-01T00:00:00.000Z', NULL),
  ('0000000000RECHARGE00000002', 'Music', 'music', '1970-01-01T00:00:00.000Z', NULL),
  ('0000000000RECHARGE00000003', 'Call', 'call', '1970-01-01T00:00:00.000Z', NULL),
  ('0000000000RECHARGE00000004', 'Stretch', 'stretch', '1970-01-01T00:00:00.000Z', NULL),
  ('0000000000RECHARGE00000005', 'Sketch', 'sketch', '1970-01-01T00:00:00.000Z', NULL);
