# tatakae

Personal execution system — plan the night before (laptop), start strict and act during the day (phone), review weekly and per 12-week cycle. One user, self-hosted on an Oracle Cloud Always Free VM.

> **Skeleton only.** Files contain signatures, types, config and `TODO(phase)` markers. Start with **[START_PROMPT.md](START_PROMPT.md)** and **[docs/](docs/README.md)**.

## Layout
```
apps/web/              laptop website — React 19 + Vite (installable desktop PWA)
apps/mobile/           Android app — Expo SDK 57 + Expo Router, local SQLite, local notifications
apps/api/              API — Hono on Node 22, SQLite (WAL) + Drizzle, croner jobs
packages/core/         shared types, zod schemas, scoring, time, story, sync helpers
db/                    Drizzle schema + migrations (applied on API boot)
deploy/                docker-compose, Caddyfile, litestream, cloud-init, scripts
infra/terraform/       OCI resources (VCN, A1 VM, reserved IP, volume, bucket)
scripts/               setup-claude.sh, notion-import/
references/            story-layer format example (real pack stays local)
docs/                  01-overview … 09-skills-and-workflow, decisions, domain, changelog
.claude/skills/        project skills: tatakae-guardrails, tatakae-phase-gate, tatakae-story-pack
.github/workflows/     ci, deploy (arm64 → GHCR → Tailscale), mobile (APK on tags)
```

## Quick start
```bash
pnpm install
pnpm typecheck && pnpm test
bash scripts/setup-claude.sh      # Claude Code skills/plugins
pnpm dev                          # api :8787 + web :5173 (set DEV_BYPASS_AUTH=1 in apps/api/.env)
pnpm dev:mobile                   # needs an Android dev build: pnpm --filter mobile android
```

## Phases
| Phase | Dates | Gate |
|---|---|---|
| 0 Foundations | 12–18 Oct 2026 | Logged in on 2 laptops + phone over HTTPS; auto-deploy |
| v1 Daily loop | 19 Oct – 1 Nov | 7 days in the app only |
| v2 Reviews + story + native extras | 2 – 15 Nov | Sunday review in the app |
| v3 Notes | 16 Nov – 13 Dec | A week without Notion |
| v4 Hardening | 14 Dec – 3 Jan 2027 | Notion archived; restore rehearsed |
