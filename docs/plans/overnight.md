# Overnight build — plan, shared design, decisions log

Started 2026-10-11 ~23:00 IST. Owner asleep; work runs unattended. Read this file first, then CLAUDE.md and the docs your area needs.

> **Status 2026-10-12 morning:** the overnight run is over. It was stopped by a usage limit, and then the Soft Bento UI update was merged (`c786fc6`).
> - The "no tests / no typecheck" and "never ask" rules applied only to that night. `pnpm typecheck` and `pnpm test` now run, and 340/340 tests pass.
> - **UI tokens changed.** See *Progress* and D15–D20 below before touching any screen.
>
> **Run 2 (started 2026-10-12, unattended): finish the whole website, v1 → v4. Mobile waits.** The owner chose:
> - Scope: every web screen in v1–v4, plus the core/api/db work those screens need.
> - Styling: restyle everything to Soft Bento (login, shell and night ritual included), then delete the web `legacy-*` tokens.
> - Checks: `pnpm typecheck` and the affected tests before each commit, fixing failures as they come up.
> - Git: one Conventional Commit per task on `main`. No questions mid-run; decisions go in the *Decisions log* (R2-…).

## Ground rules (owner's instructions for tonight)
- **Do not run tests or typecheck.** Write test files where useful, but do not run them or try to make them pass. Owner runs them in the morning.
- **Never touch anything outside `/home/dhanush/Projects/TATAKAE`.** Do not run `scripts/setup-claude.sh`; it installs to user scope.
- **Never ask the owner questions.** Pick the sensible option and log it under *Decisions log* below.
- **Git:** one Conventional Commit per task on `main`, using the existing git config. Never change the author. Never add a `Co-Authored-By` line or any mention of Claude. Stage only your own paths (`git add <paths>`). If `index.lock` exists, wait a few seconds and retry; another agent may be committing.
- **Edit files with the Edit or Write tools**, not `sed`, heredocs or scripts. The owner reviews diffs in the IDE.
- **Dependencies:** anything listed in `docs/04-tech-stack.md` or already in a package.json is fine (`pnpm add --filter <pkg> <dep>`; the npm registry is reachable). Avoid anything unlisted. If you truly need it, add it and log why.
- TypeScript strict and no `any` (use `unknown` and narrow). Zod for API I/O. `packages/core` stays pure TS.
- UI rules: grey not red, no streaks or XP, 44px/dp targets, calm copy (docs/05-ui-ux.md).
  - **Visual system is now "Soft Bento"** (docs/10-design-system.md + docs/11): light by day and dark from ritual time, with ink text on all coloured fills.
  - The old dark tokens (ink `#0b0b0f`, paper, muted, ember, jade, …) are **legacy only**; see D15.
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
- [x] api: 0.9 auth (env, db bootstrap, errors, sessions, auth middleware, rate limit, graceful shutdown) and v1 api (row store + change log, days, missions, habits, inbox, settings, sync) + route tests (🟡 written, not typechecked or run). See *API reference* below.
- [~] web (partial, stopped by the usage limit):
  - Done: design tokens, 0.10 login + auth gate + install prompt, IndexedDB store + sync engine, query hooks, shell + command palette + shared components, night ritual wizard.
  - Unfinished: Today, committed as `wip`.
  - **Not started:** Focus, Inbox, Capture, Welcome back, Settings, Home routing, PWA icon.
- [~] mobile (partial; stopped on purpose before the UI merge):
  - Done: app config + metro, 0.11 login + auth gate, sqlite row store + sync engine, focus timer math + tests, query hooks, components + theme, tabs + Today + Morning.
  - Unfinished: Focus screen + sync init, committed as `wip`.
  - **Not started:** Stuck, Recharge, Capture modal, Quick close, Welcome back, Settings, local notifications.
