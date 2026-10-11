# Changelog

## Unreleased
- Skeleton created (stubs only).
- Hosting switched from Cloudflare to a single Oracle Cloud Always Free VM (Docker Compose, Caddy, SQLite + Litestream, Tailscale, Terraform OCI). Free-domain plan in docs/DOMAIN.md.
- Split into laptop website (apps/web) + native Android app (apps/mobile, Expo SDK 57). API: mobile bearer sessions, /app/version. Core: sync helpers, login schemas.
- Full docs set (docs/01–09), CLAUDE.md, START_PROMPT.md, project skills in .claude/skills, scripts/setup-claude.sh.
- core: time helpers (`todayIST` with 04:00 IST boundary, ISO weeks, month ranges, `canEditScoring`), full scoring incl. `isMissedDay`, `averageScore`, `capacityCheck`, `daysShownUp`, `scoringFromSettings`.
- core: sync helpers (`SYNC_TABLES`, `primaryKeyOf`, LWW, plan-lock checks), zod row schemas for every synced table, v2/v3 input schemas, story pack schema, settings defaults.
- core: `pickStory`, offline-first `createSyncClient` (outbox, debounced flush, LWW pull, status), `newId` (ULID), `reschedule`; tests for scoring, time, sync and story (written, not yet run).
- db: v1–v3 schema incl. `changes`, `sync_items`, `sessions.last_seen_at`, applications/stories/japanese_log; initial migration, notes FTS5 migration, seed defaults, `db/migrate.ts`.
