# 01 · Overview

## What TATAKAE is
A personal execution system for one person (Dhanush): software that **enforces a method** rather than storing tasks. It starts fresh (nothing is imported):

1. **Plan the night before** (laptop, ≤ 5 minutes): close today, pick ranked missions for tomorrow (5 by default, up to 9), lock the plan.
2. **Start strict in the morning** (phone, ≤ 10 seconds): one screen, one P1 mission, one Start button.
3. **Execute during the day** (phone): status chips, focus timer, Stuck button, quick capture.
4. **Reflect weekly / monthly / per 12-week cycle** (laptop): find overload, unevenness and waste; run one experiment at a time.

"Tatakae" (戦え) means "fight!" — the app's job is to make showing up easy and coming back after a bad day easier.

## Surfaces
| Surface | Device | Role |
|---|---|---|
| **Website** (`apps/web`) | 2 laptops, browser | Plan and reflect: night ritual, inbox triage, reviews, cycle goals, notes, full settings |
| **Phone app** (`apps/mobile`) | Android phone, native (Expo) | Do and capture: morning, today, focus, stuck, capture, quick close, local reminders |
| **API** (`apps/api`) | Oracle Cloud VM | Single source of truth, sync, scoring, backups |

## Who it is for
One user, final-year M.Tech student with an internship, freelancing and a "Winter Arc" (gym, Japanese N5, Terraform challenge, DSA, AWS SAA). Known failure modes the design targets: **over-planning, drifting after a missed day, phone distraction in the evening, and abandoning trackers when they become a chore.**

## Design rules (non-negotiable)
1. Logging a day takes **≤ 60 seconds**. One-tap chips; sensible defaults everywhere.
2. The morning is **one screen**: intention, P1 card, Start.
3. **Grey, never red.** Misses are neutral. No "you failed" copy.
4. **No streaks.** Show a cumulative "days shown up" count that never resets.
5. **Story lines are rare** (~1 in 3 completions), paraphrased, never on the morning screen, with a global off switch.
6. **≤ 3 notifications a day**, all predictable, none guilt-based.
7. **"Soft Bento" look** (docs/10-design-system.md): light by day, dark from ritual time; WCAG 2.2 AA, 44 px/dp targets, full keyboard on laptop.
8. **Offline first.** Every write lands locally first and syncs later.
9. **Habits are tracked, not scored.**
10. **Hara Hachi Bu:** plan to 80 % of free time; warn (don't block) above it.

## Non-goals
XP, levels, coins, leaderboards, social features, AI auto-scheduling, multi-user/teams, calendar sync (v1–v3), iOS app (possible later, not built), franchise artwork or quotes.

## Success criteria
- v1: 7 consecutive days run entirely in the app (rituals on laptop, daily actions on phone).
- v2: the Sunday review on 15 Nov 2026 happens in the app.
- v3: one full week of notes kept in the app.
- v4: a disaster-recovery restore has been rehearsed.
