# Leftover tasks — tracker and work orders

Status as of **11 Nov 2026**, branch `feat/catalyst-hosting` at `11eb2b3`. Written to be handed to a coding agent
(Sonnet) one task at a time. It replaces the open items in `docs/plans/remaining-work.md` for everything except infra.

**Baseline measured on 11 Nov:** typecheck clean in all four workspaces. Tests: core 459, web 36, mobile 57 pass.
API 160 of 161 pass; the one failure is a timeout fixed by task A1.

## Scope

**In scope:** app code, phone testing on a device, release steps, usage gates.

**Out of scope. Do not touch or plan these:**
- Hosting. The Oracle and Zoho Catalyst setups were removed on 11 Nov 2026 (owner has another plan).
- The restore drill (v4.2) and the host-level parts of security task v4.9.

Where a task below needs a deployed site or domain, it is marked **Blocked by hosting**. Skip it and move on.

---

## Tracker

Tick a task here when every acceptance criterion passes.

`Who` means: **Agent** can finish it alone. **Owner** must do it by hand. **Both** means the owner does the
physical part (phone, accounts) and the agent fixes what breaks.

| ✓ | ID | Task | Who | Size | Needs |
|---|---|---|---|---|---|
| [x] | A1 | Fix the flaky login test | Agent | S | — |
| [x] | A2 | Delete the dead web `P1HeroCard` stub | Agent | S | — |
| [x] | A3 | Phone app icon | Agent | S | — |
| [x] | A4 | Bring `docs/FEATURES.md` up to date | Agent | S | — |
| [ ] | A5 | Get the unmerged work onto `main` | Both | M | A1–A4 |
| [ ] | B1 | Build and install the dev client on the phone | Both | M | — |
| [ ] | B2 | Verify sync and offline on the phone (v1.6) | Both | M | B1 |
| [ ] | B3 | Verify the daily-loop screens (v1.7) | Both | L | B2 |
| [ ] | B4 | Verify reminders (v1.8) | Both | M | B2 |
| [ ] | B5 | Verify Week view and Cycle (v2.3) | Both | S | B2 |
| [ ] | B6 | Verify native extras (v2.5) | Both | L | B2 |
| [ ] | B7 | Verify phone notes (v3.3) | Both | S | B2 |
| [ ] | B8 | Verify Fitness quick-log (F6) | Both | S | B2 |
| [ ] | B9 | Polish and accessibility audit (v1.9, v4.6) | Both | M | B3–B8 |
| [ ] | C1 | Release keystore and GitHub secrets | Owner | S | — |
| [ ] | C2 | EAS project and update-signing certificate | Owner | S | — |
| [ ] | C3 | First release, `mobile-v0.1.0` | Both | M | B9, C1, **hosting** |
| [ ] | D1 | Laptop web push, tried for real (v4.5) | Both | S | — |
| [ ] | D2 | Security review of the deployed site (v4.9) | Agent | M | **hosting** |
| [ ] | E1 | Usage gates | Owner | days | B9 |

Sizes: S is under 1 hour, M is 1–3 hours, L is about a full week's 6-hour build cap.

---

## Rules for the agent

Read `CLAUDE.md` first. Then:

1. **One task per run, one PR per task.** Work in the order of the tracker. Don't start a task whose `Needs` aren't ticked.
2. **Ask all questions at the start, then work without stopping.** Report decisions at the end.
3. **File edits use the Edit or Write tools**, never `sed -i`, heredocs or scripts, because the owner reviews diffs in
   the IDE. The only exception is the binary PNGs in A3, which a script has to generate.
4. **Commits:** Conventional Commits, owner's git config only. **No Claude co-author, no "Generated with" line, no
   session link**, in commits or PRs. Never change the git author.
5. **Commit and push only when the task says so.** Branch from the tip of the previous task's branch (this repo uses
   stacked branches) until A5 is done, and from `main` after that. Name branches `fix/…`, `chore/…`, `docs/…`, `feat/m-…`.
6. **Hard product rules:** grey not red, no streaks or XP, at most 3 notifications a day, morning is one screen, logging
   takes at most 60 s, 44 dp targets, ink text on coloured fills.
7. **Thirukkural only.** No show, anime or film references or pictures anywhere in the UI.
8. **Shared logic comes only from `@tatakae/core`:** scoring, "today" (`todayIST()`, 04:00 IST boundary), sync merge.
   `packages/core` stays pure TS. All writes go through the outbox.
