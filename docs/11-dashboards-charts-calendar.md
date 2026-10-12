# 11 · Dashboards, charts, calendar, scoreboard, icons

Everything visual that shows **your own data**, in the "Soft Bento" style of `10-design-system.md` (refs in `design/references/`). Each item lists what it shows, where its data comes from, and the phase it ships in.

Rules that still apply: misses are grey, no streaks, no red, every chart has a one-line text summary under it, every status uses icon + label + colour, numbers are tabular.

---

## 1. Dashboards (where things live)

| Dashboard | Client | Layout | Contents | Phase |
|---|---|---|---|---|
| **Today** | phone | Stack of cards + floating pill nav (ref 02/03) | Week strip · count chips · P1 hero · P2…P9 cards · habits pills · mini scoreboard row (2 boxes) | v1 |
| **Calendar** | phone tab | Month grid + scoreboard (ref 01/03) | Month `DayCircle` grid · legend · 4 scoreboard boxes · tap a day → Day sheet | v1 |
| **Week** | phone (Calendar → Week pill) | Segmented Day/Week/Month (ref 03) | `HatchedStackBar` 7 days · focus minutes by area · habits % | v2 |
| **Dashboard (Today)** | web | Bento grid (ref 05) | P1 hero · today score · screen-minutes stripe · inbox box · habits box · cycle gauge · goal rings | v1 (first 4), v2 (rest) |
| **Calendar** | web | Month view ↔ week planner with time rail (ref 06/07) | Month `DayCircle` grid with mini bars · week columns with area blocks, anchors, focus sessions, current-time line | v1 month, v2 week planner |
| **Weekly Control Room** | web | Cream canvas, left week columns + right panel (ref 06) | Scoreboard row · hatched week bars · stripe screen trend · stuck breakdown · Muri/Mura/Muda cards · experiment card | v2 |
| **Monthly review** | web | Bento | Month calendar heat · mark distribution blocks · area time blocks · 30-day sparkline · alignment | v2 |
| **Cycle** | web + phone (read-only) | Big gauge + rings (ref 04) | 12-segment gauge · goal rings · experiment log · week list | v2 |

---

## 2. Scoreboard boxes (`MetricCard`)
Big number, small delta pill (lime ↗ for better, grey ↘ for worse — never red), one context line, thin progress bar to a target with %.

| Box | Number | Context line | Bar | Phase |
|---|---|---|---|---|
| **Today's score** | final 0–100 (shown after Shutdown; before that "—") | Mark (Strong / Solid / Light) | final / 100 | v1 |
| **Days shown up** | count this cycle (never resets) | "of 84 days in Cycle 1" | count / days elapsed | v1 |
| **7-day average** | avg final (excl. rest/write-off) | Δ vs previous 7 days | avg / 80 (Strong) | v1 |
| **P1 hit rate** | % of days P1 done or minimum (30 d) | "Minimum counted on 6 days" | % / 100 | v1 |
| **Focus minutes (week)** | sum of focus sessions | Δ vs last week | minutes / weekly target (setting) | v1 |
| **Screen minutes (avg)** | 7-day average recreational minutes | "Free under 120" | 120 / avg capped at 100 % | v1 |
| **Habits this week** | % of habit checks done | best habit name | % | v2 |
| **Comebacks** | days restarted after a miss this cycle | "Each one counts" | — (no bar) | v2 |
| **Inbox** | unprocessed items | oldest item age | — | v1 (web) |

