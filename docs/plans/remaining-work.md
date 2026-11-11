# Remaining work — order to finish

Status as of **18 Oct 2026**, branch `feat/f6-fitness-phone` at `d24f38f`. Every status below was checked
against the code, not taken from the markers in `docs/06-phases.md` (several of those are out of date).

**How to use this file in a later session:** read it top to bottom, find the first unticked `- [ ]`, do that
one task (one task per PR), tick it here *and* in `docs/06-phases.md`, add a line to `docs/CHANGELOG.md`.
When a stage's gate is met, write the date next to it.

---

## Where things stand

| Area | State |
|---|---|
| Website (v1–v4 screens, passkeys, notes, reviews, fitness) | Finished and tested (end-to-end tests 5/5 in Run 3). |
| API + core + db | Finished. Tests: core 433, api 117, all passing. |
| Infra / deploy (Phase 0) | Written, **never applied**. No VM, no domain, no running deploy. |
| Phone app | About halfway through v1. Login, sync, Morning, Today, Focus and Fitness work. Seven screens and 20 components are placeholders. No notifications. Never run on a device. |
| Fitness F1–F6 | Finished in code, on six stacked local branches, **not merged to `main`**, not pushed. |
| Phase gates | None met. |

Totals: 21 finished · 17 in progress · 8 not started · 2 dropped.

---

## Why this order

1. **Merge first.** Six unmerged stacked branches get harder to merge with every new commit.
2. **Deploy before more phone work.** The phone app is only useful against a real HTTPS API, every phase gate needs
   real use on the phone, and `docs/06-phases.md` says a phase ends only when its gate is met. Most of Phase 0 is
   manual work for the owner (`docs/MANUAL-STEPS.md`), so it can run alongside phone work if the owner prefers.
3. **Phone v1 next, in the order daily use needs it.** Capture and Quick close first (used every day), then
   Stuck/Recharge, Welcome back, Calendar, Settings, then the Soft Bento restyle, then notifications.
4. **Then v2 → v3 → v4**, phone side only, since the web side of each is done.
5. **Weekly build cap is 6 hours** (`docs/06-phases.md`). Sizes below: S ≈ under 1 h, M ≈ 1–3 h, L ≈ a full week's cap.

---

## Rules for every session (from CLAUDE.md and the owner's standing instructions)

- Read `CLAUDE.md`, `docs/06-phases.md`, and for UI work `docs/05-ui-ux.md`, `docs/10-design-system.md`,
  `docs/11-dashboards-charts-calendar.md` (reference images in `docs/design/references/`).
- One task per PR, Conventional Commits. **No Claude co-author line, no "Generated with" line, no session link.**
  Commits carry the owner's git config only.
- Make file changes with the Edit/Write tools (the owner reviews diffs in the IDE), not `sed -i` or heredocs.
- Scoring, "today" (`todayIST()`), story picking and sync merge come only from `@tatakae/core`.
  `packages/core` stays pure TS.
- All writes go through the outbox on both clients.
- Grey not red; no streaks/XP; ≤ 3 notifications/day; 44 dp targets; ink text on coloured fills.
  Run the `tatakae-guardrails` skill before finishing any UI task.
- **Thirukkural only** — no show/anime/film references or pictures anywhere in the UI.
- **Don't rebuild or restart the local Docker stack** until the owner says so.
- New dependencies: check `docs/04-tech-stack.md`; if not listed, ask the owner first and state why in the PR.
- Ask all questions up front, then work without stopping; report decisions at the end.

### Checks (pnpm is blocked in the sandbox — call the binaries directly)
```bash
# typecheck, one workspace at a time
for w in packages/core apps/api apps/web apps/mobile; do (cd $w && ../../node_modules/.bin/tsc --noEmit -p .); done
# tests
(cd packages/core && node_modules/.bin/vitest run)
(cd apps/api && node_modules/.bin/vitest run)
(cd apps/mobile && node_modules/.bin/vitest run)
```
Servers for an on-screen check must start in the same Bash call as the check (each sandboxed command has its own
loopback). `tsx` needs its IPC socket, so the API may have to run outside the sandbox (see R2-17, R3-2 in
`docs/plans/overnight.md`).

---

## Stage 1 — Housekeeping (S, one session)

- [ ] **1.1 Push the fitness stack and open six PRs** (owner chose this, 18 Oct). Branches in order:
      `feat/f1-fitness-core` → `f2-fitness-sync` → `f3-fitness-day` → `f4-fitness-week-month-phase` →
      `f5-fitness-training` → `f6-fitness-phone`, then every later branch stacked on top.
      **Blocked:** no GitHub credentials on this machine (`git push` asks for a password; `gh` is not logged in).
      Owner: run `gh auth login` (it also sets up git push), then push every branch and open the PRs in order.
