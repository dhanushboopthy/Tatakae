# TATAKAE — features

A personal execution system for one person. Rather than just storing tasks, it enforces a method: plan the night before, start strict in the morning, get through the day without guilt, and review weekly, monthly and per 12-week cycle.

| Surface | Where | Job |
|---|---|---|
| **Website** (`apps/web`) | Laptop browser, installable PWA | Plan and reflect |
| **Phone app** (`apps/mobile`, Expo) | Android | Do and capture |
| **API** (`apps/api`, Hono + SQLite) | One Oracle Cloud VM | Source of truth, sync, scoring, backups |
| **Core** (`packages/core`) | Shared, pure TS | Scoring, time, stats, sync merge, story picking |

**Status legend:** ✅ built · 🟡 partly built / written but not yet verified · ⬜ planned · 🚧 uncommitted work in progress

---

## 1. The daily loop

### Night ritual (laptop, about 5 minutes) — ✅ web
An 8-step wizard at `/ritual`:
1. **Close today**: mark each mission Done / Minimum / Missed / Rescheduled and enter recreational screen minutes.
2. **Small win**: one line, which you can skip.
3. **Three questions**: Did I do P1? What made me drift? What did I practise?
4. **Close loops**: a resume note for every unfinished mission.
5. **Capacity**: tomorrow's anchors and free minutes, with a **CapacityBar** that warns (but doesn't block) above 80% (Hara Hachi Bu).
6. **Pick ranked missions**: 5 rows by default (P1–P5) and **Add** for up to P9. P1 needs a **Minimum** version and an **if-then** plan. Points default to 1.
7. **Side quest**: optional, one, unscored.
8. **Shutdown complete**: locks tomorrow's plan (`forged_at`).

🚧 **Restart ritual**: unlocks a plan that is already locked, so the ritual can be redone. It is deliberately hard to do: a written reason of at least 20 characters, typing the word "restart", a wait and a hold-to-confirm, once per date and at most twice in 7 days. Each restart is logged as a *mura* event for Sunday's review.

### Morning (one screen) — ✅ web · ✅ phone
"What would make today a win?" → P1 card (title, Minimum, if-then) → **Start**. Nothing else is shown until P1 is started or deferred.

### During the day
| Feature | Web | Phone |
|---|---|---|
| **Dashboard / Today**: bento grid with the P1 hero, today's score (shown only after shutdown), days shown up, P2–P9 and side quest, habits, inbox, screen-minutes stripe, 7-day average, focus this week, week bars, cycle gauge, goal rings | ✅ | ✅ (week strip, chips, P1 hero, scoreboard) |
| **Status chips** on every mission | ✅ | ✅ |
| **Soft plan lock**: editing a locked plan needs a typed reason (stored as a *mura* event); the server answers 423 without one | ✅ | ✅ |
| **Focus timer**: length comes from the mission's plan or any custom length; it sits in the nav rail with a badge while a session runs; logs `focus_sessions` | ✅ | ✅ (FocusRing, timer from start time) |
| **Stuck button**: Uncertainty → next physical action · Fear → 10/10/10 · Inertia → 5-minute timer | — | 🟡 component built, screen is a stub |
| **Recharge menu** after a focus block (walk, music, call, stretch, sketch) | ✅ settings | 🟡 stub |
| **Quick capture** to the inbox | ✅ (`/capture`, PWA share target) | 🟡 stub |
| **Quick close** (≤ 45 s close when the laptop ritual is missed) | — | 🟡 stub |
| **Command palette** (Cmd+K) | ✅ | — |

### Lapse protocol — ✅ web · 🟡 phone
- Misses are **grey, never red**. Nothing resets.
- **Days shown up**: a cumulative count that never resets (no streaks).
- **Welcome back** screen after one or more missed days; **Restart** plans only P1.
- **Comeback bonus**: +10 when yesterday was a missed day and P1 is Done or Minimum.
- **Write-off day**: up to 2 per month, one tap plus a reason.
- **Rest day**: Sunday after the review by default.
- **Thirukkural 619** ("persistent effort") on login, shutdown and welcome back.

---