9. **No new dependencies** unless listed in `docs/04-tech-stack.md`. Otherwise stop and ask the owner.
10. **Never rebuild or restart the local Docker stack**, unless the owner says so.
11. **Secrets never go in the repo.** Test credentials and screenshots stay outside it (screenshots contain personal data).
12. **Run the `tatakae-guardrails` skill** before finishing anything that changes UI, copy or notifications.

### When a task is done
- Tick it in the tracker above and fill in the bug log at the end if bugs were found.
- Update the matching row in `docs/06-phases.md`. Change 🟡 to ✅ only when the **whole** row is verified.
- Add one line to `docs/CHANGELOG.md` under *Unreleased*, in the style of the lines already there.
- Say plainly what was tested on a device and what wasn't. **Passing typecheck is not device verification.**

### Commands
`pnpm` is blocked in the agent sandbox, so call the binaries directly.

```bash
# Typecheck, one workspace at a time (from the repo root)
for w in packages/core apps/api apps/web apps/mobile; do (cd $w && ../../node_modules/.bin/tsc --noEmit -p .); done

# Tests
for w in packages/core apps/api apps/web apps/mobile; do (cd $w && node_modules/.bin/vitest run --passWithNoTests); done

# Website end-to-end (the owner's shell, or the agent if browsers are available)
pnpm --filter web e2e
```

Servers used for a check must start in the same Bash call as the check, because each sandboxed command has its own
loopback. `tsx` needs an IPC socket, so the API may have to run outside the sandbox, which goes through the permission
prompt.

---

## A. Repo cleanup (no device needed)

### A1 — Fix the flaky login test

**Why:** `apps/api/src/routes/security.test.ts:62`, "successful logins don't count", makes 40 argon2 logins. It takes
about 3 s alone and passes every time, but hits vitest's default 5 s limit when the full API suite runs in parallel.
This will fail CI at random.

**Files:** `apps/api/src/routes/security.test.ts`

**Subtasks**
- [ ] Add an explicit timeout as the third argument of that `it(...)`, 30 000 ms, with a one-line comment saying why
      (argon2 × 40 under parallel load).
- [ ] Keep 40 logins. The global cap under test is 30, so the loop has to go past it.
- [ ] Don't raise the timeout for the whole suite, and don't weaken the assertion.
- [ ] Run the full API suite three times in a row.

**Acceptance criteria**
- [ ] Full API suite passes 161 of 161, three runs in a row.
- [ ] The diff touches only that test.
- [ ] Typecheck passes for `apps/api`.

**Commit:** `test(api): give the 40-login throttling test room under parallel load`

---

### A2 — Delete the dead web `P1HeroCard` stub

**Why:** `apps/web/src/components/P1HeroCard.tsx` is a 4-line TODO that returns `null`, and nothing imports it. The
website's P1 hero is built inside `routes/Today.tsx` and `routes/Morning.tsx`.

**Do not touch** `apps/mobile/src/components/P1HeroCard.tsx`. That one is real and in use.

**Subtasks**
- [ ] Confirm no importers: `grep -rn "P1HeroCard" apps/web/src`. It should match only the stub. If anything else
      matches, stop and report it.
- [ ] Delete the file. (Deleting is fine with `git rm`; there is no diff to review.)
- [ ] Leave the `P1HeroCard` spec in `docs/10-design-system.md`, since the phone follows it.

**Acceptance criteria**
- [ ] The file is gone, and `grep -rn "P1HeroCard" apps/web/src` returns nothing.
- [ ] `apps/web` typecheck and tests pass.
- [ ] `/dev/design` on the website still builds (`vite build` succeeds).

**Commit:** `chore(web): remove the unused P1HeroCard stub`

---

### A3 — Phone app icon

**Why:** `apps/mobile/assets/` has only a README, so the phone app has no icon. `apps/mobile/app.config.ts:36` carries
the TODO. `docs/11-dashboards-charts-calendar.md` §6 already defines the mark: a charcoal tile with three rising
rounded steps, grey → lavender → lime, an adaptive foreground on charcoal, and a monochrome variant for Android 13
themed icons. `scripts/make-icons.mjs` already draws this mark for the website, with no dependencies.

**Files:** `scripts/make-icons.mjs`, `apps/mobile/app.config.ts`, `apps/mobile/assets/*`