- [x] **1.2 Bring `docs/06-phases.md` in line with the code.** (branch `docs/sync-phase-markers`)
- [x] **1.3 Fix `docs/plans/fitness.md` status line.**
- [x] **1.4 `tatakae-ui-update.zip` deleted** (owner, 18 Oct; its contents were merged in `c786fc6`).

**Branch stack after this run** (each branch builds on the one before; open the PRs in this order):
`feat/f1…f6` → `docs/sync-phase-markers` → one `feat/m-…` branch per phone task below.

---

## Stage 2 — Phase 0: deploy (mostly manual, owner-driven)

Follow `docs/MANUAL-STEPS.md` sections 1–16 in order. Claude's part is fixing whatever breaks in the scripts.

- [ ] **0.2** Oracle Cloud account; Pay-As-You-Go decision + ₹1 budget → record as a new entry in `docs/DECISIONS.md`. *(manual, §1–2)*
- [ ] **0.3** OCI API key, SSH key, Tailscale; `terraform apply` in `infra/terraform`. *(manual, §3–7)*
- [ ] **0.4** cloud-init/bootstrap runs on the VM; SSH works over the tailnet only (public 22 closed in §15).
- [ ] **0.5** Domain: `.me` via Student Pack (auto-renew off), A record → reserved IP; `dig` resolves. *(manual, §8; see `docs/DOMAIN.md` for the free fallback)*
- [ ] **0.6** Caddy serves the app over HTTPS with a valid certificate; `/api/health` answers. *(§10, §13)*
- [ ] **0.7** Litestream snapshot visible in the bucket. *(§9, §14)*
- [ ] **0.8** GitHub secrets/variables set; a push to `main` deploys through `deploy.yml`. *(§11–13)*
- [ ] **0.1** CI (`ci.yml`) green on GitHub.
- [ ] **Production env:** `PUBLIC_ORIGIN` = the real https domain (passkeys only work for that domain, R3-8).
- [ ] **0.10** Web installed as an app on both laptops; add a passkey on each.
- [ ] **0.11** Phone dev build: set the real package id in `apps/mobile/app.config.ts`, USB debugging,
      `EXPO_PUBLIC_API_URL=https://<domain> pnpm --filter mobile android`, log in to production. *(§16)*
- **Gate:** logged in on both laptops and the phone over HTTPS; a commit to `main` redeploys. — met on: ____

---

## Stage 3 — Phone v1: the daily loop

Screen specs: `docs/05-ui-ux.md` → "Phone screens". Each placeholder file already has a one-line spec comment at
the top. Port behaviour from the matching web screen where one exists (`apps/web/src/routes/*`,
`apps/web/src/components/*`) but use the phone hooks in `apps/mobile/src/lib/hooks.ts` (they already have
`capture`, `setStatus`, `logHabit`, `updateDay`, `writeOff`, `writeOffsLeft`, `planP1`, `useRecentDays`,
`useInbox`, `useRecharge`, focus start/pause/stop, `homeRedirect`).

### 3.1 Verify data and sync on the device (task v1.6) — S
- [ ] On the phone: create a mission on the laptop → it appears on the phone; change a status on the phone →
      it appears on the laptop; airplane mode → make two writes → back online → both sync, no duplicates.
      Fix what breaks in `src/sync/engine.ts`, `src/sync/outbox.ts`, `src/db/client.ts`. Then mark v1.6 ✅.
- [ ] Also check on the device: the Fitness card and the three fitness log screens (F6 was only typechecked).

### 3.2 Screens, in this order (task v1.7)
All built on 18 Oct (branches `feat/m-soft-bento-theme` … `feat/m-polish`), typechecked and bundled for Android.
The theme and shared components came first so no screen was styled twice. **Not yet run on a device** — 3.1 covers that.