- [ ] v2–v4 backend: not started (the agent died before writing anything). The v2/v3 routes are still 501 stubs, and `/stats/*` + `/focus` are new 501 stubs from the UI update.
- [x] Soft Bento UI update merged (`c786fc6`):
  - Content: docs/10 + docs/11 + docs/design (references, mockups), core `stats.ts` + `icons.ts` (stubs), `focus_sessions` table + `missions.planned_start`, `areas.color/icon`, `goals.target_points` (migration `0002_soft_bento_ui`), web `/calendar` route + nav, mobile Calendar tab + `capture` modal + `day/[date]`, 40+ chart/nav component stubs (web + mobile), lucide + Plus Jakarta Sans deps, `.claude/skills/tatakae-guardrails/SKILL.md`.
  - Checks after merge: typecheck passes for core, api and web; mobile has 1 error from before the merge (D19); tests 340/340.
- [x] **Run 2 (12 Oct, website v1 → v4)**, one commit per task on `main`:
  - `c4d994d` core stats engine · `ec69689` api /stats + /focus · `f0cdacb` web Soft Bento foundation · `3b5e88c` focus, calendar, week planner · `21d3c78` inbox, capture, welcome back, morning, routing · `d4a4cb1` settings + PWA icons · `f658207` api v2 routes · `6e62d5c` weekly / monthly / cycle.
  - `f01a614` v3 api: notes + FTS5, files, applications, stories, japanese log.
  - `9fd56da` v3 web: Notes (BlockNote), Applications, Stories, Japanese.
  - `12dd049` v4 api: export, job log, nightly backup, app version, web push.
  - `18eae3d` v4 web: push opt-in, conflict note, Playwright smoke test (written).
  - Final checks: typecheck clean (core, api, web); tests core 285, api 95, web 37; `vite build` OK.
  - **Not done:** passkeys (R2-12), Playwright install (R2-13), visual check (R2-17), mobile (out of scope for Run 2).
