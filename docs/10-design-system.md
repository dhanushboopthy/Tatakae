# 10 · Design system — "Soft Bento"

Chosen direction (11 Oct 2026), based on the user's references in `docs/design/references/`. **Light, calm, card-based ("bento"), big numbers, pill shapes, lime + lavender accents on soft grey, a charcoal floating nav.** A dark variant exists for night use.

Mockups of the direction (sample data): `docs/design/mockups/` and the live canvas https://claude.ai/artifact/6adCof169njJ7zxUvMSjRB.

This file overrides the older "dark by default" palette in earlier docs. Constraints from 01/02/05 still apply: grey not red, no streaks/XP, ≤ 60 s logging, one-screen morning, 44 px/dp targets, WCAG 2.2 AA.

## 1. What we take from each reference
| Ref | Take | Leave |
|---|---|---|
| 01 phone calendar + metric cards | Large page title with circle icon buttons (search, +); month grid of **circle day cells** with a dot under days that have data; "Today · 3 missions" list rows with a dark time pill on the right; striped vertical-line trend chart; metric cards with a **huge number**, small delta pill and a thin progress bar with % | Brand logos, avatars on days, red negative deltas |
| 02 phone task schedule | **Charcoal pill hero card with a lime circular arrow button** ("Next meeting" → our **P1 card**); status pill chips with a count bubble; day-strip of circles with the selected day in lime; timeline with pill-shaped blocks | Team avatars, tilted app-icon mockups |
| 03 phone cards + calendar + bars | Big rounded mission cards in charcoal / lime / lavender with a ↗ circle button and a "High priority"-style outline pill; **floating dark pill bottom nav** with the active tab as a white circle; calendar of filled circles; **stacked bars with diagonal hatching**; Day / Week / Month segmented pills | "In team" progress with faces |
| 04 segmented gauge + rings | **Segmented arc gauge with a big % and a one-word label** ("Near complete"); **ring progress per item** with a number in the middle; pastel category cards with a tag pill and a time range | Members row |
| 05 web bento dashboard | Icon rail on the left, pill top tabs, "Welcome back, <name>" in a large light weight, date-range pill, bento grid of white cards with ↗ circle buttons; mixed lime/lavender block chart | Leads/sales content, team avatars |
| 06 web week planner | Cream canvas, black icon rail, **week columns with pastel blocks per category** (sage / rose / butter / sky) and a tag pill; right panel with gauge + rings | Avatars, emoji in the greeting (optional) |
| 07 web time tracker | Week grid with a **current-time line**; Day / Week / Month segmented control | Kanban columns, gradients, team cards (too busy for this app) |

## 2. Tokens

### Light (default by day)
| Token | Hex | Use |
|---|---|---|
| `canvas` | `#F1F1EF` | App background behind cards (web outer, phone behind sheets) |
| `canvas-cream` | `#FAF4E8` | Optional warm canvas for web review pages (ref 06) |
| `surface` | `#FFFFFF` | Cards, phone screen background |
| `surface-2` | `#F4F4F2` | Nested cards, chips, inactive pills, circle icon buttons |
| `line` | `#E6E6E3` | Hairlines, empty bar tracks |
| `ink` | `#1C1C1E` | Primary text, big numbers |
| `ink-2` | `#66666B` | Secondary text (5.7:1 on white) |
| `charcoal` | `#262626` | Hero P1 card, bottom nav, dark time pills, primary "+" button |
| `lime` | `#CDE37A` | **Primary accent**: done, selected day, P1 arrow button, positive deltas |
| `lime-soft` | `#EEF5D3` | Lime-tinted chips/backgrounds |
| `lime-deep` | `#7E9A1E` | Lime meaning in charts/borders on white (3.2:1) |
| `lavender` | `#A9A3DB` | **Secondary accent**: minimum, P2 card (P3 lime-soft, P4–P9 plain surface with an ink rank pill), notifications button |
| `lavender-soft` | `#E9E7F8` | Bell/settings circle, soft chips |
| `lavender-deep` | `#6E66B8` | Lavender meaning in charts/borders (4.9:1) |
| `missed` | `#8A8A90` | Missed icon/border (3.4:1) — fill stays `surface-2` |

**Area pastels** (category blocks, ref 04/06). Text on them is always `ink`:
| Area (default) | Token | Hex | ink contrast |
|---|---|---|---|
| Career / DevOps | `sage` | `#A3B56B` | 7.6 |
| Health / Gym | `rose` | `#F7A8D3` | 9.3 |
| Japanese / Learning | `butter` | `#F4D978` | 12.2 |
| Freelance / Money | `sky` | `#B9CBF0` | 10.4 |
Areas are user-editable; extra areas reuse `lime-soft`, `lavender-soft`.