**Subtasks**
- [ ] In `scripts/make-icons.mjs`, change `render(size, maskable)` to take a mode:
  - `tile`: the current non-maskable output.
  - `maskable`: the current maskable output.
  - `foreground`: transparent background and the three steps only. Scale the 48-unit grid into the central 66 % of the
    canvas (`scale = size * 0.66 / 48`, `offset = size * 0.17`).
  - `mono`: same geometry as `foreground`, all three steps solid white on transparent.
- [ ] Add a `--mobile` flag that writes these to `apps/mobile/assets/`:
  `icon.png` (1024, tile), `adaptive-icon.png` (1024, foreground), `monochrome-icon.png` (1024, mono).
  Handle the flag before the existing "arguments are directories" logic.
- [ ] Without the flag, the script must behave exactly as before.
- [ ] Run `node scripts/make-icons.mjs --mobile`.
- [ ] In `app.config.ts`, add `const monochrome = asset("monochrome-icon.png");` and include `monochromeImage` in
      `adaptiveIcon` when it exists. Keep `backgroundColor: "#262626"`. Remove the `TODO(phase0)` comment.
- [ ] Update `apps/mobile/assets/README.md` to say these files come from the script.
- [ ] Open each PNG with the Read tool and check it looks right.

**Acceptance criteria**
- [ ] `file apps/mobile/assets/*.png` shows all three as 1024 × 1024 RGBA.
- [ ] All three steps sit inside the central 66 % of `adaptive-icon.png` and `monochrome-icon.png`.
- [ ] `monochrome-icon.png` has only white and transparent pixels.
- [ ] Running `node scripts/make-icons.mjs` with no flag leaves `apps/web/public/` unchanged in `git status`.
- [ ] `apps/mobile` typecheck passes. No TODO remains on the icon line.
- [ ] The artwork is only the mark, with no text and no franchise art.

**Commit:** `feat(mobile): app icon, adaptive foreground and themed monochrome from the shared mark`

---

### A4 — Bring `docs/FEATURES.md` up to date

**Why:** it still calls built things stubs or planned. Use 🟡 for phone features ("built, not yet run on a device").
**Never write ✅ for a phone feature** until section B verifies it.

**Files:** `docs/FEATURES.md` only.

**Check each change against the code before writing it.**

| Line | Now says | Should say |
|---|---|---|
| 29 | Restart ritual 🚧 uncommitted | ✅ web, once confirmed in `apps/web/src` |
| 31 | Morning ✅ phone | 🟡 phone, not run on a device |
| 37–40 | Phone ✅ | 🟡 phone, not run on a device |
| 41–44 | Stuck, Recharge, Capture, Quick close stubs | 🟡 built, not run on a device |
| 73 | Phone Calendar and Day sheet stubs | 🟡 built |
| 82 | Phone Week view and Cycle ⬜ | 🟡 built |
| 86–92 | Story pop-ups and import in Settings | StoryToast removed on both clients (R3-10, 18 Oct); tables, `/api/story/*` and `pickStory` remain |
| 96, 100 | Phone notes ⬜ | 🟡 built: capture-to-note and read-only search |
| 104–105 | Phone Settings ⬜, Story section listed | 🟡 built; remove Story, and add the reward queue under General |
| 120 | Phone local notifications ⬜ | 🟡 built |
| 124–127 | Passkeys blocked | ✅ passkeys are primary login on the web, with password fallback. Add the security hardening in one line |
| 143 | In-app "update available" ⬜ | ✅ code |
| 166–169 | "Still to come" list | Replace with a pointer to `docs/plans/leftover-tasks.md`, and keep the **Later** line |

**Leave alone:** line 9 and the hosting rows in section 11, because that's infra.

**Acceptance criteria**
- [ ] Every row in the table above is resolved, and each new status matches the code.
- [ ] `grep -n "stub" docs/FEATURES.md` returns nothing about phone screens.
- [ ] No phone feature is marked ✅ unless it says the status covers code only.
- [ ] No lines about infra changed.

**Commit:** `docs: bring FEATURES in line with the code`

---

### A5 — Get the unmerged work onto `main`

**Why:** `feat/catalyst-hosting` is 52 commits ahead of `origin/main`, including phone screens and security hardening.
It has no upstream. `feat/security-hardening` is also missing from the remote. PRs #1–#19 were opened on 18 Oct and
their current state is not known.