- **Next:** passkeys once the registry is reachable; then mobile (v1 Focus onward).

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
- api: Env: `OWNER_EMAIL`, `OWNER_PASSWORD_HASH` and `SESSION_SECRET` get placeholder defaults only when `NODE_ENV=development` (login fails until a real hash is set; or use `DEV_BYPASS_AUTH=1`). Production also requires an `$argon2…` hash and a non-default secret. New optional vars: `MIGRATIONS_DIR`, `KEEP_WARM`.
- api: The `session` context variable is `{ id, client, deviceName, expiresAt }` (adds `expiresAt` to the shared design). Logout and device revoke hard-delete the session row (sessions are never synced). The device id in `/session/devices` is the stored sha256 hash, never the token.
- api: The rate limiter is in-memory per process and counts every `POST /session/login` (successful ones too), keyed by the first X-Forwarded-For hop.
- api: Every REST and sync write goes through `rows.service.upsertRow`. It validates with core `rowSchemas` (unknown keys are dropped) and appends to `changes`. REST writes stamp `updatedAt = max(now, prev + 1 ms)`, so a REST write always wins LWW even against a device clock that runs ahead.
- api: Sync runs one SQLite transaction per request, with a savepoint per item, so an unexpected error turns only that item into a conflict. Only applied item ids go into `sync_items`; conflicts are re-evaluated if retried. Invalid rows are conflicts carrying the server row (or null). A `delete` for a row the server never saw is an applied no-op.
- api: A rejected forge request (P1 not ready) or a write-off over the limit, sent through sync, still stores the other fields. It answers with a conflict carrying the **stored row** (forgedAt null / previous kind), not null, so the client converges without losing the ritual answers. A forged day can't be un-forged: an incoming `forgedAt` is ignored once the server has one.
- api: Pull: a non-numeric cursor, or one ahead of the log (e.g. after a restore), gives a full snapshot. Changes echo the client's own applied writes, which is harmless under LWW and is how the client learns the server-stamped `forgedAt`.
- api: REST status codes: plan lock and the scoring guard → 423 (`plan_locked`, `scoring_locked`); write-off limit → 400 `write_off_limit`; forge validation → 400 `forge_invalid` with `detail.problems`; a missing reason for a write-off → 400 `write_off_reason`.
- api: The write-off reason has no column. It is stored in `days.qDrift` unless the same request sets `qDrift`.
- api: `PUT /settings/scoring` merges the partial value over the stored one. Through sync, unknown setting keys are accepted (forward-compatible), known keys are validated, and `editableFrom` is always server-owned.
- api: Inbox → note inserts into `notes` (REST-only, not synced, so it bypasses the change log), with one BlockNote paragraph per line.
- api: `apps/api/tsup.config.ts` bundles `@tatakae/core` into `dist/server.js` (`noExternal`). Core ships TS source (`main: src/index.ts`), which plain node in the container cannot import.
- api: keepWarm stays a no-op. `KEEP_WARM=1` only logs a one-time reminder to upgrade the account to Pay-As-You-Go. Migrations folder = `MIGRATIONS_DIR`, else walk up from the module to the first `db/migrations/meta/_journal.json`. ZodErrors are detected by `name`, in case core and api resolve different zod copies.
- api: Not built: `/api/bootstrap` (clients use `POST /sync` with a null cursor) and the v2/v3 routes (still 501 stubs).
- D15 (owner's choice, UI merge): **Soft Bento is the official token set. Night forge is legacy.**
  - Web `tailwind.config.js` keeps the old dark tokens under a `legacy` group. The overnight screens use them as `bg-legacy-ink-2`, `text-legacy-muted`, `border-legacy-line-strong`, `rounded-legacy-card`, …; `index.css` and `index.html` too.
  - The bare `ink`, `line` and `danger` classes now mean **Soft Bento** values, and `ink` is a *text* colour. Never use the bare old names for the old look.
  - Mobile `theme.ts` exports Soft Bento (`light`, `dark`, `radius` {card 28, inner 20, pill}, `font`, `iconCircle`, `floatShadow`) plus the legacy `colors`, `legacyRadius` (old `radius`), `type`, `text`, `ui`, `tnum`, `motion`, `lineHeight`.
  - New code uses Soft Bento only. Delete the legacy block once every screen is restyled.
- D16: The old docs/10 ("Night forge") moved to `docs/design/legacy-night-forge.md`, marked superseded. docs/10 is now the update's Soft Bento spec.
- D17: The class rename (~190 web classes in 24 files) and `radius` → `legacyRadius` (11 mobile files) were done with a perl script. This breaks the "Edit tool only" rule, so review them in `git show c786fc6`.
- D18: Merge conflicts:
  - Kept ours: `apps/web/src/components/CapacityBar.tsx` (working component; the update's was a stub).
  - Removed: the stub `(tabs)/capture.tsx`. The phone now has **no capture entry point** until the header "+" button from docs/10 is built.
  - Added: Stack screens `capture` (modal) and `day/[date]` in `app/_layout.tsx`, and `CalendarIcon` in web `icons.tsx`.
- D19: Mobile typecheck fails at `packages/core/src/syncClient.ts:276` (`new Set([table])` widens to `Set<T>` under the Expo tsconfig). This was already there before the merge and is not fixed yet (one-line fix: type the Set as `Set<SyncTable>`).
- D20: The new columns are optional in core types/row schemas (`Mission.plannedStart`, `Area.color/icon`, `Goal.targetPoints`), so existing code compiles and sync carries them.
  - `focus_sessions` is **not** in `SYNC_TABLES` yet. Add a row schema, PK and API registry entry when `/focus` is built.
  - `plannedStart` is a free field (not plan-locked).
  - Plus Jakarta Sans is installed but not imported yet, so it falls back to Inter/system.

### Run 2 decisions (R2-…)
- R2-1: New setting `focus_week_target` (600 minutes/week) drives the focus-hours box; also in `db/seed.sql`.
- R2-2: The web `BottomNav` was removed. It is a phone pattern; the website uses the icon rail (md+) and top pills (narrow).
- R2-3: The display name for the greeting is stored locally (`lib/profile.ts`, localStorage, per laptop), not as a synced setting.
- R2-4: The story pack is imported client-side: Settings → Story validates the pack with core `storyPack` and writes `story_refs` rows through the outbox (sync), so it works offline. `POST /story/import` exists for scripts.
- R2-5: Web dashboards compute scores from the local store with core `stats.ts` (offline-first). The `/stats/*` routes give the same numbers for the phone and scripts.
- R2-6: The week planner's time rail runs 06:00–24:00.
- R2-7: v3 tables are REST-only through `localCrudRoutes` (lib/crud.ts + lib/local.service.ts). Migration `0003_notes_body_text` adds `notes.body_text` (plain text from core `blocksToText`) and rebuilds the FTS triggers to index it; before, the raw BlockNote JSON keys matched every search. Old notes are backfilled on boot. Search input is turned into quoted prefix terms (core `ftsQuery`), so it can never be parsed as FTS syntax.
- R2-8: Files live at `FILES_DIR/files/<id>` (same key in Object Storage); `files.name` keeps the original name. Only images, PDF and plain text are served inline; everything else is a download, with `CSP: sandbox` and `nosniff`, so an uploaded HTML/SVG can't run as the app's origin. Delete is soft and the bytes stay for restores. An Object Storage failure doesn't fail the upload (`offsite: false`).
- R2-9: BlockNote 0.55 (`@blocknote/core`, `react`, `mantine`) is lazy-loaded in its own chunk (≈ 943 KB, 284 KB gzipped). Colours come from CSS overrides of BlockNote's variables in `index.css`; BlockNote's theme object follows the OS colour scheme, not the app's. Installed with pnpm 10.27 and `npm_config_manage_package_manager_versions=false`; the lockfile stays v9.
- R2-10: Applications, Stories and the Japanese log share the Notes rail item through library tabs instead of three new rail icons (the rail stays at 8).
- R2-11: Nightly backup = local `BACKUP_DIR` (default `<db dir>/backups`, newest 7, mode 600) + Object Storage `backups/` (newest 30). The export leaves out `sessions`, `changes`, `sync_items` and `push_subscriptions`, and lists files without their bytes.
- R2-12: **Passkeys not built.** The npm registry started refusing requests mid-run, even with the host declared, so `@simplewebauthn/server` and `@simplewebauthn/browser` couldn't be installed. WebAuthn verification was not hand-rolled instead. To do: `pnpm add --filter api @simplewebauthn/server` and `pnpm add --filter web @simplewebauthn/browser`, then the routes, a `passkeys` table, the Settings screen and the login button.
- R2-13: Playwright smoke test written (`apps/web/e2e/smoke.e2e.ts`, `playwright.config.ts`, `pnpm --filter web e2e`), but `@playwright/test` is not installed (same registry problem). The file is named `*.e2e.ts` so vitest never collects it, and `e2e/` is outside the web tsconfig.
- R2-14: **Notion import dropped** (owner, 12 Oct: there is no Notion data; the app starts fresh). `scripts/notion-import/` removed; the phase gates and docs/01 no longer mention Notion.
- R2-15: Web push is opt-in per laptop and sends only the same 06:30 morning message the phone shows, so it doesn't add a new kind of reminder (the ≤ 3/day rule). Each send is a `job_runs` row; subscriptions the push service reports gone (404/410) are deleted. App version comes from `MIN_MOBILE_VERSION` (default 0.1.0) and `LATEST_APK_URL`.
- R2-16: Conflict UI: one calm toast per sync round plus an "Edited elsewhere" pill on the mission card for 10 minutes. Kinds: newer (another device saved later), kept (the server refused: plan lock, guards), undone (refused create).
- R2-17: **Visual check skipped.** tsx can't create its IPC pipe in the sandbox, so the API was bundled with tsup into `apps/api/dist` (removed afterwards). Each sandboxed command gets its own loopback, so the servers must run inside the same command. Firefox is a Snap and `snap-confine` can't run in the sandbox. Demo data seeded over REST against the running API without errors, which exercised the v2/v3 routes live.

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

## API reference (`apps/api`, all under `/api`)
_JSON in and out, with camelCase rows exactly as in core's row schemas (real booleans, `updatedAt`, `deletedAt`)._
- **Errors:** `{ error: code, message, detail? }`. A zod failure is 400 `invalid_input` with `detail` = issues.
- **401:** the body is `{ error: "unauthorized" }`. Clients should treat it as logged out.
- **Auth:** web sends the `tatakae_session` cookie (fetch with `credentials: "include"`). Mobile sends `Authorization: Bearer <token>`. Scripts send `Bearer <API_TOKEN>`.

**Public**
- `GET /health` → `{ ok, at }`
- `POST /session/login` `{ email, password (≥ 8), client: "web"|"mobile", deviceName (1–40) }`
  - web → Set-Cookie, `{ email, client, deviceName, expiresAt }`
  - mobile → `{ token, expiresAt }`
  - bad credentials → 401 `invalid_credentials`; over 10 attempts / 15 min / IP → 429 with `Retry-After`

**Session (auth)**
- `GET /session/me` → `{ email, client, deviceName, expiresAt }`. These are null for API_TOKEN or dev bypass. The web cookie is re-set when the expiry slides.
- `POST /session/logout` → `{ ok }`. Deletes the session and clears the cookie.
- `GET /session/devices` → `{ devices: [{ id, client, deviceName, createdAt, lastSeenAt, expiresAt, current }] }`
- `DELETE /session/devices/:id` → `{ ok }` (404 if unknown)

**Days**: every route returns a DayView `{ day, missions, score: DayScore, yesterdayMissed, firstUseDate }`. The day is synthesised (epoch `updatedAt`) if unsaved, and missions are live ones ordered P1, P2, P3, side.
- `GET /days/:date`
- `PUT /days/:date`: body is `dayPatch` + `reason?`. Switching to `write_off` needs `reason` → 400 `write_off_reason`; a third in a month → 400 `write_off_limit`. `forgedAt` is ignored.
- `POST /days/:date/forge`: 400 `forge_invalid` `{ detail: { problems: ForgeProblem[] } }`. Idempotent once forged.

**Missions**: on a forged day, a locked change without a reason → 423 `plan_locked`.
- `GET /missions?date=YYYY-MM-DD` | `?backlog=1` → `{ missions }`
- `POST /missions`: body is `missionInput` + `id?` + `reason?` → 201 `{ mission, muraEvent }`. Status is `backlog` when `dayDate` is null or slot is backlog, else `open`. A duplicate id → 409.
- `PATCH /missions/:id` `missionPatch` → `{ mission, muraEvent: null }`
- `POST /missions/:id/edit-locked` `{ reason, patch }` → `{ mission, muraEvent }`. `muraEvent` is null if nothing locked changed.
- `DELETE /missions/:id?reason=…` → `{ mission, muraEvent }` (soft delete)
- `POST /missions/:id/reschedule` → `{ mission, backlog }`. 409 if already rescheduled, 400 for backlog items.

**Habits**
- `GET /habits?date=` → `{ habits, logs }`. `date` defaults to today IST; returns all live habits, including inactive ones.
- `POST /habits`: `habitInput` + `id?` → 201 `{ habit }`
- `PATCH /habits/:id`: `habitPatch` → `{ habit }`
- `DELETE /habits/:id` → `{ habit }`
- `PUT /habits/:id/logs/:date` `{ done }` → `{ log }`

**Inbox**
- `GET /inbox` → `{ items }` (unprocessed, oldest first)
- `POST /inbox` `{ text, id? }` → 201 `{ item }`
- `PATCH /inbox/:id` `{ text?, processed? }` → `{ item }`
- `PATCH /inbox/:id` (process) `{ to: "mission", mission?: { title?, dayDate?, slot?, points?, minimum?, ifThen?, goalId?, estMin? }, reason? }` | `{ to: "note", title? }` | `{ to: "discard" }` → `{ item, mission?, muraEvent?, noteId? }`
  - The item becomes `processed`; discard also soft-deletes it.
  - The mission defaults to title = the text, in the backlog.

**Settings**
- `GET /settings` → `ResolvedSettings` `{ scoring: {...full}, wake_time, ritual_time, focus_default, story_enabled, haptics_enabled, afternoon_nudge }`
- `PUT /settings/:key` `{ value }` → `{ key, value }`
  - unknown key → 404, invalid value → 400 `invalid_setting`
  - `scoring` is a partial merged over the stored value, and outside an even-ISO-week Sunday (IST) → 423 `scoring_locked`

**Sync**
- `POST /sync` `syncRequest { client, cursor, items ≤ 500 }` → `syncResponse { applied, conflicts: [{ id, server | null }], changes: [{ table, row }], cursor }`
  - Full snapshot when the cursor is null.
  - Every item ends up in `applied` or `conflicts`.
  - Conflicts: LWW loss or tie, an invalid row, a locked mission change without `meta.lockReason`, the scoring guard, and a rejected forge or write-off (the latter two carry the stored row).
  - Plain REST writes also show up in later pulls.

**Stats and focus (Run 2)**: all numbers come from core `stats.ts`.
- `GET /stats/scoreboard?date=` → `{ date, boxes: MetricBox[] }` · `/stats/calendar/:yyyymm` → `{ month, days: CalendarDay[] }` · `/stats/series?metric=&days=` → `Series` · `/stats/week/:isoWeek` ("2026-W43") → `WeekStats` · `/stats/month/:yyyymm` → `MonthStats` · `/stats/cycle?date=` → `CycleStats` · `/stats/habits?days=` → `HabitGrid` · `/stats/focus-hours` → `{ counts: number[7][24] }`
- `/focus`: `GET ?from=&to=` → `{ sessions }` (by app day, newest first) · `POST` focusInput → 201 `{ session }` · `PATCH /:id` · `DELETE /:id` (soft)

**v2 resources (Run 2)**: `/goals`, `/areas`, `/experiments`, `/reviews` follow lib/crud.ts: `GET /` → `{ items }`, `GET /:id`, `POST` (+ `id?`) → 201 `{ item }`, `PATCH /:id`, `DELETE /:id` (soft). Every write is recorded for sync.
- `/goals`: a goal must pass the hell-yeah gate to be active → 400; a 5th active goal → 409 `too_many_goals` (the same rules apply through sync).
- `/experiments`: one running at a time → 409 `experiment_running`; `end ≥ start`.
- `/reviews`: one per type and period → 409 `review_exists`; creating a weekly review unlocks one reward episode.
- `/stuck`: `GET ?from=&to=` → `{ items }`; `POST` stuckInput → 201 `{ item }`.
- `/story`: `GET /` · `POST /import` storyPack → `{ added, skipped }` · `PATCH /:id` · `GET /next?moment=` → `{ story | null }` · watch queue `GET/POST /watch`, `PATCH/DELETE /watch/:title`.

**v3 (REST only, not synced)**: `/notes`, `/applications`, `/stories` and `/japanese` follow lib/crud.ts `localCrudRoutes`, with the same shapes as above.
- `/notes`: `GET ?tag=&goalId=` → `{ items: NoteSummary[] }` (no body; `excerpt`; newest first) · `GET /search?q=` → `{ items: NoteSearchHit[] }` (title weighted 10×; 50 max) · `GET /:id` → `{ item: Note }` (`bodyJson` = BlockNote blocks, `tags` normalised).
- `/files`: `POST` multipart `file` (≤ 20 MB) + `noteId?` → 201 `{ item: FileMeta, offsite }` · `GET ?noteId=` → `{ items }` · `GET /:id` → the bytes · `DELETE /:id` (soft).
- `/applications`: sorted offer → interview → applied → wishlist → closed, then by `nextStepOn`. `/stories`: STAR fields + tags. `/japanese`: `GET ?from=&to=` (IST dates), newest first; `minutes` 1–600.

**v4**
- `GET /export` → `{ app: "tatakae", format: 1, exportedAt, tables }` as a download. `GET /system/jobs` → `{ runs }` (newest 50).
- `GET /app/version` (public) → `{ minMobileVersion, latestApkUrl | null }`.
- `/push`: `GET /key` → `{ publicKey }` (503 `push_off` without VAPID) · `POST /subscribe` `{ endpoint (https), keys: { p256dh, auth }, device? }` → 201 · `DELETE /subscribe` `{ endpoint }` · `POST /test` `{ endpoint }` → `{ sent }`.
- Jobs: 02:00 IST backup (`job: "backup"`), 06:30 IST morning push (`job: "morning_push"`, only with VAPID keys and subscriptions).
