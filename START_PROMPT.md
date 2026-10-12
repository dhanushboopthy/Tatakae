# Start prompts for Claude Code

## 0. One-time setup (in your terminal, repo root)
```bash
pnpm install
bash scripts/setup-claude.sh     # installs skills/plugins, then restart Claude Code
claude
```
In Claude Code run `/plugin` and confirm: example-skills, ui-ux-pro-max, superpowers, expo, terraform. Project skills (`tatakae-*`) load from `.claude/skills`.

---

## 1. Kick-off prompt (paste first)
```
Read CLAUDE.md, then every file in docs/ in numeric order (01 → 09, plus DECISIONS.md and DOMAIN.md).
Then:
1. Summarise in ≤ 15 bullets: what TATAKAE is, the two clients and their split of features, the architecture, and the phase plan with gates.
2. List anything in the docs that is contradictory, ambiguous or that you think is a mistake — don't fix yet.
3. Confirm which skills/plugins are available to you (ui-ux-pro-max, frontend-design, webapp-testing, superpowers, expo, react-native-skills, react-best-practices, terraform, tatakae-guardrails, tatakae-phase-gate, tatakae-story-pack). Tell me which are missing.
Stop and wait for me.
```

## 2. Design-system prompt (once, before UI work in v1)
```
Open every image in docs/design/references/, read the mockups in docs/design/mockups/ (target look), and read docs/10-design-system.md, docs/11-dashboards-charts-calendar.md and docs/05-ui-ux.md.
Use the ui-ux-pro-max skill (stacks: React + Tailwind, React Native) and the frontend-design skill.
1. Check 10-design-system.md against the references: list anything in the references I'd likely want that the spec misses, and any token that fails WCAG 2.2 AA (show ratios). Don't change the direction.
2. Build a static "kitchen sink" page in apps/web (route /dev/design, dev-only) and a matching screen in apps/mobile (/dev-design, dev-only) showing every token and component from docs/10 §5 and docs/11 with fake data: P1HeroCard, MissionCard variants, StatusChips, DayCircle states, MonthCalendar, WeekStrip, MetricCard/Scoreboard, HatchedStackBar, StripeTrend, Sparkline, SegmentGauge, RingProgress, BlockBarChart, HabitHeatGrid, PillBar, CapacityBar, FocusRing, WeekPlanner + TimeRail (web), BottomNav, every icon from core ICONS, light + dark.
3. Then compose phone Today, Calendar and Week, and web Dashboard and Calendar to match docs/design/mockups/ (and docs/10 §6), with fake data, and give me screenshots (webapp-testing for web; Expo dev build for phone).
Run tatakae-guardrails. Stop for my feedback before wiring real data.
```

## 3. Phase prompt (reuse for every phase: 0, v1, v2, v3, v4)
```
We are on phase <X>. Use superpowers:brainstorming only if a task is unclear, then superpowers:writing-plans to write docs/plans/phase-<X>.md from docs/06-phases.md (ordered tasks, files touched, tests, risks).
Then work through the plan one task at a time:
- core/api: superpowers:test-driven-development; web: frontend-design + react-best-practices; phone: expo skills + react-native-skills; infra: terraform skill.
- After each task: pnpm typecheck && pnpm test, run tatakae-guardrails for UI tasks, tick the box in docs/06-phases.md, add a CHANGELOG line, commit (Conventional Commits).
- Ask me before: new dependencies, anything that costs money, anything I must do by hand (OCI console, DNS, Tailscale, keystore) — give exact steps for those.
Stop after each task with a 3-line summary and wait for "next".
```

## 4. Phase 0 specific (first real build session)
```
Phase 0. Before writing code, give me the exact manual steps (in order) for: OCI sign-up and Pay-As-You-Go decision, OCI API key for Terraform, Namecheap .me claim via GitHub Student Pack + DNS A record, Tailscale account + OAuth client for GitHub Actions, GitHub secrets/variables list, Android phone setup for a dev build. Then implement tasks 0.1 → 0.11 using the phase prompt rules.
```

## 5. Gate check (end of each phase / Sundays)
```
Run the tatakae-phase-gate skill for phase <X>. Then superpowers:requesting-code-review on the phase's changes. Give me the remaining list, smallest first.
```

## 6. Debugging
```
Use superpowers:systematic-debugging. Symptom: <what I saw, where, when>. Don't change code until you've reproduced it and stated the root cause.
```
