# 05 · UI / UX

## Evidence that shaped the design
| Finding | Source | Design decision |
|---|---|---|
| Top reasons people quit trackers: "a hassle", feeling lazy, losing interest | Epstein et al., CHI 2016 (n = 193) | ≤ 60 s logging, one-tap chips, defaults |
| Missing one day "did not materially affect" habit formation | Lally et al. 2010 | Grey misses, no streak resets, "don't miss twice" soft rule |
| If-then plans: d ≈ .65 on goal attainment | Gollwitzer & Sheeran 2006; 2024 update | P1 requires if-then |
| Expected contingent rewards lower intrinsic motivation; unexpected/informational feedback doesn't | Deci, Koestner & Ryan 1999 (disputed by Cameron & Pierce) | No XP/points; story lines random and informational |
| Gamification's motivational effects are small and fade (novelty) | Sailer & Homner 2020 | Story rotates by cycle; can be switched off |
| A pause before opening distracting apps cut openings substantially | Grüning et al., PNAS 2023 (no control group) | Friction goes on distractions (OS tools), never on TATAKAE logging; lock edits need a reason |
| Batched notifications (3/day) beat both always-on and none | Fitz et al. 2019 | ≤ 3 predictable notifications |
| Sunsama's capacity warning and shutdown are the most-praised features | Reviews | 80 % capacity bar, Shutdown complete |
| Duolingo: leniency (any lesson counts) grew 7-day+ streaks by > 40 % | Duolingo blog | Minimum = half credit |

## Information architecture
**Phone (bottom tabs):** Today · Focus · **Capture** (centre, large) · Settings. Modals: Morning, Welcome back, Quick close, Stuck, Recharge.
**Web (left sidebar):** Today · Ritual · Inbox · Review (Week / Month) · Cycle · Notes · Settings. Cmd/Ctrl+K command palette everywhere.

Routing rules (both clients): missed yesterday → Welcome back; before P1 started (until noon) → Morning (phone); after ritual time → Ritual prompt (web); otherwise Today.

## Phone screens
| Screen | Must show | Must NOT show | Target |
|---|---|---|---|
| Morning | Intention question, P1 card (title, Minimum, if-then), Start 25/50/90 | Other missions (behind "Show P2/P3"), stats, story | ≤ 10 s to Start |
| Today | P1–P3 + side quest with chips; habits strip; days-shown-up count | Red, streaks, daily score before shutdown | each action ≤ 5 s |
| Focus | Countdown ring, mission title, resume note, Pause / Done / Stuck | Notifications from app | — |
| Stuck | 3 big choices → one follow-up field or timer | Lectures | ≤ 15 s |
| Capture | One autofocused field, Save | Categorisation | ≤ 5 s |
| Quick close | Statuses, habits, screen minutes | Planning tomorrow | ≤ 45 s |
| Welcome back | Calm line, grey history, Restart (P1 only), write-off | Missed-day count in red | — |
| Settings | Times, story on/off, haptics, devices, sync status | Scoring constants (web only) | — |

## Web screens
| Screen | Notes |
|---|---|
| Night ritual | 8-step wizard, progress dots, Enter to advance, autosave each step, resume if interrupted, ≤ 5 min. Capacity bar warns > 80 %. P1 cannot be saved without Minimum + if-then (templates from history). Shutdown = press-and-hold or typed "done". |
| Today (read-mostly) | Same data as phone; edits allowed with lock rules |
| Inbox | j/k navigate, m → mission (backlog/tomorrow), n → note, x → discard; natural-language quick add (stretch) |
| Weekly Control Room | 7-day grid (accent / half / grey / hollow), exec sparkline, screen-minutes line with 120 dashed, Muri/Mura/Muda sections, stuck breakdown, one experiment form, reward unlock |
| Monthly / Cycle | Calendar heatmap, goal progress (done vs minimum), experiment log, area alignment |
| Notes (v3) | List + BlockNote, FTS search, tags, links to goals |
| Settings | Everything incl. scoring constants (even-week Sundays), anchors, recharge menu, reference pack import + disclaimer, devices |

## Components (both clients)
`MissionCard`, `StatusChips` (Done / Minimum / Missed / Reschedule — icon + label, never colour alone), `P1Card`, `BigButton`, `CapacityBar`, `StuckSheet`, `StoryToast`, `HabitStrip`, `DayGrid`, `Sparkline`, `CommandPalette` (web).

## Visual system
- Tokens (shared): `ink #0b0b0f` background (dark grey, not pure black), `paper #ececf1` text, `muted #8a8a96` misses, `ember #f2a33a` primary action, `jade #4fbf8f` done. **Red only for destructive actions.**
- Status encoding: done = accent fill + check; minimum = accent 50 % + half icon; missed = grey + dash; rest/write-off = hollow outline.
- Type: system/Inter, 16 px body min, 1.5 line height; P1 title 28–32 px.
- Spacing: 8-pt grid; one accent colour per screen.
- Motion: subtle; respect reduced motion; no confetti.
- Optional warmer, dimmer palette during the night ritual.

## Copy
Calm, short, second person. No exclamation marks except inside story lines. Never "failed" → "not this time". Examples:
- Empty plan: "No plan locked. Pick one Minimum now."
- Inbox zero: "Inbox zero. Capture anything with one tap."
- Welcome back: "Welcome back. One mission today — that's the whole plan."
- Rules line (shown once in Settings and on Welcome back): "Misses turn grey. Nothing resets. Don't miss twice."

## Notifications (max 3/day)
1. Morning at wake time: "P1: <title>. Start?" → opens Morning.
2. Optional afternoon, only if P1 not started.
3. Ritual reminder at ritual time.
If two consecutive notifications are ignored, ask once whether to change the time. No streak or guilt messages, ever.

## Accessibility (WCAG 2.2 AA)
Text 4.5:1, UI and chart marks 3:1 (check the grey!), targets ≥ 44 px/dp, visible focus rings, full keyboard on web, screen-reader labels on chips and charts, every chart has a one-line text summary, `prefers-reduced-motion` / OS reduce-motion respected, dynamic type on phone.

## Story layer UX
One line in a toast after a completion (~1/3 chance), text only: "<Character>, <Title> — <your paraphrase>" + optional "your line". Tap to dismiss; long-press to mute that reference. Never in notifications, never on Morning. Seasonal rotation per 12-week cycle.

## Anti-patterns (reject in review)
Red misses · streak counters · XP/levels/coins · more than 3 missions · auto-scheduling · guilt notifications · story on every tick · modal chains longer than 2 · required fields on capture · hard locks.

## UI tooling
Use the **ui-ux-pro-max** skill to generate/validate the design system (pick a calm dark style; keep the tokens above as the constraint) and **frontend-design** for distinctive, non-template web layouts. Use **web-design-guidelines** / **webapp-testing** to review web screens and **react-native-skills** + Expo skills for the phone. See 09-skills-and-workflow.md.