Phone shows 2 boxes on Today (Today's score, Days shown up) and 4 on Calendar. Web Dashboard shows a row of 4.

---

## 3. Charts

| # | Chart | Component | Shows | Data | Phase |
|---|---|---|---|---|---|
| C1 | **Hatched stacked bars** (ref 03) | `HatchedStackBar` | Per day: done points (lime), minimum (lavender hatched), missed (grey hatched); day letter + date circle under; today's date circle charcoal | `GET /stats/week/:isoWeek` → `days[].{done,minimum,missed,final}` | v1 (phone Week, simple) → v2 |
| C2 | **Stripe trend** (ref 01) | `StripeTrend` | Screen minutes per day for 14 days as dense vertical lines; dashed line at 120; bands: ≤120 lime-deep, 120–180 butter, >180 grey | `GET /stats/series?metric=screen_min&days=14` | v1 |
| C3 | **Sparkline + 7-day average** | `Sparkline` | Final score last 30 days, thin ink line, lime area under 7-day avg | `GET /stats/series?metric=final&days=30` | v2 |
| C4 | **12-segment cycle gauge** (ref 04) | `SegmentGauge` | One segment per week of the cycle, coloured by that week's average mark; future weeks hollow; centre big % (days shown up / days elapsed) + one word | `GET /stats/cycle` | v2 |
| C5 | **Goal rings** (ref 04) | `RingProgress` | Per cycle goal: progress % in centre, ring in the goal's area colour (deep edge) | `GET /stats/cycle` → `goals[]` | v2 |
| C6 | **Block bar chart** (ref 05) | `BlockBarChart` | Stacked rounded blocks per week/month: focus minutes by area (sage/rose/butter/sky), or this month vs last | `GET /stats/month/:yyyymm` → `areas[]` | v2 |
| C7 | **Habit heat grid** | `HabitHeatGrid` | Rows = habits, columns = days (12 weeks); lime done, surface-2 not done, hollow rest | `GET /stats/habits?days=84` | v2 |
| C8 | **Stuck breakdown pill bar** | `PillBar` | One long pill split into Uncertainty / Fear / Inertia counts this week, with labels | `GET /stats/week/:isoWeek` → `stuck` | v2 |
| C9 | **Mark distribution** | `BlockBarChart` (single row) | Count of Strong / Solid / Light / Missed / Rest days in the month | `GET /stats/month/:yyyymm` → `marks` | v2 |
| C10 | **Capacity bar** | `CapacityBar` | Planned minutes vs free minutes, tick at 80 %, lime fill, turns butter above 80 % (warn, never block) | computed client-side in the ritual from anchors + est_min | v1 |
| C11 | **Focus ring timer** | `FocusRing` | Countdown ring on Focus screen | local timer | v1 |
| C12 | **Time-of-day heat** (optional) | `HourHeat` | When focus sessions start (hour × weekday) | `GET /stats/focus-hours` | v3 |

Every chart: one-line summary text below ("4 of 7 days Strong or Solid; Wed was the dip"), accessible label, tooltips on web hover / long-press on phone.

---

## 4. Calendar

### Day circle states (`DayCircle`, ref 01/03)
| State | Look |
|---|---|
| Strong (≥ 80) | lime fill, ink number |
| Solid (50–79) | lavender fill, ink number |
| Light (< 50, not missed) | lime-soft fill + lime-deep ring |
| Missed day | surface-2 fill + grey dash under number |
| Rest / write-off | hollow ring |
| Today | charcoal fill, white number |
| Future | plain number |
| Has reflection / small win | tiny dot under the circle |

### Phone
- **Week strip** on Today header (ref 02): 7 circles, today charcoal, tap to view a past day (read-only) or tomorrow (if planned).
- **Calendar tab** (ref 01/03): month header with ‹ › and a "This month" pill; Day / Week / Month segmented pills; month grid of `DayCircle`s; legend row; scoreboard boxes below.
- **Day sheet** (`app/day/[date].tsx`): score box, missions with statuses, habits, screen minutes, small win and 3 answers, focus sessions list.

### Web
- **Month view**: larger day cells, each with the circle + a mini 3-segment bar (done/min/missed) + screen-minutes number.
- **Week planner** (ref 06/07): columns Mon–Sun, time rail 06:00–24:00, **anchors** as grey blocks, **focus sessions** (actual) as area-coloured blocks, **missions with a planned start** as outlined area blocks, current-time charcoal line with dot, Day / Week / Month pills. Drag a backlog item onto the week to plan it (v2).
- **Cycle calendar**: 12 rows (weeks) × 7 circles on the Cycle page.

---

## 5. Data needed (additions)
| Addition | Where | Phase |
|---|---|---|
| `focus_sessions` table: id, mission_id, started_at, ended_at, planned_min, completed (bool), area_id | `db/schema.ts` | v1 |
| `missions.planned_start` (HH:MM, optional) for the week planner | `db/schema.ts` | v2 |
| `areas.color` (sage / rose / butter / sky / lime-soft / lavender-soft) and `areas.icon` (lucide name) | `db/schema.ts` | v2 |
| `goals.target_points` for ring progress | `db/schema.ts` | v2 |
| Stats functions (pure) | `packages/core/src/stats.ts` | v1–v2 |
| Stats endpoints | `apps/api/src/routes/stats.ts` | v1–v2 |

### Stats API
| Method | Path | Returns | Phase |
|---|---|---|---|
| GET | `/stats/scoreboard?date=` | the scoreboard boxes (value, delta, target, context) | v1 |
| GET | `/stats/calendar/:yyyymm` | `[{date, mark, final, done, minimum, missed, screenMin, kind, hasNote}]` | v1 |
| GET | `/stats/series?metric=final|screen_min|focus_min&days=` | `[{date, value}]` + 7-day avg | v1 |
| GET | `/stats/week/:isoWeek` | days with point breakdown, stuck counts, area minutes, habits % | v1 (points) → v2 |
| GET | `/stats/month/:yyyymm` | marks distribution, area minutes, averages | v2 |
| GET | `/stats/cycle` | 12 week marks, days shown up, goals with progress | v2 |
| GET | `/stats/habits?days=` | habit × day grid | v2 |

The phone computes v1 stats **locally** from its SQLite copy with the same `packages/core` functions, so the Calendar and scoreboard work offline.

---

## 6. Icons
Line icons, 1.75 px stroke, 22 px in 48 circles, from **Lucide** (`lucide-react` on web, `lucide-react-native` on phone). One map in `packages/core/src/icons.ts` so both clients use the same names.

| Meaning | Lucide icon |
|---|---|
| Today | `Sun` |
| Calendar | `CalendarDays` |
| Focus | `Timer` |
| Capture | `Plus` |
| Settings | `Settings2` |
| Night ritual | `Moon` |
| Inbox | `Inbox` |
| Review | `ChartColumn` |
| Cycle | `Target` |
| Notes | `NotebookPen` |
| Open / details | `ArrowUpRight` |
| Reminders | `Bell` |
| Search | `Search` |
| Done | `Check` |
| Minimum | `Contrast` (half circle) |
| Missed | `Minus` |
| Reschedule | `CornerUpRight` |
| Stuck | `LifeBuoy` |
| Recharge | `BatteryCharging` |
| Habit | `Repeat` |
| Screen time | `Smartphone` |
| Locked plan | `Lock` |
| Rest day | `Coffee` |
| Write-off | `Feather` |
| Story line | `Sparkles` |
| Area: Career/DevOps | `Server` |
| Area: Health/Gym | `Dumbbell` |
| Area: Japanese | `Languages` |
| Area: Freelance | `Briefcase` |

### App icon
Original mark, not copied from the references: a rounded-square **charcoal** tile with **three rising rounded steps** (grey → lavender → lime, left to right) — P3, P2, P1 climbing. Adaptive icon foreground on charcoal background; monochrome variant for Android 13 themed icons. Export 1024 px into `apps/mobile/assets/` and `apps/web/public/`.
