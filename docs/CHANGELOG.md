# Changelog

## Unreleased
- Skeleton created (stubs only).
- Hosting switched from Cloudflare to a single Oracle Cloud Always Free VM (Docker Compose, Caddy, SQLite + Litestream, Tailscale, Terraform OCI). Free-domain plan in docs/DOMAIN.md.
- Split into laptop website (apps/web) + native Android app (apps/mobile, Expo SDK 57). API: mobile bearer sessions, /app/version. Core: sync helpers, login schemas.
- Full docs set (docs/01–09), CLAUDE.md, START_PROMPT.md, project skills in .claude/skills, scripts/setup-claude.sh.
- Design system "Soft Bento" (docs/10-design-system.md) from user references; tokens in tailwind + mobile theme; chart/nav component stubs; Plus Jakarta Sans.
- Dashboards, charts, calendar, scoreboard and icons spec (docs/11); core stats.ts + icons.ts; focus_sessions table; /stats/* and /focus routes; phone Calendar tab + Day sheet; web Calendar route; component stubs.
- core: time helpers (`todayIST` with 04:00 IST boundary, ISO weeks, month ranges, `canEditScoring`), full scoring incl. `isMissedDay`, `averageScore`, `capacityCheck`, `daysShownUp`, `scoringFromSettings`.
- core: sync helpers (`SYNC_TABLES`, `primaryKeyOf`, LWW, plan-lock checks), zod row schemas for every synced table, v2/v3 input schemas, story pack schema, settings defaults.
- core: `pickStory`, offline-first `createSyncClient` (outbox, debounced flush, LWW pull, status), `newId` (ULID), `reschedule`; tests for scoring, time, sync and story (written, not yet run).
- db: v1–v3 schema incl. `changes`, `sync_items`, `sessions.last_seen_at`, applications/stories/japanese_log; initial migration, notes FTS5 migration, seed defaults, `db/migrate.ts`.
- infra: Terraform for OCI (VCN, subnet, security list with closable admin SSH, A1 2 OCPU/12 GB Ubuntu 24.04 arm64, reserved IP, 100 GB data volume, versioned backup bucket with lifecycle purge, optional ₹1 budget alert and S3 key).
- deploy: cloud-init template runs an idempotent `bootstrap.sh` (Docker, Oracle iptables, Tailscale SSH, ufw, fail2ban, unattended-upgrades, data volume at /srv/tatakae); Caddy CSP and immutable asset caching; compose health dependencies and uid 1000; Litestream daily snapshots; real `deploy.sh` (snapshot, health check, rollback), `restore.sh`, `hash-password.sh`.
- ci: `deploy.yml` (checks → arm64 images to GHCR → Tailscale → deploy.sh → smoke test) and `mobile.yml` (signed release APK on `mobile-v*` tags).
- docs: `docs/MANUAL-STEPS.md`, the ordered by-hand steps for Phase 0.
- api (0.9): env validation with readable errors, migrations + default rows on boot, JSON errors, graceful shutdown; hashed session tokens with sliding expiry, signed web cookie / mobile bearer / API_TOKEN, login rate limit, `/session` login, logout, me, devices.
- api (v1): generic row store with change log; days (score, write-off limit, forge), missions (plan lock 423, edit-locked → mura, reschedule), habits + logs, inbox processing, settings (even-Sunday guard), `POST /sync`; route tests (written, not yet run).
