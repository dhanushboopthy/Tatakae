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
- [x] infra: task 1 written, not applied (🟡): 0.3 Terraform, 0.4 cloud-init + bootstrap.sh, 0.6 Caddy CSP/caching, 0.7 Litestream/compose + restore.sh + hash-password.sh, 0.8 deploy.yml + deploy.sh + mobile.yml. 0.2 and 0.5 are manual → `docs/MANUAL-STEPS.md`.
- [x] core: time, scoring, sync helpers + row schemas, settings defaults, story picker, sync client, tests (🟡 written, not run)
- [x] core: db schema v1–v3 (+ changes, sync_items, sessions.last_seen_at), `0000_init` + `0001_notes_fts` migrations, seed.sql, db/migrate.ts (🟡 SQL applied cleanly to an in-memory SQLite as a syntax check only)

## Decisions log
- D1: Git author is the existing git config (`dhanush-superdom <dhanush.boopathy@superdom.ai>`), which is a work email. It was left unchanged as instructed. Run `git config user.email` in this repo if you want your personal email instead.
- D2: `.npmrc` keeps pnpm's isolated linker, which Expo SDK 54+ supports. The hoisted fallback is documented in the file.
- D3: Phase/CHANGELOG bookkeeping is done once per area rather than per task, to save time. Commits are still one per task.
- D4: Sandbox placeholder files (`.bashrc`, `.claude/skills`, …) are excluded through `.git/info/exclude`. Project skills in `.claude/skills` could not be read or committed from the sandbox.
- infra: D5: cloud-init only embeds and runs `deploy/scripts/bootstrap.sh` (base64 via `filebase64`), so there is one copy of the setup logic, it needs no `$$` escaping, and it is also the manual path (`sudo /usr/local/sbin/tatakae-bootstrap`). The Tailscale key line is deleted from `/etc/tatakae/bootstrap.env` once connected.
- infra: D6: The instance ignores changes to `metadata` and the image id. That way a newer Ubuntu image or an edited cloud-init never silently rebuilds the VM. Rebuild on purpose with `terraform apply -replace=oci_core_instance.tatakae`. The reserved IP and the data volume have `prevent_destroy`.
- infra: D7: Extra ingress 41641/udp (security list, iptables, ufw) so Tailscale can make direct connections instead of going through DERP relays. Also added: IMDSv2 only, and an object lifecycle rule (plus the IAM policy it needs) that purges previous object versions after 30 days. Without it, versioning plus Litestream deletions would slowly fill the 20 GB.
- infra: D8: Possible conflict on Ubuntu: ufw and iptables-persistent may be mutually exclusive. bootstrap opens 80/443 in the live iptables and runs `netfilter-persistent save` first, only when it added a rule (so Docker chains are never saved), then installs ufw. Either way the same ports end up open after a reboot. ufw keeps 22/tcp only while Tailscale is down, so a failed `tailscale up` can't lock you out.
- infra: D9: Safety for the data volume: it is formatted only when completely blank, and bootstrap refuses if it has a partition table or if several candidate disks exist. Docker gets `RequiresMountsFor=/srv/tatakae`, so the api can never start against an empty database on the boot disk.
- infra: D10: litestream runs as uid 1000, like the api. web and litestream wait for a healthy api. `snapshot-interval: 24h` added so restores don't replay up to 30 days of WAL. unattended-upgrades reboots at 21:30 UTC (03:00 IST) when needed.
- infra: D11: deploy.sh health = api healthcheck + in-container fetch of `/api/health` + Caddy answering on :80 (a cert may not exist yet on the first deploy). The real HTTPS check is the workflow's smoke test. A rollback re-deploys the previous tag but does not restore the DB snapshot automatically; it prints the `restore.sh --from-file` command.
- infra: D12: deploy.yml runs typecheck + tests before building, because ci.yml is not a dependency of it. `workflow_dispatch` has a `skip_checks` input for emergencies. Doc/mobile/infra-only pushes don't deploy.
- infra: D13: mobile.yml signs through `-Pandroid.injected.signing.*` (survives `prebuild --clean`, no gradle edits) and fails if the APK carries the debug certificate.
- infra: D14: The owner password hash must be single-quoted in `/opt/tatakae/.env` (compose expands `$`). `hash-password.sh` prints the quoted line. **`deploy/.env.example` could not be edited (permission settings deny `.env*` writes)**, so its `OWNER_PASSWORD_HASH=` line still lacks that hint. MANUAL-STEPS step 10 covers it.
- core: `newId()` is a small built-in ULID generator (crypto.getRandomValues, Math.random fallback) instead of the `ulid` package, whose module init throws on React Native before crypto is polyfilled. `ulid` stays in package.json (unused by core).
- core: `Day.energy` is `number | null` (1..5) instead of a literal union so it matches the zod row schema. Rows carry `deletedAt` everywhere. Row schemas are checked against types.ts with `satisfies`.
- core: Goal status enum `active|paused|done|dropped`; watch_queue status `queued|watching|done|dropped` (DB columns stay free text).
- core: `averageScore` returns an integer (rounded). Normal days with nothing planned count in averages (they are missed days); only rest/write-off are excluded.
- core: `capacityCheck` returns `{ ratio, overCapacity, budgetMin }`; budget = floor(free × 0.8); ratio is Infinity when budget is 0 and work is planned.
- core: `isServerAuthoritative(table,row,forgedDates?)` is true for every `days` row and for missions whose `dayDate` is forged (all dated missions if `forgedDates` is omitted). The API must check both the previous and the next dayDate; `isLockedChange(prev,next,forged)` does the field diff (create/delete/locked fields).
- core: `validateForge(missions)` → problems `no_p1 | p1_missing_minimum | p1_missing_if_then | duplicate_slot | too_many_side` (a P1 must exist to forge).
- core: sync client conflicts put the server row locally unconditionally; a conflict with `server: null` (rejected create) soft-deletes the local-only row. `syncResponse.conflicts[].server` is nullable for that case. Remote changes are not zod-validated on the client (only `updatedAt` + PK checked) to stay forward-compatible with new columns.
- core: sync client auto-flush is on by default (debounced 2 s after each write); `stop()` disables it, `start()` re-enables and flushes. A flush always pulls at least once, even with an empty outbox. Backoff 2 s → 60 s; 401 stops retrying and calls `onAuthError`.
- core: `LocalStore.countOutbox()` is optional (falls back to `peekOutbox(10000).length`).
- core: settings defaults live in `packages/core/src/settings.ts` (`DEFAULT_SETTINGS`, `defaultSettingRows()`, `DEFAULT_RECHARGE_ITEMS`, `defaultRechargeRows()`); seeded rows use `updatedAt = 1970-01-01T00:00:00.000Z` so any real edit wins LWW. db/seed.sql has identical values. Recharge ids are fixed: `0000000000RECHARGE0000000{1..5}`.
- core: `pnpm db:generate` could not run (corepack/pnpm tried to download pnpm 9.12.0 from the blocked registry), so migrations were generated with `./node_modules/.bin/drizzle-kit generate --name init` and `--custom --name notes_fts` — same tool, same config.
- core: notes FTS is a standalone `notes_fts(note_id UNINDEXED, title, body)` fts5 table with `porter unicode61` tokenizer, kept in sync by insert/update/delete triggers; soft-deleted notes are dropped from the index.
- core: `db/migrate.ts` loads better-sqlite3 via `createRequire` from apps/api (pnpm isolated linker means it is not resolvable from db/), resolves a relative `DATABASE_PATH` against the repo root, runs the drizzle migrator and then seed.sql.
- core: v3 tables: `applications(company, role, status, applied_on, url, source, next_step, next_step_on, notes)`, `stories` (STAR: situation/task/action/result, tags JSON, goal_id), `japanese_log(date, minutes, kind, note)`. Not synced.