**Decision (owner, 11 Nov):** merge the whole stack. The Oracle and Zoho Catalyst files and code were removed first
(commit `chore: remove the Oracle Cloud and Zoho Catalyst hosting …`), so the `libsql` dependency and the lockfile
problem are gone: `pnpm-lock.yaml` already matches `package.json`.

**Owner**
- [ ] Check `gh auth status`. If not logged in, run `gh auth login`.

**Agent**
- [ ] Run the checks from *Commands*.
- [ ] Run `gh pr list --state all --limit 60` and record which PRs are open, merged or closed.
- [ ] List branches not on the remote and push them, in stack order.
- [ ] Open PRs for anything without one, in stack order. PR bodies carry no Claude attribution.
- [ ] Hand the merge to the owner, unless the owner explicitly says the agent may merge.

**Owner**
- [ ] Merge in stack order using merge commits, with CI green at each step.

**Expected:** there is no deploy workflow any more, so a push to `main` only runs `ci.yml`, `security.yml` and, on
`mobile-v*` tags, `mobile.yml`.

**Acceptance criteria**
- [ ] `git rev-list --count origin/main..feat/catalyst-hosting` returns 0, or only the commits the owner chose to hold back.
- [ ] `ci.yml` is green on `main`.
- [ ] `security.yml` has run on `main`, and any findings are reported to the owner.

---

## B. Phone on a real device

None of this code has ever run on a phone. Expect bugs, and treat finding them as the point of this section.

### Shared setup for all B tasks

The phone tests against a **local API**, since there's no deployed site yet. Don't use the Docker stack (rule 10).
Once production exists, use its URL instead and skip the `adb reverse` for 8787.

**Owner, once.** Create an env file **outside the repo**, for example `~/tatakae-phone-test.env`:

```bash
NODE_ENV=development
DATABASE_PATH=./data/phone-test.db
OWNER_EMAIL=you@example.com
OWNER_PASSWORD_HASH='<output of: deploy/scripts/hash-password.sh --raw>'
SESSION_SECRET=<at least 32 random characters>
```

Keep the single quotes around the hash, because it contains `$`.

**Each session:**
```bash
# Terminal 1: API (the code doesn't load .env files itself)
cd apps/api && set -a && . ~/tatakae-phone-test.env && set +a && node_modules/.bin/tsx watch src/server.ts

# Terminal 2: website, proxies /api to :8787
cd apps/web && node_modules/.bin/vite

# Terminal 3: phone over USB, then Metro
adb reverse tcp:8787 tcp:8787 && adb reverse tcp:8081 tcp:8081
EXPO_PUBLIC_API_URL=http://localhost:8787 pnpm dev:mobile
```

`EXPO_PUBLIC_*` values are fixed when Metro bundles, so always start Metro with the variable set.

**How the agent can see and drive the phone when it's connected by USB:**
```bash
adb devices                                     # must list the phone as "device"
adb exec-out screencap -p > "$TMPDIR/s.png"     # then open it with the Read tool
adb shell uiautomator dump /sdcard/u.xml && adb exec-out cat /sdcard/u.xml   # element bounds, to check 44 dp
adb shell input tap X Y                         # tap
adb logcat -d -t 300 ReactNativeJS:V '*:E'      # recent JS logs and native errors
adb shell cmd uimode night yes                  # dark mode (night no = light)
adb shell wm density                            # for converting px to dp: dp = px × 160 / density
```

If the sandbox blocks `adb`, retry through the permission prompt. Don't change the sandbox settings. If no device is
connected, stop and give the owner the checklist for the current task instead of guessing.

**Loop for every B task:** run a check → on failure, record it in the bug log → find the root cause → fix it → re-run
that check. Use the `systematic-debugging` skill for anything not obvious. **Fix the code, never loosen the
acceptance criterion.** Use one commit per fix, named `fix(mobile): …`.

---

### B1 — Build and install the dev client

**Done means** v0.11's install step, against the local API for now. It's the first time the Kotlin in
`modules/usage-stats` and the three native dependencies get compiled.

The package id is already set to `dev.dhanush.tatakae` in `app.config.ts`. It's permanent after the first install, so
the owner should confirm it now.

**Owner**
- [ ] Install the Android SDK and JDK 17: `docs/MANUAL-STEPS.md` §16 step 2. Or use the EAS route in step 5.
- [ ] Turn on USB debugging: §16 step 3. `adb devices` must list the phone.
- [ ] Run `pnpm --filter mobile doctor` and pass on the output.
- [ ] Build and install: `EXPO_PUBLIC_API_URL=http://localhost:8787 pnpm --filter mobile android`.

