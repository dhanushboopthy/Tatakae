# 02 · The method

The software exists to run this method. If a feature does not serve a step below, it does not ship.

## Principles behind it
| Principle | Source | How it shows up |
|---|---|---|
| Kaizen | Toyota / Imai | Minimum versions, one experiment at a time, weekly Muri → Mura → Muda review |
| Ikigai | Japanese | Areas with a "why"; monthly alignment check |
| Shoshin (beginner's mind) | Zen | "What did I practise?" question; notes flags can-explain / can-implement |
| Hara Hachi Bu | Okinawa | Plan to 80 % of free time |
| Wabi-Sabi | Japanese aesthetics | Grey misses, imperfect days count, Minimum = half credit |
| Implementation intentions | Gollwitzer & Sheeran (d ≈ .65 across 94 tests) | P1 requires an if-then plan |
| Ivy Lee method | Classic | A short ranked list: 5 missions by default, up to 9 (owner's choice, 12 Oct 2026) |
| Shutdown ritual | Cal Newport | "Shutdown complete" locks the plan |
| Feel-good productivity | Ali Abdaal | Recharge menu, Stuck diagnosis (uncertainty / fear / inertia), play in the story layer |
| Habit formation | Lally et al. 2010 | One miss doesn't matter → "don't miss twice" as a soft rule |

## Daily loop

### Night ritual — laptop, 21:30 default, ≤ 5 min
1. **Close today** — each mission: Done / Minimum / Missed / Rescheduled. Enter recreational screen minutes (phone prefills on Android from v2).
2. **Small win** — one line (skippable).
3. **Three questions** — Did I do P1? What made me drift? What did I practise?
4. **Close loops** — resume note for every unfinished mission.
5. **Capacity** — tomorrow's anchors and free minutes; bar against 80 %.
6. **Pick ranked missions** — 5 rows by default (P1–P5), "Add" for more up to P9. P1 needs a **Minimum** version and an **if-then** plan; the others are optional. Points default 1. The capacity bar still warns above 80 %.
7. **Side quest** — optional, one, unscored.
8. **Shutdown complete** — lock tomorrow (`forged_at`). Screen says: phone outside the room.
   - **Restart the ritual** (rare, high friction): a written reason (≥ 20 characters) → a 15-second pause → type "restart" → hold 3 s. Server: today or later, once per plan, at most 2 in any 7 days, logged as a mura event ("Ritual restarted: …") for Sunday's review. Changing one mission still goes through the normal lock reason.

If the laptop ritual is missed, the phone offers **Quick close** (statuses, habits, screen minutes — ≤ 45 s). It does not plan tomorrow; next morning shows "No plan locked — pick one Minimum now."

### Morning — phone
One screen: "What would make today a win?" → P1 card (title, Minimum, if-then) → **Start** (25 / 50 / 90 min, default 50). Nothing else until P1 is started or deferred.

### During the day — phone
- **Status chips** on every mission.
- **Soft lock:** changing a locked plan needs a typed reason → stored as a *mura* event for Sunday.
- **Stuck button:** Uncertainty → write the next physical action. Fear → 10/10/10 + act-as-if-confident. Inertia → a 5-minute timer starts now.
- **Recharge menu** after a focus block: walk, music, call, stretch, sketch.
- **Quick capture** to the inbox from anywhere (tab, share sheet, launcher shortcut, widget).

## Reviews — laptop
- **Sunday Control Room (15–20 min):** stats → **Muri** (overload: planned > capacity?) → **Mura** (unevenness: lock-edit reasons, stuck events) → **Muda** (waste: screen minutes, rescheduled-twice missions) → choose **one experiment** for 2 weeks → plan the week → unlock a reward episode.
- **Monthly:** averages (excluding rest/write-off days), area alignment, wins / failed / why, next month's theme.
- **12-week cycle:** Cycle 1 = 12 Oct 2026 – 3 Jan 2027, max 4 goals, each passes a "hell-yeah" gate.
- Even-ISO-week Sundays unlock editing scoring constants (prevents tinkering mid-week).

## Scoring (exact)
```
points(m)  = m.points ?? 1
planned    = Σ points(m) where status ∉ {rescheduled, backlog} and slot ≠ side   (side quests are unscored)
earned     = Σ done → points, minimum → points/2, missed|open → 0
exec       = planned == 0 ? 0 : round(100 × earned / planned)
penalty    = −min(20, 5 × floor(max(0, screen_min − 120) / 30))
bonus      = (yesterday was a missed day && P1 ∈ {done, minimum}) ? +10 : 0
final      = clamp(exec + penalty + bonus, 0, 100)
mark       = planned == 0 ? Unplanned : final ≥ 80 ? Strong : final ≥ 50 ? Solid : Light
missedDay  = kind == normal && (planned == 0 || exec < 25)
```
Rest and write-off days are excluded from averages. All thresholds live in `settings` (defaults in `packages/core/src/scoring.ts`).

| Example | Planned | Earned | Screen | Final | Mark |
|---|---|---|---|---|---|
| All 3 done, 90 min screen | 3 | 3 | 0 | 100 | Strong |
| P1 done, P2 minimum, P3 missed, 160 min | 3 | 1.5 | −5 | 45 | Light |
| Comeback day: P1 minimum only, 100 min | 1 | 0.5 | 0 | 60 | Solid |

## Lapse protocol
- Misses render grey; nothing resets.
- After ≥ 1 missed day: **Welcome back** screen → **Restart** plans only P1.
- **Comeback bonus** +10 (above).
- **Write-off day**: max 2 per month, one tap with a reason.
- **Rest day**: Sunday after the review by default.

## Story layer
Your watch history (anime, Tamil films, Hollywood, K-dramas, series) becomes **paraphrased lessons tied to moments**: P1 done, Minimum done, comeback, stuck-fear, stuck-inertia, weekly review, cycle start, rest day. Shown on ~1 in 3 completions at random, never twice in 14 days, never on the morning screen. Monthly themes follow learning goals (Oct = Terraform, Nov = Kubernetes, Dec = AWS SAA). A **reward queue** unlocks an episode of an unwatched show when a review is completed — a light nudge, not a currency.

IP rules: titles and character names + your own paraphrase (≤ 160 chars). No art, logos, screenshots, audio or verbatim quotes. The real pack is local (`references/*.local.json`, git-ignored) and imported in Settings.
