# Overnight build — plan, shared design, decisions log

Started 2026-10-11 ~23:00 IST. Owner asleep; work runs unattended. Read this file first, then CLAUDE.md and the docs your area needs.

## Ground rules (owner's instructions for tonight)
- **Do not run tests or typecheck.** Write test files where useful, but do not run them or try to make them pass. Owner runs them in the morning.
- **Never touch anything outside `/home/dhanush/Projects/TATAKAE`.** Do not run `scripts/setup-claude.sh`; it installs to user scope.
- **Never ask the owner questions.** Pick the sensible option and log it under *Decisions log* below.
- **Git:** one Conventional Commit per task on `main`, using the existing git config. Never change the author. Never add a `Co-Authored-By` line or any mention of Claude. Stage only your own paths (`git add <paths>`). If `index.lock` exists, wait a few seconds and retry; another agent may be committing.
- **Edit files with the Edit or Write tools**, not `sed`, heredocs or scripts. The owner reviews diffs in the IDE.
- **Dependencies:** anything listed in `docs/04-tech-stack.md` or already in a package.json is fine (`pnpm add --filter <pkg> <dep>`; the npm registry is reachable). Avoid anything unlisted. If you truly need it, add it and log why.
- TypeScript strict and no `any` (use `unknown` and narrow). Zod for API I/O. `packages/core` stays pure TS.
- UI rules: grey not red, no streaks or XP, 44px/dp targets, dark, calm copy (docs/05-ui-ux.md). Tokens: ink `#0b0b0f`, paper `#ececf1`, muted `#8a8a96`, ember `#f2a33a`, jade `#4fbf8f`.
- When an area is finished: mark its tasks in `docs/06-phases.md`, using 🟡 for "code written, not verified/applied" or ✅ for done. Add lines to `docs/CHANGELOG.md` under *Unreleased*. Append to the *Progress* and *Decisions log* sections below.

## Shared design (all areas follow this)

### Auth (Phase 0)
- The session token is 32 random bytes, base64url. In `sessions.id` we store `sha256(token)` as hex, never the raw token.
- Web: `tatakae_session` cookie, signed with `SESSION_SECRET` (Hono `setSignedCookie`), HttpOnly, Secure in production, SameSite=Lax, path `/`, 90-day max-age.
- Mobile: `{ token, expiresAt }` in the response body, sent back as `Authorization: Bearer <token>`.
- Scripts: `Authorization: Bearer <API_TOKEN>`, compared in constant time.
- Sliding expiry: when less than 30 days remain, extend to now + `SESSION_DAYS` and re-set the cookie on web.
- `DEV_BYPASS_AUTH=1` is honoured only when `NODE_ENV=development`.
- Rate limit applies to `POST /session/login` only, not `/session/*`, so `/me` is not throttled. 10 attempts per 15 minutes per IP.
- Hono context variables (`AppBindings`): `env`, `db`, `session` (`{ id, client, deviceName } | null`), `email`.

### Sync (v1), one implementation shared by both clients
- **Server change log:** table `changes(seq INTEGER PK AUTOINCREMENT, tbl TEXT, pk TEXT, at TEXT)`. Every server write (REST or sync) records a change.
  - The cursor is `String(seq)`.
  - Pull returns the current rows for each distinct `(tbl, pk)` with seq greater than the cursor.
  - A null cursor means a full snapshot of all synced tables, soft-deleted rows included.
- **Idempotency:** table `sync_items(id TEXT PK, at TEXT)`. An item id already seen counts as applied.
- **Synced tables:** days, missions, habits, habit_logs, anchors, settings, inbox, mura_events, stuck_events, recharge_items, plus the v2 tables areas, goals, reviews, experiments, story_refs and watch_queue.
  - Notes are not synced. Web uses REST; mobile has read-only search over REST.
  - Sessions, job_runs, changes and sync_items are never synced.
- **Primary keys:** `id`, except days → `date`, settings → `key`, habit_logs → `habitId|date`, watch_queue → `title`.
  - `primaryKeyOf(table, row)` lives in core.
- **Wire format:** rows use camelCase keys matching the Drizzle property names in `db/schema.ts`. Booleans are booleans. Every row has `updatedAt` and `deletedAt`.
  - Op `delete` means a soft delete: set `deletedAt = updatedAt`.
