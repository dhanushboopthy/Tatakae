# Changelog

## Unreleased
- Skeleton created (stubs only).
- Hosting switched from Cloudflare to a single Oracle Cloud Always Free VM (Docker Compose, Caddy, SQLite + Litestream, Tailscale, Terraform OCI). Free-domain plan in docs/DOMAIN.md.
- Split into laptop website (apps/web) + native Android app (apps/mobile, Expo SDK 57). API: mobile bearer sessions, /app/version. Core: sync helpers, login schemas.
- Full docs set (docs/01–09), CLAUDE.md, START_PROMPT.md, project skills in .claude/skills, scripts/setup-claude.sh.