## 2. Scoring — ✅ core + API
Exact and deterministic, in `packages/core/src/scoring.ts` (table-driven tests):
- `planned` = sum of points (rescheduled, backlog and side quests are excluded) · `earned` = Done → full, Minimum → half.
- `exec = 100 × earned / planned`, minus a **screen-time penalty** (−5 for every 30 min over 120, capped at −20), plus the comeback bonus, clamped to 0–100.
- **Marks**: Strong (≥ 80), Solid (≥ 50), Light, Unplanned.
- Rest and write-off days are left out of averages.
- Scoring constants can be edited **only on even-ISO-week Sundays**, so they can't be tinkered with mid-week.
- Habits are **tracked, not scored**.

---

## 3. Calendar and planning — ✅ web · 🟡 phone
- **Month view** with DayCircles coloured by mark, and a day sheet.
- **Week planner**: time rail, area-coloured blocks, a backlog to drag from, **drag to create, resize**, and a **day view**.
- **Anchors**: fixed commitments that reduce free capacity.
- Phone Calendar tab and Day sheet: ⬜ stubs.

---

## 4. Reviews — ✅ web
- **Weekly Control Room** (Sunday, 15–20 min): stats → **Muri** (overload: planned vs capacity) → **Mura** (unevenness: lock-edit reasons, stuck events, ritual restarts) → **Muda** (waste: screen minutes, missions rescheduled twice) → pick **one experiment** for 2 weeks → plan the week → unlock a reward episode. Charts: HatchedStackBar, Sparkline, StripeTrend, PillBar.
- **Monthly review**: averages, BlockBarChart of marks and area minutes, HabitHeatGrid, wins / failures / why, next month's theme.
- **12-week Cycle page**: at most 4 goals, each passing a "hell-yeah" gate, with SegmentGauge and RingProgress, and areas with a colour and icon.
- One review per period, enforced by the API.
- Phone Week view and read-only Cycle: ⬜.

---

## 5. Story layer — ✅ web · 🟡 phone
- Your watch history becomes **paraphrased lessons (≤ 160 chars)** tied to moments: P1 done, Minimum done, comeback, stuck-fear, stuck-inertia, weekly review, cycle start, rest day.
- Shown on about 1 in 3 completions, never the same one twice in 14 days, **never on the morning screen**, with a global mute.
- Monthly themes follow learning goals.
- **Watch queue / reward**: completing a weekly review unlocks one episode.
- Story packs are imported in Settings from local `references/*.local.json` files (git-ignored). No art, no logos, no verbatim quotes.
- Phone StoryToast: component built, not wired in yet.

---

## 6. Notes and second brain — ✅ API · 🟡 web · ⬜ phone
- **Notes**: list, **BlockNote editor** with autosave, tags, goal and area links, the flags *can-explain / can-implement / misunderstood*, and **full-text search** (SQLite FTS5).
- **File attachments**: multipart upload to disk, with an optional Object Storage copy.
- **Applications** tracker, **Stories** (STAR format) and **Japanese study log**, under the Notes rail item.
- Phone capture-to-note and read-only search: ⬜.

---

## 7. Settings — ✅ web · ⬜ phone
Sections: General · Anchors · Habits · Areas · Recharge · Scoring (even-Sunday guard) · Story · Notifications · Devices (list / revoke sessions) · Data (export, backup job log).

---

## 8. Sync and offline — ✅ core + web · 🟡 phone
- **Offline first**: every write lands in a local **outbox** first (IndexedDB on web, SQLite on phone) and syncs later, so the UI updates straight away.
- `POST /sync` with a change log; **last-write-wins** merge from core; the **server decides plan lock**.
- An "**edited elsewhere**" note appears when a sync conflict is resolved.
- ULID ids, debounced flush, and a status indicator.

---

## 9. Notifications — 🟡
- At most 3 a day, predictable, never guilt-based: morning, an optional afternoon one, and ritual time.
- Laptop **web push** (opt-in and a test button, 06:30 morning message): ✅ code.
- Phone local notifications: ⬜.

---

## 10. Auth and security — ✅ (passkeys blocked)
- Password login with **hashed session tokens** and sliding expiry: a signed cookie on web, a bearer token in SecureStore on the phone, plus an `API_TOKEN`.
- Login rate limit, device list and revoke, 401 handling.
- ⬜ **Passkeys (WebAuthn)**: blocked because the dependency could not be installed.

---