- **LWW:** incoming is applied only if no server row exists or `incoming.updatedAt > server.updatedAt` (ties go to the server). Otherwise it's a conflict, `{ id: itemId, server: row }`.
- **Server-authoritative plan lock**:
  - `days.forgedAt` is never set from client data directly. A client may request a forge by sending a days row with `forgedAt` non-null while the server's is null. The server runs the forge validation (P1 has `minimum` and `ifThen`) and sets `forgedAt` to server time; if validation fails, it's a conflict. Once forged, it can't be un-forged through sync.
  - **Locked fields:** for missions on a forged day, `title, slot, points, minimum, ifThen, dayDate`, creating a new mission on that day, and deleting one. These need a reason in the outbox item, `meta.lockReason`; the server then writes a `mura_events` row. Without a reason it's a conflict.
  - **Free fields:** `status, resumeNote, actualMin, estMin, rescheduleCount`.
  - `REST POST /missions/:id/edit-locked {reason, patch}` does the same.
- **Other guards:** settings rows with `editableFrom = "even_sunday"` are writable only when `canEditScoring(todayIST())`. At most 2 `write_off` days per month. A guard failure is a conflict, or 400/423 over REST.
- **Core:** `packages/core/src/syncClient.ts` exports `createSyncClient({ store, client, post, onChange, onAuthError })`. It takes an injected `LocalStore` (get/getAll/put, outbox enqueue/peek/remove, meta get/set).
  - It provides `write(table, row, opts?)` and `remove(table, pk)`, an optimistic flush 2 s after a write, `flush()`, and `start()`/`stop()` hooks.
  - Web implements `LocalStore` on IndexedDB (idb). Mobile implements it on expo-sqlite.
- **Client local DB:** a generic row store, `rows(tbl, pk, data JSON, updated_at, deleted_at)` plus `outbox` and `meta`, on both clients. Every client screen reads from the local store, not the network. That makes it offline-first, and the query cache is invalidated on `onChange`.

### Day logic (core)
- `todayIST(now)`: Asia/Kolkata with a 04:00 boundary.
- `isMissedDay`: `kind === normal && (planned === 0 || exec < 25)`. A date with no day row and no missions counts as missed only if it is on or after the first-use date (the earliest `days.date`) and before today.
- `daysShownUp` counts non-excluded days that are not missed.
- **Reschedule chip:** sets status `rescheduled`, does `rescheduleCount + 1`, and creates a copy in the backlog (`dayDate: null`, `slot: backlog`, `status: backlog`) carrying the count.
- **Home routing:** missed yesterday and nothing started today → welcome-back; phone before noon with P1 open → morning; web after the ritual time → ritual prompt; otherwise today.

## Task queue (in order)
1. Phase 0 infra/deploy: 0.3 Terraform, 0.4 cloud-init + bootstrap, 0.6 Caddy + CSP, 0.7 Litestream, 0.8 deploy workflow + deploy.sh + mobile.yml, hash-password.sh, restore.sh
2. Phase 0 app: 0.9 auth API, migrations on boot, env pretty errors, graceful shutdown; 0.10 web Login; 0.11 mobile Login + auth gate
3. v1 core + db: time, scoring, sync helpers, syncClient, row schemas; drizzle migration for v1 (+ changes, sync_items), seed defaults
4. v1 api: days, missions, habits, inbox, settings, sync, devices; route tests (written, not run)
5. v1 web: IndexedDB store + sync, hooks, Shell, Night ritual, Today, Inbox, Welcome back, Settings, Cmd+K, Home routing, Focus
6. v1 mobile: local store + sync, tabs, Morning, Today, Focus, Stuck, Capture, Quick close, Welcome back, Settings, notifications
7. v2: tables, stats, reviews/goals/areas/experiments/stuck/story routes; core averageScore/isoWeek/canEditScoring/pickStory; web Weekly/Monthly/Cycle; story layer; mobile native extras (as far as is sensible without a device)
8. v3: notes + FTS5, files, web Notes, phone note search
9. v4: backup job + export, app/version, passkeys, web push, conflict UI

## Progress
- [x] Skeleton committed; `pnpm install` ok; 0.1 `.npmrc` + `ci.yml`

## Decisions log
- D1: Git author is the existing git config (`dhanush-superdom <dhanush.boopathy@superdom.ai>`), which is a work email. It was left unchanged as instructed. Run `git config user.email` in this repo if you want your personal email instead.
- D2: `.npmrc` keeps pnpm's isolated linker, which Expo SDK 54+ supports. The hoisted fallback is documented in the file.
- D3: Phase/CHANGELOG bookkeeping is done once per area rather than per task, to save time. Commits are still one per task.
- D4: Sandbox placeholder files (`.bashrc`, `.claude/skills`, …) are excluded through `.git/info/exclude`. Project skills in `.claude/skills` could not be read or committed from the sandbox.