| # | Task | File | Size | Target |
|---|---|---|---|---|
| - [x] a | **Capture**: one autofocused field, Save → `capture()` → outbox → inbox; haptic + toast; opened from the "+" in every header | `app/capture.tsx` | S | ≤ 5 s |
| - [x] b | **Quick close**: mission statuses, habits, screen minutes (manual entry; usage-stats prefill comes in v2). Never plans tomorrow | `app/quick-close.tsx` | M | ≤ 45 s |
| - [x] c | **Stuck**: 3 big choices (Uncertainty → next physical action; Fear → 10/10/10 + act as if confident; Inertia → 5-minute timer now) → one follow-up; logs `stuck_events`. Reuse `src/components/StuckSheet.tsx` | `app/stuck/[missionId].tsx` | M | ≤ 15 s |
| - [x] d | **Recharge**: shown after a focus session; menu from `useRecharge()` | `app/recharge.tsx` | S | — |
| - [x] e | **Welcome back**: after ≥ 1 missed day; calm line, grey history (`useRecentDays`), single Restart → plan P1 only (`planP1`), write-off (max 2/month via `writeOffsLeft`). No missed-day count in red | `app/welcome-back.tsx` | M | — |
| - [x] f | **Calendar tab**: month of DayCircles, 4 scoreboard boxes; tap a day → Day sheet. Needs components `DayCircle`, `MonthCalendar`, `Scoreboard` (3.3) | `app/(tabs)/calendar.tsx`, `app/day/[date].tsx` | L | — |
| - [x] g | **Settings**: times (wake, ritual), story on/off, haptics, devices (list/revoke), sync status. No scoring constants (web only). Default focus length 5–240 (R3-9) — replace the phone's 25/50/90 presets | `app/(tabs)/settings.tsx` | M | — |
| - [x] h | **Today Soft Bento restyle**: header (greeting + date, "+" and bell circles), WeekStrip, count chips (Done/Minimum/Open), P1HeroCard (lime Start arrow), P2 lavender + P3 lime-soft cards, habit pills, 2 MetricCards (today's score after shutdown only, days shown up). No streak | `app/(tabs)/index.tsx` (see TODO at line 32) | M | each action ≤ 5 s |
| - [x] i | **Bottom nav**: floating charcoal pill, active tab = white circle | `app/(tabs)/_layout.tsx`, `src/components/BottomNav.tsx` | S | — |

### 3.3 Components needed by v1 (build when the screen above first needs them)
Specs: `docs/10-design-system.md` §5 and `docs/11-dashboards-charts-calendar.md`. Mirror the web versions in
`apps/web/src/components/`. Charts with `react-native-svg`, icons with `lucide-react-native` + core `ICONS`.
- [x] `Icon`, `IconCircle`, `BottomNav`, `WeekStrip`, `P1HeroCard`, `MetricCard`, `DayCircle`, `MonthCalendar`,
      `Scoreboard`, `RingProgress`, `FocusRing`, `SegmentedPills` (+ `Screen`, `TextField`, `Kural`).
      `StripeTrend` moves to v2 with the Week view; `CapacityBar` is only used by the laptop ritual.
- Leave for v2: `HatchedStackBar`, `BlockBarChart`, `HabitHeatGrid`, `SegmentGauge`, `Sparkline`, `PillBar`.

### 3.4 Notifications (task v1.8) — M
- [x] (code; try it on the device in 3.1) Fill `src/notifications/local.ts`: local schedule only (no server push to the phone).
      1) morning at wake time "P1: <title>. Start?" → opens Morning; 2) optional afternoon, only if P1 not started;
      3) ritual reminder at ritual time. **Max 3/day.** Reschedule when settings or tomorrow's P1 sync.
      Ask permission after the first Quick close or first login, never on launch. If two in a row are ignored, ask
      once whether to change the time. No guilt copy.

### 3.5 Polish (task v1.9) — M
- [x] (code) Empty states, copy, accessibility (contrast, labels, 44 dp targets), dark theme at night. Run
      `tatakae-guardrails` over every phone screen.
- [ ] On the device, light and dark: look at every screen once (text fits, nothing hidden by the floating nav).

- **v1 gate:** 7 consecutive days — ritual on the laptop, daily actions on the phone. — met on: ____

---

## Stage 4 — v2 leftovers (phone side; web is done)

All of Stage 4 is written (18 Oct, code only). Still open: run each item on the phone (see 3.1), and compile the
usage-stats Kotlin in the first dev build (this machine has no Android SDK).

- [x] **v2.0 `/dev/design` kitchen-sink page** on web and phone showing every component from docs/10 §5 and docs/11. (code)
- [x] **4.1 Remaining chart components** on the phone: `HatchedStackBar`, `BlockBarChart`, `HabitHeatGrid`,
      `SegmentGauge`, `Sparkline`, `PillBar`. (code)