## Core API reference (`@tatakae/core`)
_Signatures only; see JSDoc in `packages/core/src`. Keep adding Progress / Decisions entries in their sections above, not here._

Types: `ISODate, ISOTime, RowMeta, Day, Mission, Habit, HabitLog, Anchor, SettingRow, InboxItem, MuraEvent, StuckEvent, RechargeItem, Area, Goal, Review, Experiment, StoryRef, WatchQueueItem, SyncRowMap, DayScore, ScoringSettings, Mark, Slot, MissionStatus, DayKind, StoryMoment`.

Time: `TZ, DAY_BOUNDARY_HOUR, CYCLE_1, todayIST(now?) → ISODate, istTimeHHMM(now?) → "HH:MM", nowIso(), addDays(date, n), daysBetween(a, b), weekdayOf(date) → 0..6 (0 = Sun), isoWeek(date) → {year, week}, isoWeekRange(year, week) → {start, end}, formatIsoWeek({year, week}) → "2026-W42", parseIsoWeek(s) → {year, week} | null, monthRange("YYYY-MM" | "YYYYMM") → {start, end}, monthOf(date), isIsoDate(s), canEditScoring(date)`.

Scoring: `DEFAULT_SCORING, missionPoints, plannedPoints(ms), earnedPoints(ms), execScore(planned, earned), screenPenalty(min, s?), comebackBonus(yMissed, ms, s?), markFor(final, planned, s?), scoreDay(day, ms, yesterdayMissed, s?) → DayScore, isMissedDay(date, day | null, ms, {firstUseDate, today}, s?), firstUseDate(days), averageScore(scores) → number | null, capacityCheck(plannedMin, freeMin, s?) → {ratio, overCapacity, budgetMin}, daysShownUp(scores), scoringFromSettings(value: unknown) → ScoringSettings`.

