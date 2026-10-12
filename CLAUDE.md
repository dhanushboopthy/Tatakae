# TATAKAE — instructions for Claude Code

Personal execution system for one user. **Laptop website** (`apps/web`) for planning/reviews, **Android app** (`apps/mobile`, Expo) for daily actions, **API** (`apps/api`, Hono + SQLite) on one Oracle Cloud VM. Shared logic in `packages/core`.

## Read before working
- `docs/06-phases.md` — current phase and the next unchecked task (work in order).
- `docs/02-method.md` — the method and exact scoring.
- `docs/05-ui-ux.md` + `docs/10-design-system.md` — screen specs and the "Soft Bento" visual system (for any UI work). Reference images: `docs/design/references/`. Dashboards/charts/calendar/scoreboard/icons: `docs/11-dashboards-charts-calendar.md`.
- `docs/03-architecture.md`, `docs/07-data-and-api.md` — for API/sync/data work.
- `docs/08-operations.md` — for infra/deploy work.

## Commands
```bash
pnpm install
pnpm typecheck            # all workspaces
pnpm test                 # vitest (core, api)
pnpm dev                  # api :8787 + web :5173
pnpm dev:mobile           # Expo dev client (EXPO_PUBLIC_API_URL)
pnpm db:generate          # drizzle-kit migrations from db/schema.ts
```

## Hard rules
- Grey not red; no streaks/XP; ≤ 3 notifications/day; morning = one screen; ≤ 60 s logging; 44 px/dp targets; light "Soft Bento" by day, dark at night; ink text on all coloured fills. Run the `tatakae-guardrails` skill before finishing UI work.
- Scoring, time ("today" = `todayIST()`, 04:00 IST boundary), story picking and sync merge come **only** from `@tatakae/core`.
- All writes go through the outbox (optimistic) on both clients. Server is authoritative on plan lock.
- `packages/core` must stay pure TS (no Node, DOM or React Native APIs).
- Story layer: paraphrased text only, no art/quotes/franchise branding. Real packs are `references/*.local.json` (never commit).
- Secrets never in the repo or images.
- New dependencies: state why in the PR; ask first if not listed in `docs/04-tech-stack.md`.

## Conventions
TypeScript strict, no `any`. Zod schema for every API input/output in `packages/core/src/schemas.ts`. One route file per resource; logic in `apps/api/src/lib`. Conventional Commits, one task per PR, tick the task in `docs/06-phases.md`, add a line to `docs/CHANGELOG.md`.

## Skills to reach for
superpowers (brainstorming, writing-plans, TDD, systematic-debugging, verification-before-completion) · ui-ux-pro-max · frontend-design · webapp-testing · expo (router, dev-client, module, eas-*) · react-best-practices / react-native-skills · terraform · project: tatakae-guardrails, tatakae-phase-gate, tatakae-story-pack. Mapping in `docs/09-skills-and-workflow.md`.