- [x] **4.2 Phone Week view** (HatchedStackBar) (code)
- [x] **4.3 Phone read-only Cycle** (SegmentGauge, RingProgress, goals ≤ 4, areas with colour + icon) (code)
- [x] **4.4 Story on the phone** — owner dropped StoryToast on the phone too (18 Oct). Removed.
- [x] **4.5 Native extras (task v2.5)** — dependencies approved by the owner 18 Oct:
    - [x] Quick actions: launcher long-press "Start focus", "Capture" (expo-quick-actions@6.0.2) (code)
    - [x] Share intent: Android share sheet → Capture (expo-share-intent@8.0.1) (code)
    - [x] Ongoing focus notification with remaining time (code)
    - [x] Android home-screen widget: P1 title + Start / Done (react-native-android-widget@0.22.1) (code)
    - [x] Usage stats: local Expo module `modules/usage-stats` → prefills screen minutes in Quick close; Settings →
          Screen minutes for access + choosing apps; manual entry stays the fallback (code; Kotlin not compiled yet)
- Branch stack (each on the one before, none pushed yet): feat/f1…f6 → docs/sync-phase-markers →
  feat/m-soft-bento-theme → feat/m-restyle-existing → feat/m-capture → feat/m-quick-close → feat/m-stuck-recharge →
  feat/m-welcome-back → feat/m-calendar → feat/m-settings → feat/m-notifications → feat/m-polish →
  feat/m-week-cycle → feat/design-pages (also carries the v2.5 native extras, one commit each).
- **v2 gate:** the Sunday review completed in the app. — met on: ____

---

## Stage 5 — v3 phone

- [ ] **5.1 Capture-to-note** on the phone (task v3.3). Notes are REST-only (R2-7), not synced, so this posts to
      `/notes` directly and needs a connection; say so calmly when offline. — M
- [ ] **5.2 Read-only note search** on the phone via `/notes/search`. Editing stays on the laptop. — M
- **v3 gate:** one full week of notes kept in the app. — met on: ____

---

## Stage 6 — v4 hardening

- [ ] **6.1 Restore drill** (task v4.2) on a fresh VM with `deploy/scripts/restore.sh` (Terraform → cloud-init →
      Litestream restore). Record time-to-restore in `docs/08-operations.md`. *(owner + Claude)* — L
- [ ] **6.2 Release APK** (task v4.3):
    - [ ] Release keystore + GitHub secrets (`docs/MANUAL-STEPS.md` §17). *(manual)*
    - [ ] Run `npx eas-cli@latest init` in `apps/mobile` (or remove the `updates` block) — `updates.url` still has a placeholder project id.
    - [ ] In-app "update available": compare the app version with `/api/app/version`; calm banner, link to the release.
    - [ ] EAS Update channel wired for JS-only fixes (channels already in `apps/mobile/eas.json`).
    - [ ] First tag `mobile-v0.1.0` → APK on GitHub Releases → installed (uninstall the dev build first).
- [ ] **6.3 Web push** (task v4.5): verify a real push arrives on a laptop in production. — S
- [ ] **6.4 Conflict UI** (task v4.6): offline edge cases (two devices editing the same mission offline, plan
      lock refusals) and an accessibility audit, laptop + phone, light + dark. — M
- [ ] **6.5 Area alignment + monthly review polish** (task v4.7): alignment scores are built (Monthly review,
      Settings → Areas). **Ask the owner** what "polish" should cover, then do that list. — S–M
- **v4 gate:** restore rehearsed and documented. — met on: ____

---

## Real-use gates that run alongside the build

These need days of actual use, not code. Start each as soon as its stage allows.

- [ ] **Fitness gate:** a cut started in the app shows targets; a week of food and weight logged on the phone and
      reviewed on the laptop. *Can start once 0.11 (phone installed against production) is done.*
- [ ] **v1:** 7 days in a row (after Stage 3).
- [ ] **v2:** Sunday review in the app (after Stage 4).
- [ ] **v3:** one week of notes (after Stage 5).

---

## Decisions needed from the owner

1. Fitness merge: six PRs in order, or one merge into `main`? (1.1)
2. What to do with `tatakae-ui-update.zip`? (1.4)
3. Deploy first (recommended) or phone v1 first while doing the manual Phase 0 steps on the side?
4. ~~Phone StoryToast~~ — answered 18 Oct: removed on the phone too. (4.4)
5. ~~New dependencies for v2 native extras~~ — answered 18 Oct: all three approved; usage stats is a local module. (4.5)
6. What "monthly review polish" means. (6.5)

---

## Already finished (for reference — don't redo)

Phase 0: 0.9 auth, 0.10 web login + install prompt. · v1: 1 core, 2 db, 3 api, 4 web sync, 5 web screens.
· v2: 1 db/api, 2 core, 3 web planner/reviews/Cycle, 4 web story (then removed, R3-10). · v3: 1 notes/FTS/files,
2 web Notes, 4 applications/stories/Japanese. · v4: 1 backup/export, 4 passkeys, 8 focus length 5–240.
· Fitness F1–F6 (code). · Dropped: Notion import #1 and #2 (R2-14).