### Dark (auto from ritual time to wake time; manual toggle)
| Token | Hex |
|---|---|
| `canvas` | `#0E0E10` |
| `surface` | `#1B1B1F` |
| `surface-2` | `#25252A` |
| `line` | `#2F2F35` |
| `ink` | `#ECECF1` |
| `ink-2` | `#A1A1AA` (6.7:1) |
| `charcoal` → becomes `#ECECF1` cards with `#121214` text (inverted hero) |
| `lime`, `lavender` | same hex (12.2 and 7.3:1 on surface) |
| `missed` | `#74747C` (3.7:1) |
The night ritual always uses the dark variant.

### Accessibility fixes vs the references
- References use **white text on lime/lavender** (1.4:1 and 2.35:1 — unreadable). We use **`ink` on all pastel/lime/lavender fills** (12.0 and 7.3:1).
- Lime fill on white is 1.4:1, so lime cards always carry ink text/icons, and **chart marks use `lime-deep` / `lavender-deep`** (or a 1.5 px deep-colour edge) to reach 3:1.
- Red delta pills are replaced: positive = `lime` pill with ink text and ↗; negative = `surface-2` pill with `ink-2` text and ↘. **No red anywhere except destructive buttons.**

## 3. Typography
- Family: **Plus Jakarta Sans** (web via `@fontsource/plus-jakarta-sans`, phone via `expo-font`). Fallback: Inter, system-ui.
- Numbers: `font-variant-numeric: tabular-nums`; big numbers use weight 500–600, tight tracking (−2 %).

| Role | Size / line | Weight |
|---|---|---|
| Hero number (score, minutes) | 56–72 / 1.0 | 600 |
| Page title ("Today", "Good evening, Dhanush") | 32 / 1.15 (web 40) | 600 |
| Card title / P1 title | 22–28 / 1.2 | 600 |
| Body | 16 / 1.5 | 400–500 |
| Label / chip | 13–14 / 1.2 | 500 |
| Micro (axis, time range) | 12 / 1.2 | 500 |

## 4. Shape, space, depth
- Radius: cards **28** (phone) / **24** (web), inner cards 20, chips & buttons **full pill**, icon buttons **circle**.
- Spacing: 8-pt grid; card padding 20 (phone) / 24 (web); gap between cards 12 (phone) / 16 (web).
- Depth: **flat**. Separation by tone (canvas → surface → surface-2), not shadows. Only the floating bottom nav and modal sheets get a soft shadow (`0 8 24 rgba(0,0,0,.12)`).
- Icon buttons: 48 circle (`surface-2`), primary "+" 48 circle (`charcoal` with white icon), notifications/settings 48 circle (`lavender-soft`).
- Card corner action: 44 circle with ↗ (white on coloured cards, `surface-2` on white cards).
- Optional signature detail from refs 02/03: the **notched card bottom** (small rounded tab joining stacked cards) — v2 polish, SVG mask, not required.

