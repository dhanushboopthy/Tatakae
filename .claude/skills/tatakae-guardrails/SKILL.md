---
name: tatakae-guardrails
description: Review any TATAKAE UI, copy, notification or scoring change against the project's non-negotiable design rules (grey not red, no streaks/XP, ≤60s logging, one-screen morning, ≤3 notifications, accessibility). Use before finishing any web or mobile screen, component, notification or copy change.
---

# TATAKAE guardrails review

Run this checklist against the diff (or the screen being built). Report each item as PASS / FAIL with file:line, then fix FAILs before finishing.

## Method rules
1. Logging path for the touched flow is ≤ 60 s and uses one-tap controls with defaults. No required fields on capture.
2. Morning screen shows only intention, P1 card, Start (and small Stuck / Show P2-P3 links). No stats, no story.
3. Misses render grey (`missed` token). Red appears only on destructive actions — including delta pills (negative = grey ↘).
3b. Visual system follows docs/10-design-system.md: tokens only (no raw hex in components), ink text on lime/lavender/pastel fills, chart marks use *-deep colours, no avatars or brand logos.
4. No streak counters, no resets to zero, no XP, levels, coins, badges-as-currency. Use "days shown up" (cumulative).
5. Ranked missions: 5 shown by default, at most 9 (P1–P9), + 1 side quest. Planned time above 80 % warns, never blocks.
6. Locked-plan edits require a typed reason (mura event) — soft lock, never a hard block.
7. Habits are not part of the score.
8. Scoring code uses `@tatakae/core` only — never re-implemented in a client.
9. "Today" uses `todayIST()` (Asia/Kolkata, 04:00 boundary), never `new Date()` directly.
10. Writes go through the outbox (optimistic) on both clients.

## Notifications & story
11. Total scheduled notifications ≤ 3/day; none mention streaks, failure or guilt.
12. Story lines: random (~1/3), ≤ 160 chars, never on Morning or in notifications, respect "story off". The only image is the owner's own picture for the title (settings `story_pictures`).

## Copy
13. Calm, short, second person. No "failed" (use "not this time"). No exclamation marks outside story lines.

## Accessibility
14. Text contrast ≥ 4.5:1, UI/chart marks ≥ 3:1 (check the grey on `ink`).
15. Touch targets ≥ 44 px/dp; visible focus on web; status never conveyed by colour alone (icon + label).
16. Screen-reader labels on chips, buttons, charts; reduced motion respected.

## IP
17. No character art, logos, screenshots, audio, quotes or franchise names in the app name/icon or anything committed. Franchise lines and pictures live only in the owner's git-ignored `references/*.local.json` and `references/pictures/`.

Reference: docs/01-overview.md, docs/02-method.md, docs/05-ui-ux.md, docs/10-design-system.md.