Settings: `DEFAULT_SETTINGS, ResolvedSettings, EDITABLE_FROM, SEED_UPDATED_AT, DEFAULT_RECHARGE_ITEMS, defaultSettingRows(at?), defaultRechargeRows(at?), parseSettingValue(key, decoded) → {ok, value} | {ok: false, error}, readSettings(rows) → ResolvedSettings, settingValueSchemas, SettingKey, isSettingKey(k)`. Keys: `scoring, wake_time, ritual_time, focus_default, story_enabled, haptics_enabled, afternoon_nudge`. Values are JSON text in `settings.value`.

Sync (pure): `SYNC_TABLES, SyncTable, isSyncTable(t), SYNC_TABLE_PK, primaryKeyOf(table, row), splitPrimaryKey(table, pk), compareIso(a, b), mergeLww(local, remote), shouldApplyIncoming(serverRow | null, incoming) (server-side, strict >), isServerAuthoritative(table, row, forgedDates?), LOCKED_MISSION_FIELDS, FREE_MISSION_FIELDS, isLockedChange(prev | null, next, forged)`.

Schemas (zod): rows `dayRow, missionRow, habitRow, habitLogRow, anchorRow, settingRow, inboxRow, muraEventRow, stuckEventRow, rechargeItemRow, areaRow, goalRow, reviewRow, experimentRow, storyRefRow, watchQueueRow, rowSchemas[table]`; inputs `missionInput, missionPatch, missionForgeReady, lockedEdit, dayPatch, writeOffInput, habitInput, habitPatch, habitLogInput, anchorInput, inboxInput, inboxPatch, stuckInput, settingPut, goalInput/goalPatch (MAX_ACTIVE_GOALS = 4), areaInput/areaPatch, reviewInput/reviewPatch, experimentInput/experimentPatch, storyRefInput/storyRefPatch, storyPack, storyNextQuery, watchQueueInput, noteInput/notePatch, noteSearchQuery, loginInput, loginMobileResponse`; sync `outboxItem (meta.lockReason?), syncRequest, syncResponse (conflicts[].server nullable), syncConflict, syncTable`; helpers `p1Ready(m), validateForge(ms) → ForgeProblem[]`; primitives `isoDate, isoTime, hhmm`. Inferred types: `OutboxItem, SyncRequest, SyncResponse, ClientKind, MissionInput, MissionPatch, …Input/…Patch, StoryPack`.

Story: `STORY_CHANCE, NO_REPEAT_DAYS, pickStory(refs, moment, recentIds, rand?) → ref | null, recentlyShownIds(refs, now?) (from lastShownAt), MONTHLY_THEMES, themeFor(date)`.

Sync client: `createSyncClient({ store, client, post, onChange(tables), onAuthError(), onConflict?, now?, flushDelayMs? }) → { write(table, row, {lockReason?}) → stored row, remove(table, pk, {lockReason?}), flush(), start(), stop(), getStatus(), subscribe(listener) → unsubscribe }`. `LocalStore { get, getAll(table, {includeDeleted?}), put, enqueue, peekOutbox(limit), removeOutbox(ids), countOutbox?, getMeta, setMeta }`. `SyncStatus { state: idle|syncing|offline|error, lastSyncAt, pending, error }`. `SyncHttpError(status)` — throw from `post` for HTTP errors (401 → onAuthError). Also `RowWrite<T>, SYNC_BATCH, FLUSH_DELAY_MS, CURSOR_META_KEY, newId(), reschedule(mission) → [rescheduled, backlogCopy]`.

DB (`db/schema.ts`): drizzle exports `days, missions, habits, habitLogs, anchors, settings, inbox, muraEvents, sessions (lastSeenAt), jobRuns, areas, goals, reviews, experiments, stuckEvents, rechargeItems, storyRefs, watchQueue, notes, files, pushSubscriptions, applications, stories, japaneseLog, changes, syncItems`. Migrations folder: `db/migrations` (drizzle migrator; `0001_notes_fts` is custom SQL).