**Agent**
- [ ] Fix every build failure at its cause. Likely places:
      `modules/usage-stats/android/**/UsageStatsModule.kt`, plugin config in `app.config.ts`, native version mismatches.
- [ ] Keep generated `apps/mobile/android/` out of git.
- [ ] If requests fail with a cleartext-traffic error, make HTTP allowed **for development builds only**. Release
      builds stay HTTPS-only.

**Acceptance criteria**
- [ ] `expo run:android` finishes with no errors, and the Kotlin module compiled.
- [ ] The app opens to the login screen with no red error screen.
- [ ] Logging in with the test owner works and lands on Morning, Today or Welcome back.
- [ ] The device appears in the website's Settings → Devices.
- [ ] `adb logcat` shows no uncaught JS errors during this.

---

### B2 — Sync and offline (v1.6)

**Files if it breaks:** `apps/mobile/src/sync/engine.ts`, `sync/outbox.ts`, `db/client.ts`, `lib/hooks.ts`.

| # | Steps | Pass when |
|---|---|---|
| 1 | Create a mission on the website | It shows on the phone within 30 s of opening the app |
| 2 | Change a mission's status on the phone | It shows on the website after a refresh |
| 3 | Airplane mode, make two writes on the phone | The UI updates at once and the writes wait in the outbox |
| 4 | Turn airplane mode off | Both sync, with no duplicates on either side |
| 5 | Edit the same mission on both while the phone is offline, then reconnect | Both converge on the later edit, and the phone shows one calm "Edited elsewhere" note |
| 6 | Forge the plan on the website, then edit a locked mission on the phone without a reason | The change is refused and reverted, with a calm message |
| 7 | Same edit with a typed reason | It goes through and a mura event is logged |
| 8 | Force-stop the app with unsynced writes, then reopen | The writes survive and sync |
| 9 | Restart the phone, open the app | Still logged in, data present |
| 10 | Revoke the phone from the website | The phone goes to login at its next request, and local data isn't erased |

**Acceptance criteria**
- [ ] All 10 pass on the phone.
- [ ] No duplicate rows after any scenario.
- [ ] Row 6 in `docs/06-phases.md` v1 (mobile data) is set to ✅.

---

### B3 — Daily-loop screens (v1.7)

Test each in light mode now. Dark mode is covered in B9. Time the steps that have a limit, using a stopwatch.

| Screen | File in `apps/mobile/` | Pass when |
|---|---|---|
| Login | `app/login.tsx` | Wrong password gives a calm message. Right password signs in |
| Morning | `app/morning.tsx` | Fits **one screen with no scrolling**. Nothing else shows until P1 is started or deferred. Start begins focus |
| Today | `app/(tabs)/index.tsx` | Week strip, status chips, P1 hero, 2 scoreboard boxes. Today's score only after shutdown. No streak. Each action ≤ 5 s |
| Focus | `app/(tabs)/focus.tsx` | Timer runs from the start time and survives leaving the app. Screen stays awake. A `focus_sessions` row is logged |
| Recharge | `app/recharge.tsx` | Appears after a focus block, using the menu from settings |
| Stuck | `app/stuck/[missionId].tsx` | Three choices lead to one follow-up. Logs `stuck_events`. **≤ 15 s** |
| Capture | `app/capture.tsx` | Field is autofocused. Saves to the inbox. Haptic and toast. **≤ 5 s** |
| Quick close | `app/quick-close.tsx` | Statuses, habits, screen minutes. Never plans tomorrow. **≤ 45 s** |
| Welcome back | `app/welcome-back.tsx` | Shows after a missed day (change the device date or use test data). Grey history, nothing red. Restart plans only P1. Write-off is capped at 2 a month |
| Calendar | `app/(tabs)/calendar.tsx` | Month circles coloured by mark, 4 scoreboard boxes |
| Day sheet | `app/day/[date].tsx` | Opens on a day tap, read-only |
| Settings | `app/(tabs)/settings.tsx` | Times, reminders, focus length 5–240, theme, sync status, devices. No scoring constants |
| Bottom nav | `app/(tabs)/_layout.tsx` | Floating charcoal pill, active tab is a white circle, covers no content |

Also check the "today" rollover: with an open day, confirm the date changes at **04:00 IST**, not midnight.