## 11. Data, backups and operations
| Feature | Status |
|---|---|
| `GET /api/export`: full JSON export | ✅ |
| Nightly JSON backup (newest 7 kept locally, newest 30 in Object Storage), logged to `job_runs` and shown in Settings → Data | ✅ |
| **Litestream** continuous SQLite replication to Object Storage | 🟡 configured |
| **Terraform (OCI)**: VCN, A1 arm64 VM, reserved IP, data volume, versioned backup bucket, optional ₹1 budget alert | 🟡 written |
| **cloud-init bootstrap**: Docker, firewall, Tailscale-only SSH, fail2ban, unattended upgrades | 🟡 written |
| **Caddy**: HTTPS, CSP, immutable asset caching | 🟡 written |
| **CI deploy**: arm64 images → GHCR → Tailscale → `deploy.sh` (snapshot, health check, rollback) | 🟡 written |
| `restore.sh` + **restore drill** | 🟡 script written, drill ⬜ |
| Local Docker run (`scripts/local-up.sh`, first free port from 8080) | ✅ |
| Signed release APK on `mobile-v*` tags, `/api/app/version` | 🟡 workflow + endpoint ✅, in-app "update available" ⬜ |

---

## 12. Design system — "Soft Bento"
- Light by day, **dark from ritual time**. Ink text on every coloured fill.
- WCAG 2.2 AA, **44 px/dp touch targets**, full keyboard support on the laptop.
- Shared chart and component set: RingProgress, SegmentGauge, StripeTrend, HatchedStackBar, Sparkline, BlockBarChart, HabitHeatGrid, PillBar, DayCircle, CapacityBar, FocusRing, MetricCard and more.
- Plus Jakarta Sans and Lucide icons.

---

## 13. Fitness — 🟡 core, sync and the Day tab (F1–F3 of F1–F6, `docs/plans/fitness.md`)
- ✅ **Core maths** (`packages/core/src/fitness.ts`, pure TS, table-driven tests): trend weight as an EMA (α 0.1); weekly rate %; maintenance entered by hand per ISO week, carried forward, default 2800; daily targets per phase (Cut −1 %/wk, Bulk +0.25 %/wk, Recomp at maintenance; protein 2.2 g/kg and fat 0.8 g/kg of trend weight, carbs fill the rest); cut limit of 1000 kcal deficit and a 1500 kcal floor with a `capped` flag and the expected rate; day, week and month summaries; a one-sentence weekly check-in; e1RM, weekly sets per muscle, best lift per exercise; 13 micronutrients with units defined once.
- ✅ **Schemas and settings**: Zod row schemas for body logs, foods, food logs, phases, workouts, sets and maintenance weeks; settings `fitness.maintenanceKcal` (2800), `fitness.stepsTarget` (8000), `fitness.waterTargetMl` (3000), `fitness.sleepTargetMin` (450), `fitness.fibreTargetG` (30).
- ✅ **Tables and sync**: seven synced tables (migration `0005_fitness.sql`) that go through the outbox on both clients and work offline. A day's body log merges by date and a week's maintenance by ISO week, so two devices never create duplicates.
- ✅ **Web Day tab + food library** (`/fitness`): calories ring (grey/butter when over, never red), protein, weight and trend, macros, more nutrients, steps / water / sleep, meals by slot with copy yesterday, saved foods (search, recents, favourites, edit, delete), manual new food, body log. Works offline; past days can be edited.
- ⬜ Week / Month / Phase + Weekly Review check-in (F4), Training (F5), phone quick-log and Today card (F6).

---

## Still to come (from `docs/06-phases.md`)
- **Phone**: Capture, Quick close, Stuck, Recharge, Welcome back, Calendar tab, Day sheet, Settings, local notifications.
- **Phone native extras**: share intent → inbox, launcher quick actions, Android widget (P1 + Start/Done), a usage-stats module to prefill screen minutes, an ongoing focus notification.
- Passkeys, the in-app update prompt, an EAS Update channel, the restore drill, area alignment scores, an offline and accessibility audit, and installing Playwright for the smoke test.
- **Later**: iOS, a Wear OS tile, read-only calendar import, open-sourcing with an empty reference pack.

## Deliberately not built
XP, levels, coins, streaks, leaderboards, social features, AI auto-scheduling, multiple users, red "you failed" states, franchise artwork or quotes, Notion import.
