# Fitness module — plan

Status: **planned, not started.** To be built in a later phase. When it is picked up, add a
**Fitness (F1–F6)** block to `docs/06-phases.md` (see §5).

## Context
A Fitness page to run fat-loss / bulk / recomp phases with real numbers: daily → weekly → monthly
calories against a **maintenance set by hand for each week** (e.g. 2800 kcal), daily weight, a manual
food log with macros + micros, protein target **2.2 g × trend bodyweight**, and a cut that aims for
**−1 % bodyweight / week**. Also: trend weight + weekly check-in, a training log, and steps / water /
sleep / fibre. Nothing fitness-related exists in the repo yet (only the "Health / Gym" rose area colour
and the `Dumbbell` icon).

Decisions taken:
- Food data: **manual entry only** — saved foods/recipes reused from search/recents. No external API.
  (If wanted later: IFCT 2017 — Indian Food Composition Tables, NIN Hyderabad — is open data on npm,
  ~530 Indian foods with micros, and could be bundled offline.)
- Maintenance: **entered manually for each week** (ISO week, Mon–Sun). A week with no value carries
  forward the last one set (first ever value 2800). No automatic estimation.
- Surfaces: **web page** (review/plan) + **phone quick-log** (weight, daily stats, meals, sets).
- Phases: Cut −1 %/wk, Bulk +0.25 %/wk, Recomp at maintenance; protein 2.2 g/kg in all phases; fat
  floor 0.8 g/kg; carbs = remainder. All numbers editable per phase.
- Cut safety: deficit ≤ 1000 kcal/day, target ≥ 1500 kcal; when capped, a calm grey note shows the
  expected rate.

Data must be **synced tables** (outbox, works offline and on the phone) — not REST-only like
`japanese_log`.

## 1. Core maths — `packages/core/src/fitness.ts` (+ `fitness.test.ts`)
Pure TS, table-driven Vitest like `time.test.ts`. Reuse `addDays`, `daysBetween`, `isoWeekRange`,
`monthRange`, `todayIST` from `time.ts`; `rollingAverage` from `stats.ts` where it fits.
- `KCAL_PER_KG = 7700`.
- `trendWeight(logs)` — EMA (α = 0.1) over daily weigh-ins, gaps carried forward; returns per-date trend.
- `weeklyRatePct(trend, date)` — trend change over 7 days ÷ trend, as %/week.
- `maintenanceFor(weeks, date)` — the value set for the date's ISO week, else the latest earlier week's
  value, else the `fitness.maintenanceKcal` default (2800). Returns `{ kcal, setForThisWeek: boolean }`.
- `dailyTargets({ phase, maintenance, trendKg })` → `{ kcal, proteinG, fatG, carbsG, fibreG, capped,
  expectedRatePct }`. Cut: deficit = rate × trendKg × 7700 ÷ 7, capped at 1000 and floor 1500. Bulk:
  surplus, same formula. Recomp: maintenance. Protein = g/kg × trendKg; fat = 0.8 g/kg;
  carbs = remaining kcal ÷ 4.
- `dayTotals(foodLogs)`, `weekSummary(...)`, `monthSummary(...)` — avg kcal, avg protein, total
  deficit/surplus vs maintenance, logged-day count, weight change, rate vs goal.