**Acceptance criteria**
- [ ] Every row passes on the phone, and the timed rows are within their limits.
- [ ] Screens contain no red, no streak or XP wording, and no show or film references.
- [ ] Row 7 in `docs/06-phases.md` v1 (mobile screens) is set to ✅.
- [ ] `tatakae-guardrails` was run over any screen that changed.

---

### B4 — Reminders (v1.8)

**Files:** `apps/mobile/src/notifications/local.ts`, `notifications/plan.ts`, `lib/reminders.ts`

**Subtasks.** Set times 2–3 minutes ahead in Settings to avoid waiting.
- [ ] Permission is asked after the first login or Quick close, **never on launch**.
- [ ] The morning reminder fires at wake time reading "P1: <title>. Start?", and tapping it opens Morning.
- [ ] The optional afternoon reminder fires **only if P1 hasn't started**, and doesn't fire once it has.
- [ ] The ritual reminder fires at ritual time.
- [ ] Changing times in Settings on the website reschedules them on the phone after sync.
- [ ] Changing tomorrow's P1 updates the morning text.
- [ ] Ignore two in a row: Today asks **once** whether to change the times.
- [ ] Reminders still fire after a phone restart. Check `RECEIVE_BOOT_COMPLETED` behaviour.
- [ ] Permission denied: the app works normally with no nagging.

**Acceptance criteria**
- [ ] All of the above pass on the phone.
- [ ] Never more than 3 reminders on any day. Count them in the notification history.
- [ ] Copy contains no guilt wording.
- [ ] Row 8 in `docs/06-phases.md` v1 (mobile notifications) is set to ✅.

---

### B5 — Week view and read-only Cycle (v2.3)

**Files:** `apps/mobile/app/cycle.tsx`, the Week view reached from the phone's navigation (find it from
`docs/05-ui-ux.md`), and `src/components/HatchedStackBar.tsx`, `SegmentGauge.tsx`, `RingProgress.tsx`.

**Subtasks**
- [ ] Open both with real data. Add a week of missions and a cycle with goals from the website first.
- [ ] Compare the numbers with the website's Week and Cycle pages.
- [ ] Confirm the Cycle page has no way to edit anything.
- [ ] Open `app/dev/design.tsx` and check every chart draws correctly.

**Acceptance criteria**
- [ ] Numbers match the website exactly.
- [ ] Charts are drawn correctly on the phone, with hatching visible and nothing clipped.
- [ ] Goals are capped at 4, and areas show colour **and** icon.
- [ ] The phone part of v2.3 in `docs/06-phases.md` is set to ✅.

---

### B6 — Native extras (v2.5)

**Share to Capture** (`src/native/shareIntent.ts`, `shareText.ts`)
- [ ] Share text from another app: Capture opens prefilled.
- [ ] Share a link from Chrome: "title — text — link" appears, one tap to save.
- [ ] Sharing with the app closed and with it open both work.

**Launcher shortcuts** (`src/native/quickActions.ts`)
- [ ] Long-press the icon: "Start focus" opens Focus, "Capture" opens the capture sheet.
- [ ] After sign-out the shortcuts are gone.

**Home-screen widget** (`src/native/P1Widget.tsx`, `widget.ts`)
- [ ] Add "Tatakae P1" to the home screen: today's P1 title and Minimum appear on a charcoal card.
- [ ] **Start** opens Focus and begins a block at the default length, unless one is running.
- [ ] **Done** marks P1 done through the outbox **without opening the app**, and it reaches the website after sync.
- [ ] Done works offline, and syncs later.
- [ ] With no P1 it shows "No P1 yet today · Tap to plan one mission."
- [ ] It redraws when the mission changes in the app.

**Ongoing focus notification** (`src/notifications/local.ts`, `src/focus/timer.ts`)
- [ ] It shows during a focus block with the end time, and can't be swiped away.
- [ ] Tapping it opens Focus. It clears when the block ends or stops.

**Usage stats** (`modules/usage-stats/`, `src/native/usageMinutes.ts`, `usageStats.ts`)
- [ ] Settings → Screen minutes opens the system "Usage access" page, and returning shows access granted.
- [ ] Apps list shows this week's apps, most used first.
- [ ] Tick two apps, use one for a few minutes: Quick close prefills the minutes since 04:00 IST.
- [ ] The prefill is editable and a saved or typed number is never overwritten.
- [ ] With access refused, manual entry still works.
- [ ] Compare one day's total with Android's Digital Wellbeing. Within 5 minutes is fine.