## 5. Components
| Component | Spec |
|---|---|
| `BottomNav` (phone) | Floating charcoal pill, 64 high, 16 from bottom, 4 icons; active = white circle with charcoal icon (+ label on wide phones); a tiny lime dot marks a tab with something pending |
| `IconCircle` | 48 circle, variants: neutral (`surface-2`), primary (`charcoal`), soft (`lavender-soft`) |
| `P1HeroCard` | Charcoal pill/rounded card, P1 title in white, Minimum + if-then in `ink-2`-on-dark (#B8B8BE), **lime 64 circle arrow button = Start** |
| `MissionCard` | 28-radius card; P2 = `lavender`, P3 = `lime-soft`, side quest = `surface-2`; ink text; ↗ circle opens detail; outline pill shows est. minutes; status chips row at the bottom |
| `StatusChips` | Pills: **Done** (lime fill, ✓), **Minimum** (lavender fill, ◐ + hatch), **Missed** (surface-2 fill, `missed` border, —), **Reschedule** (outline, →). Count bubble variant for filters (ref 02) |
| `SegmentedPills` | Day / Week / Month; selected = lime fill; others `surface-2` |
| `DayCircle` | 40–44 circle day cell. Strong = lime fill; Solid = lavender fill; Light = lime-soft fill + lime-deep ring; Missed = `surface-2` + `missed` dash; Rest/write-off = hollow ring; Today = charcoal fill, white number; dot under = has notes/reflection |
| `MetricCard` | White card, label top-left, small icon top-right (no brand logos), **hero number** + delta pill, one-line context ("+2 vs last week"), thin progress bar (track `line`, fill gradient lime-deep→lime) with % at right |
| `HatchedStackBar` | Per-day stacked bar: done = `lime` (deep edge), minimum = `lavender` with **45° hatch**, missed = `surface-2` with `missed` hatch; rounded 10 tops; day label + date circle under (ref 03) |
| `StripeTrend` | Vertical 2 px lines forming an area (ref 01) for screen minutes or exec %, coloured by band: ≤ 120 lime-deep, 120–180 butter, > 180 `missed` grey (never red); weekday labels at baseline |
| `SegmentGauge` | 12 rounded segments in an arc = **the 12 weeks of the cycle**; each segment coloured by that week's average mark (lime / lavender / lime-soft / surface-2 for missed / hollow for future); centre: big % + one word ("On track", "Steady", "Rebuilding") |
| `RingProgress` | 56 ring, 6 stroke, number in centre, coloured by area pastel (deep edge) — per cycle goal |
| `AreaBlock` | Pastel block (sage/rose/butter/sky) with a darker tag pill ("Japanese"), title, time range — web week view and goal lists |
| `TimeRail` | Hour labels at left, current-time line in `charcoal` with a dot (ref 07) |
| `StoryToast` | Small `surface` card sliding up above the nav, 1 line, lavender left bar, dismiss on tap |

## 6. Screen compositions

### Phone
**Today** (refs 02/03)
1. Header: "Good morning" (ink-2, 16) + date (32 title); right: `+` (capture) and lavender bell (reminders) circles.
2. Filter chips with counts: Done 1 · Minimum 0 · Open 2.
3. `P1HeroCard` (charcoal, lime Start arrow).
4. P2 lavender card, P3 lime-soft card, side quest surface-2 card.
5. Habits strip: horizontal pills, tap to toggle (lime when done).
6. Small "Days shown up · 41" line (no streak).
7. Floating `BottomNav`: Today · Focus · Capture · Settings.

**Morning** — only: greeting, intention question in a white card, `P1HeroCard` full width and taller, Start lengths as three pills (25 · **50** · 90). Nothing else.

**Focus** — huge countdown (hero number) inside a lime ring on white; mission title; Pause / Done / Stuck as three pills; resume note card below.

**History** (from Today header tap) — month grid of `DayCircle`s (ref 01/03) + `MetricCard` pair: "Days shown up" and "Avg score this week".

**Quick close** — list of mission rows with `StatusChips`, habit pills, screen-minutes stepper in a metric card.

### Web (laptop)
**Dashboard (Today)** (ref 05) — icon rail left; top: "Good evening, Dhanush" (40, light), date-range pill, search + bell circles. Bento grid:
- Row 1: `P1HeroCard` (wide) · `MetricCard` Score today (hero number, appears after shutdown) · `MetricCard` Screen minutes with `StripeTrend`.
- Row 2: P2…P9 cards · Inbox count card with ↗ · Habits card.
- Row 3: `SegmentGauge` (cycle) · `RingProgress` list of cycle goals (ref 04 right panel).

**Night ritual** — dark variant, centred 720 px column, step dots as pills at top, each step one white(dark-surface) card; capacity bar as a thick pill track with lime fill and an 80 % tick.

**Weekly Control Room** (refs 03/06/07) — cream canvas; left: week columns with `AreaBlock`s (what was planned per area); right panel: `HatchedStackBar` week chart with Day/Week/Month pills, Muri/Mura/Muda cards, experiment card with ↗.

**Cycle** — big `SegmentGauge` (ref 04 left) + goal rings + experiment log.

## 7. Motion
150–220 ms ease-out. Chip tap: scale 0.96 → 1. Card ↗ opens with shared-element expand. Gauge segments fill one by one (60 ms stagger) only on the review screen. All off under reduced motion. No confetti.

## 8. Don'ts (even though refs show them)
Avatars and face stacks (single user) · brand logos (Slack/Gmail/Google) · red delta pills · white text on lime/lavender · gradients as backgrounds · kanban columns · more than 4 colours in one card group · emoji in core UI copy (allowed only in the user's own text).

## 9. Implementation notes
- Web: Tailwind tokens in `apps/web/tailwind.config.js` (`darkMode: "class"`, toggled by time + setting). Charts: hand-rolled SVG components (bars, stripes, gauge, rings) — no chart library needed.
- Phone: tokens in `apps/mobile/src/theme.ts`; charts with `react-native-svg`; blur/shadow only on `BottomNav`.
- Both: status meaning always icon + label + colour.
- Use the **ui-ux-pro-max** skill to validate type pairing and chart choices against this file, **frontend-design** for web layout quality, and run **tatakae-guardrails** on every screen.