- `weeklyCheckIn(...)` — one plain sentence on the week (e.g. "Avg 1910 kcal vs 2800 maintenance,
  −6230 kcal for the week. Lost 0.6 %, goal 1 %."). Informational only; it never changes maintenance.
- Training: `e1rm(kg, reps)` (Epley), `weeklySetsByMuscle(sets)`, `bestByExercise(sets)`.
- `MICRO_KEYS` constant: fibre, sugar, satFat, sodium, potassium, calcium, iron, magnesium, zinc,
  vitA, vitB12, vitC, vitD (units defined once).

## 2. Schemas, tables, sync
**Zod** in `packages/core/src/schemas.ts` (+ types in `types.ts`, `rowSchemas`, `SyncRowMap`):

| Table | Key fields |
|---|---|
| `body_logs` | id, date (unique), weightKg?, steps?, waterMl?, sleepMin?, note? |
| `foods` | id, name, servingLabel, servingG?, kcal, proteinG, carbsG, fatG, fibreG?, micros (JSON map of `MICRO_KEYS`), favourite |
| `food_logs` | id, date, meal (`breakfast│lunch│dinner│snack`), foodId?, name, servings, **nutrient snapshot** (kcal, P/C/F, fibre, micros) so editing a food never rewrites history |
| `fitness_phases` | id, kind (`cut│bulk│recomp`), startDate, endDate?, ratePctPerWeek, proteinGPerKg, fatGPerKg, startWeightKg, note? |
| `workouts` | id, date, name, durationMin?, note? |
| `workout_sets` | id, workoutId, exercise, muscle, order, reps, kg, rpe? |
| `maintenance_weeks` | id, isoWeek (unique, e.g. `2026-W42`), kcal, note? |

Settings keys (`settingValueSchemas` + `DEFAULT_SETTINGS`): `fitness.maintenanceKcal` (2800, used only
before any week has been set), `fitness.stepsTarget` (8000), `fitness.waterTargetMl` (3000),
`fitness.sleepTargetMin` (450), `fitness.fibreTargetG` (30).

**Sync wiring** (pattern for every new synced table): `packages/core/src/sync.ts` `SYNC_TABLES` +
`SYNC_TABLE_PK`; `db/schema.ts` drizzle tables with `...meta` and date indexes; `pnpm db:generate` →
`db/migrations/000N_fitness.sql`; API `rows.service` registration; mobile expo-sqlite store schema.
Sync covers writes; clients compute summaries from local rows via core, so no extra API route is
planned.

## 3. Web — `/fitness` page
Route in `apps/web/src/router.tsx`, nav entry in `Shell.tsx` `NAV` (`wrap(Dumbbell)` in `icons.tsx`),
`CommandPalette.tsx` `SCREENS`. Reads via the `lib/hooks` IndexedDB pattern (`localKey([...])`, like
`Cycle.tsx`); writes via new helpers in `lib/actions.ts` (`logFood`, `saveFood`, `logBody`,
`setMaintenance`, `startPhase`, `saveWorkout`, `logSet`) → outbox `write()`.

`SegmentedPills` tabs: **Day · Week · Month · Training · Phase**
- **Day** — kcal `RingProgress` (eaten / target), protein bar vs target, `PillBar` for P/C/F, fibre
  line; meals grouped by slot; "Add food": search saved foods + recents + "copy yesterday's meal";
  "New food" manual form (macros required, micros under "More nutrients"); weight / steps / water /
  sleep chips.
- **Week** — header shows this week's maintenance with an inline edit field (number + Save; prefilled
  with the carried-forward value, quiet grey "carried from W41" hint when not set this week).
  `StripeTrend` with `free = maintenance` for daily kcal (over target = butter/grey, never red);
  stats: avg kcal, avg protein, weekly deficit, trend change, rate vs 1 % goal, days logged.
- **Month** — new `WeightTrendChart` (kg-scaled SVG: dots for weigh-ins, line for trend; `Sparkline`
  is fixed at 0–100), monthly averages, per-week rows.
- **Training** — log a session (exercise, muscle, sets × reps × kg; exercise names autocomplete from
  history), recent sessions, best e1RM per lift, weekly sets per muscle (`BlockBarChart`).
- **Phase** — current phase card (kind, week N, start → now weight, rate, targets, capped note),
  maintenance history per week, start/end phase, phase history.

**Weekly Review**: add a Fitness check-in block to `apps/web/src/routes/WeeklyReview.tsx` using
`weeklyCheckIn()`, with a "Maintenance for next week" field (prefilled with this week's value) — the
natural place to set it each week.

## 4. Phone quick-log (`apps/mobile`)
New modals registered in `app/_layout.tsx` (pattern of the planned `capture` modal), writes through
`src/sync/engine.ts` `write()`:
- **Body** — weight (numeric pad, prefilled with last value), steps, water +250 ml taps, sleep. ≤ 10 s.
- **Food** — meal slot preselected by time of day; recents / favourites one tap; search; "copy
  yesterday"; manual new food. ≤ 60 s.
- **Set** — during a workout: exercise (last used), reps, kg, "same again".
- A compact Fitness card on the phone Today tab: kcal left, protein left, "weigh in" chip if not
  logged. No new notifications (keeps the ≤ 3/day budget).

## 5. Delivery — one task per PR
When picked up, add a **Fitness (F)** block to `docs/06-phases.md`:
- F1 core maths + schemas + tests
- F2 tables, migration, sync wiring (core / API / web / mobile stores)
- F3 web Fitness page: Day tab + food library
- F4 web Week / Month / Phase tabs + weekly maintenance entry + Weekly Review check-in
- F5 web Training tab
- F6 phone quick-log modals + Today card

Each PR: tick the task, `docs/CHANGELOG.md` line, `docs/FEATURES.md` entry, Conventional Commit,
no new dependencies (all charts hand-rolled SVG).

## Guardrails
Grey not red (over target / weight up = butter or grey text, never red); no streaks or XP; ink text on
coloured fills; 44 px targets; Soft Bento light/dark; Thirukkural only (`Kural` on the page, no other
imagery); run the `tatakae-guardrails` skill before finishing F3–F6. Don't rebuild/restart Docker.

## Verification
- `pnpm test` — `fitness.test.ts` covers EMA trend, `maintenanceFor` (set this week / carried forward /
  default 2800), targets for each phase incl. cap and 1500 floor (e.g. 95 kg cut → 1045 deficit →
  capped at 1000, note shows ~0.96 %/wk), weekly/monthly summaries, e1RM.
- API sync tests: new tables round-trip through `/api/sync` (pattern in `apps/api/src/routes/*.test.ts`).
- `pnpm typecheck` across workspaces.
- `pnpm dev` → web `/fitness`: seed 3 weeks of weights + food logs, check week/month numbers by hand,
  start a cut and confirm targets; offline write → reconnect → synced. `webapp-testing` for screenshots
  in light and dark.
- Mobile: typecheck + Expo dev client if available; otherwise report as unverified on device.