**Acceptance criteria**
- [ ] All boxes above pass on the phone.
- [ ] None of these add a notification toward the daily 3, other than the ongoing focus one, which is user-started.
- [ ] v2.5 in `docs/06-phases.md` is set to ✅.

---

### B7 — Phone notes (v3.3)

**Files:** `apps/mobile/app/notes/index.tsx`, `notes/[id].tsx`, `src/lib/notes.ts`, `lib/noteText.ts`, `app/capture.tsx`

**Subtasks**
- [ ] Capture → "Save as a note": the first line becomes the title and the rest one paragraph per line.
- [ ] The note appears on the website.
- [ ] Offline: the words are kept and the app says calmly that notes need a connection.
- [ ] Notes sheet opens from Capture and from the Calendar header.
- [ ] Recent notes list, then search as you type via `/notes/search`.
- [ ] A note written on the website, including headings and lists, reads correctly.

**Acceptance criteria**
- [ ] All pass on the phone. There are no editing controls on the note view.
- [ ] Offline text is never lost.
- [ ] v3.3 in `docs/06-phases.md` is set to ✅.

---

### B8 — Fitness quick-log (F6)

**Files:** `apps/mobile/src/components/FitnessCard.tsx`, `fitnessUi.tsx`, `app/fitness/body.tsx`, `food.tsx`, `set.tsx`

**Subtasks.** Start a cut on the website first.
- [ ] The Today card shows kcal left, protein to go and one-tap food, water and set.
- [ ] Body: log weight, steps, water, sleep.
- [ ] Food: search, copy yesterday, recents, manual new food.
- [ ] Sets: same again, rest timer, up next.
- [ ] All three work offline and sync once with no duplicates.
- [ ] Compare the totals with the website's Fitness Day tab.
- [ ] Going over target is grey or butter, **never red**.

**Acceptance criteria**
- [ ] All pass on the phone, each log in ≤ 60 s.
- [ ] Phone and website numbers match exactly.
- [ ] No new notifications added.

---

### B9 — Polish and accessibility audit (v1.9, v4.6)

**Subtasks.** Do this for every screen in B3–B8, in **light and dark**, using `adb shell cmd uimode night`.
- [ ] Take a screenshot of each. Text fits, and nothing is hidden behind the floating nav or keyboard.
- [ ] Empty states exist and read calmly, on a fresh account with no data.
- [ ] Touch targets: from `uiautomator` bounds, every tappable element is at least 44 dp.
- [ ] Contrast: text meets WCAG AA. Coloured fills use ink text.
- [ ] Status is never shown by colour alone.
- [ ] TalkBack: go through Morning, Today, Capture and Quick close, and every control has a sensible label.
- [ ] Set the largest system font size: Morning still works and nothing important is cut off.
- [ ] Reduced motion (Android "Remove animations"): animations stop.
- [ ] Website: the same audit, light and dark, at laptop width. Run `pnpm --filter web e2e` as well.

**Acceptance criteria**
- [ ] Every screen passes in both themes.
- [ ] Any fix made was followed by a `tatakae-guardrails` run with no violations.
- [ ] Rows v1.9 and v4.6 in `docs/06-phases.md` are set to ✅.

---

## C. Release

### C1 — Release keystore and GitHub secrets (Owner)
Follow `docs/MANUAL-STEPS.md` §17 steps 1–3.

**Acceptance criteria**
- [ ] The keystore and password are in a password manager, with one offline copy. **If lost, the app can never be updated in place.**
- [ ] `gh secret list` shows the four `ANDROID_*` secrets.
- [ ] No keystore file in the repo.

### C2 — EAS project and update-signing certificate (Owner)
Follow §17 notes: `npx eas-cli@latest init` in `apps/mobile`, `gh variable set EAS_PROJECT_ID`, generate the certificate
with `npx expo-updates codesigning:generate`, commit `certs/certificate.pem` only.

**Acceptance criteria**
- [ ] `apps/mobile/certs/certificate.pem` is committed, and `apps/mobile/keys/` is git-ignored and in a password manager.
- [ ] Expo account has two-factor authentication on.
- [ ] `expo config` shows an `updates` block with `codeSigningCertificate` when `EAS_PROJECT_ID` is set.

### C3 — First release, `mobile-v0.1.0` — **Blocked by hosting**
`mobile.yml` refuses to run without the `DOMAIN` repository variable, and the APK has the API address built in.

