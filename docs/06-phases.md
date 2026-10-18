# 06 · Phases — implementation plan

Rules for every phase
- **Weekly build cap: 6 hours.** Build work is never a weekday P1 in TATAKAE itself.
- Work top-to-bottom; each task is one small PR (Conventional Commits).
- A phase ends only when its **gate** is met. Don't start the next phase early.
- Each task's definition of done: typecheck + tests green, works offline for the write path it touches, 44 px targets, no red/streak/XP, docs/CHANGELOG updated.

| Phase | Dates | Theme | Gate |
|---|---|---|---|
| 0 | 12–18 Oct 2026 | Foundations: infra, auth, deploy, both clients log in | Logged in over HTTPS on 2 laptops + phone app; push to `main` redeploys |
| v1 | 19 Oct – 1 Nov | Daily loop | 7 consecutive days in the app only |
| v2 | 2 – 15 Nov | Reviews, story layer, phone native extras | Sunday 15 Nov review done in the app |
| v3 | 16 Nov – 13 Dec | Notes / second brain | One week of notes kept in the app |
| v4 | 14 Dec 2026 – 3 Jan 2027 | Hardening, releases, restore drill | Restore rehearsed and documented |

No Notion import: there is no Notion data, the app starts fresh (decision R2-14, 12 Oct 2026).

---

## Phase 0 — Foundations (12–18 Oct)
**Goal:** a deployed, secured, empty app reachable from all three devices.

| # | Task | Area | Done when |
|---|---|---|---|
| 0.1 | `pnpm install`, typecheck/test pass; `.npmrc` decision for Expo | repo | CI green |
| 📝 0.2 manual — see MANUAL-STEPS.md | OCI account (home region Mumbai/Hyderabad); decide Pay-As-You-Go upgrade + ₹1 budget alert | infra | Documented in DECISIONS |
| 🟡 0.3 | Terraform: VCN, subnet, security list (80/443), A1 2 OCPU/12 GB arm64, reserved IP, block volume, backup bucket | infra | `terraform apply` succeeds |
| 🟡 0.4 | cloud-init/bootstrap: Docker, iptables 80/443, ufw, fail2ban, unattended-upgrades, Tailscale; close public 22 | infra | SSH only via tailnet |
| 📝 0.5 manual — see MANUAL-STEPS.md | Domain: claim `.me` via Student Pack, auto-renew off, A record → reserved IP | infra | `dig` resolves |
| 🟡 0.6 | Caddy + hello page over HTTPS; `/api/health` | deploy | Valid certificate |
| 🟡 0.7 | Litestream to Object Storage | deploy | Snapshot visible in bucket |
| 🟡 0.8 | GitHub Actions deploy (arm64 build → GHCR → Tailscale SSH → health check) | ci | Push to main deploys |
| ✅ 0.9 | Auth: `sessions` table, `/api/session/*`, `auth` middleware (cookie + bearer), rate limit, `hash-password.sh` | api | Tests for login/logout/expiry |
| ✅ 0.10 | Web: Login screen, 401 handling, desktop install prompt (code done; install on the laptops after deploy) | web | Installed on both laptops |
| 🟡 0.11 | Phone: Expo dev build (`expo run:android` or EAS development), Login with SecureStore, `/api/session/me` | mobile | Dev client installed and logged in to production |
| **Gate** | Logged in on all 3 devices over HTTPS; a commit to `main` redeploys automatically | | |

## v1 — Daily loop (19 Oct – 1 Nov)
**Goal:** run every day from the app.

Order (each builds on the previous):
1. ✅ **core:** `todayIST`, `addDays`, `stats.ts` v1 functions (calendarState, monthGrid, pointBreakdown, scoreboard, summarizeWeek — done in Run 2), full `scoring.ts` + table-driven tests (100 % branch coverage), `mergeLww`, `isServerAuthoritative`.
2. ✅ **db:** v1 migrations (days, missions, habits, habit_logs, anchors, settings, inbox, mura_events, sessions, job_runs) + seed (scoring defaults, wake 06:30, ritual 21:30, focus 50, recharge menu).
3. ✅ **api:** `/stats/scoreboard`, `/stats/calendar`, `/stats/series`, `/stats/week` (points), `/focus` (done in Run 2); days (GET with score, PUT, forge), missions (CRUD, 423 on locked without reason, `edit-locked` → mura), habits + logs, inbox, settings (even-Sunday guard), `/sync`, devices list/revoke. Route tests.
4. ✅ **web sync:** IndexedDB outbox + engine; optimistic writes; TanStack Query hooks.
5. ✅ **web screens:** Night ritual wizard (all 8 steps, CapacityBar, P1 validation, forge), **bento Dashboard** (P1 hero, score box, screen StripeTrend, inbox box), **Calendar month view**, Inbox, Welcome back, Settings (basic), Cmd+K palette.
6. 🟡 **mobile data:** local SQLite schema + migrations, outbox, sync engine (AppState, NetInfo, debounce), Query hooks. (Code written and typechecked; not yet run on a device.)
7. 🟡 **mobile screens:** (all built and restyled to Soft Bento, typechecked and bundled; not run on a device yet) Morning, Today (week strip, chips, P1 hero, 2 scoreboard boxes), **Calendar tab** (month DayCircles, 4 scoreboard boxes, Day sheet), Focus (FocusRing, logs focus_sessions) (timer from start time, keep-awake, recharge after), Stuck sheet, Capture, Quick close, Welcome back, Settings.
8. 🟡 **mobile notifications:** (written + planning tested; not tried on a device) local schedule (morning, optional afternoon, ritual), reschedule on settings sync, permission asked after first Quick close/login.
9. 🟡 **polish:** empty states, copy, accessibility pass (contrast, labels, targets), dark theme. (Guardrails pass in code; the on-screen check needs the device.)
- **Gate:** 7 consecutive days: ritual on laptop, daily actions on phone.