**Subtasks**
- [ ] Owner sets the `DOMAIN` variable once the site is live.
- [ ] Confirm `version` in `app.config.ts`.
- [ ] Owner: `git tag mobile-v0.1.0 && git push origin mobile-v0.1.0`.
- [ ] Agent fixes any `mobile.yml` failure.
- [ ] Owner uninstalls the dev build, then installs the APK. Local data is lost and resyncs from the server.
- [ ] Set `MIN_MOBILE_VERSION` and `LATEST_APK_URL` on the server.

**Acceptance criteria**
- [ ] A signed APK is on GitHub Releases and installs on the phone.
- [ ] The release build signs in over HTTPS, syncs, and has the right icon.
- [ ] Publishing a test EAS Update reaches the app on the next launch, and an unsigned one is refused.
- [ ] An older version shows the calm "update available" card and isn't blocked.
- [ ] v4.3 in `docs/06-phases.md` is set to ✅.

---

## D. Web and security

### D1 — Laptop web push, tried for real (v4.5)

**Why:** the code, Settings toggle and tests exist, but no real notification has ever been received. `localhost` counts
as a secure context, so this can be tried now. The service worker is only in production builds, so use `vite build`
and `vite preview`, not the dev server.

**Files:** `apps/web/src/lib/push.ts`, `apps/web/src/sw.ts`, `apps/web/src/routes/settings/Notifications.tsx`,
`apps/api/src/lib/push.service.ts`, `apps/api/src/routes/push.ts`, `apps/api/src/cron/morning.ts`

**Subtasks**
- [ ] Generate keys with the already-installed package: `cd apps/api && node_modules/.bin/web-push generate-vapid-keys`.
- [ ] Add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` to the env file **outside the repo**.
- [ ] Build and preview the website. Add `PUBLIC_ORIGIN` for the preview port if needed, and proxy `/api` to `:8787`.
- [ ] Owner: Settings → Notifications → enable in Chrome, then press the test button.
- [ ] Disable it and confirm no more arrive.

**Acceptance criteria**
- [ ] A real notification appears on the laptop from the test button.
- [ ] Clicking it opens the app.
- [ ] Disabling removes the subscription.
- [ ] The 06:30 morning message counts toward the limit of 3 a day. Confirm that web and phone together don't exceed it, or report that they do.
- [ ] Copy has no guilt wording, and `tatakae-guardrails` passes.
- [ ] Note in `docs/06-phases.md` that a production check remains, once hosting exists.

### D2 — Security review of the deployed site (v4.9) — **Blocked by hosting**

Read-only testing against the owner's own deployed site. Use the `cso` skill. Report findings before fixing anything.

**Check on the live site**
- [ ] Headers on `/`, `/assets/*`, `/api/*`: HSTS, CSP, and `sandbox` CSP on uploaded files.
- [ ] Cookie is `__Host-tatakae_session`, Secure, Path=/, no Domain.
- [ ] Cross-site cookie write gets 403 `cross_origin`.
- [ ] Login throttling: 10 per 15 minutes per IP and 30 wrong passwords an hour overall.
- [ ] A spoofed `X-Forwarded-For` can't dodge the per-IP limit.
- [ ] Body caps return a calm 413.
- [ ] Export, adding a passkey and signing out devices need a recent re-auth.
- [ ] `DEV_BYPASS_AUTH` has no effect in production.
- [ ] `javascript:` links are refused.

**Acceptance criteria**
- [ ] Every check has a recorded result.
- [ ] Findings are reported to the owner with severity.
- [ ] Each fix is its own PR with a test.

---

## E. Usage gates (Owner)

These need days of real use and can't be done by an agent. Write the date when each is met.

- [ ] **v1:** 7 consecutive days, ritual on the laptop and daily actions on the phone. Met on: ____
- [ ] **v2:** a Sunday review completed in the app. Met on: ____ (planned for 15 Nov. It's a website feature, so it doesn't need the phone.)
- [ ] **v3:** one full week of notes kept in the app. Met on: ____
- [ ] **Fitness:** a cut started in the app shows targets, with a week of food and weight logged on the phone and reviewed on the laptop. Met on: ____

Phase 0's gate and the v4 gate depend on hosting and the restore drill, so they're out of scope here.

---

## Bug log

Add one row per bug found in section B or D.

| Date | Task | What happened | Cause | Fix commit |
|---|---|---|---|---|
| | | | | |