## v2 — Reviews, story, native extras (2 – 15 Nov)
0. ✅ **design:** `/dev/design` kitchen-sink pages (web + phone) with every component from docs/10 §5 and docs/11 — done before step 3.
1. ✅ **db/api:** `/stats/month`, `/stats/cycle`, `/stats/habits`, missions.planned_start, areas.color/icon, goals.target_points; goals, areas, reviews, experiments, stuck_events, recharge_items, story_refs, watch_queue; `/stats/week`, `/stats/month`, CRUD routes.
2. ✅ **core:** `averageScore`, `isoWeek`, `canEditScoring`, `pickStory` (+ tests).
3. 🟡 **web + phone:** (web ✅ in Run 2; phone Week view + read-only Cycle built 18 Oct, not run on a device yet) Week planner calendar (TimeRail, AreaBlocks, drag backlog), Weekly Control Room (HatchedStackBar, Sparkline, StripeTrend, PillBar stuck, Muri/Mura/Muda, stuck breakdown, experiment, reward unlock), Monthly review (BlockBarChart marks + area minutes, HabitHeatGrid), Cycle page (SegmentGauge, RingProgress, goals ≤ 4, hell-yeah gate, areas with color + icon). Phone: Week view (HatchedStackBar) and read-only Cycle.
4. ✅ **story layer:** (web side done; phone StoryToast dropped by the owner, 18 Oct — same as R3-10) reference pack import (validate ≤ 160 chars, moment enum), StoryToast on both clients, mute, seasonal theme, watch queue rules. **Web pop-ups removed (owner, 14 Oct, R3-10):** no StoryToast and no Settings → Story on the website; the reward queue moved to Settings → General. Tables, `/api/story/*` and core `pickStory` stay.
5. **mobile native:** share intent → inbox; quick actions (Start focus, Capture); Android widget (P1 + Start/Done); **usage stats** custom module to prefill screen minutes (Usage access permission flow; manual fallback); ongoing focus notification.
6. ~~**Notion import #1**~~ dropped: no Notion data (R2-14).
- **Gate:** Sunday 15 Nov review completed in the app.

## v3 — Notes (16 Nov – 13 Dec)
1. ✅ notes table + FTS5 virtual table + triggers; files table; `/notes`, `/notes/search`, `/files` (multipart to disk + Object Storage copy).
2. ✅ Web Notes: list, BlockNote editor, tags, goal links, can-explain / can-implement / misunderstood, search.
3. Phone: capture-to-note and read-only note search (editing stays on laptop).
4. ✅ applications, stories, japanese_log tables + simple screens (API ✅, web screens ✅).
5. ~~Notion import #2~~ dropped: no Notion data (R2-14).
- **Gate:** one full week of notes kept in the app.

## v4 — Hardening (14 Dec – 3 Jan)
1. ✅ Nightly JSON backup job + `/api/export`; `job_runs` shown in Settings → Data.
2. **Restore drill** on a fresh VM using `restore.sh` (Terraform → cloud-init → Litestream restore). Record time-to-restore.
3. Signed release APK workflow on `mobile-v*` tags; `/api/app/version` (✅) + in-app "update available"; EAS Update channel for JS fixes.
4. ✅ Web passkeys (WebAuthn) as primary login; password fallback (R3-8). Production: `PUBLIC_ORIGIN` must be the real https domain.
5. 🟡 Optional laptop web push.
6. 🟡 Conflict UI (subtle "edited elsewhere" note) ✅ code; on-screen visual check, laptop + phone, light + dark ✅ (R3-3); Playwright smoke test ✅ 4/4 (`pnpm --filter web e2e`, R3-5/R3-6); offline edge cases + accessibility audit pending.
7. Area alignment scores; monthly review polish.
8. ✅ Settings: default focus length takes any 5–240 minutes (core schema + Settings → General, R3-9).
- **Gate:** restore rehearsed and documented.

## Fitness (F1–F6)
Plan and decisions: `docs/plans/fitness.md`. One task per PR, in order. All fitness maths lives in `packages/core/src/fitness.ts`; all new tables sync through the outbox. No new dependencies; charts are hand-rolled SVG.
- [x] **F1** core maths + schemas + tests (`fitness.ts`, row and settings schemas; table-driven, incl. cap and floor cases)
- [x] **F2** tables, migration, sync wiring (core / API / web / mobile stores)
- [x] **F3** web Fitness page: Day tab + food library
- [x] **F4** web Week / Month / Phase tabs + weekly maintenance entry + Weekly Review check-in
- [x] **F5** web Training tab
- [x] **F6** phone quick-log modals + Today card
- **Gate:** a cut started in the app shows targets, a week of food and weight logged on the phone and reviewed on the laptop.

## Later (not scheduled)
iOS build (needs paid Apple account), Wear OS tile, calendar read-only import, open-sourcing with an empty reference pack.
