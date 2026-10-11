# Decisions (ADR-lite)

1. **Hosting: one Oracle Cloud Always Free Ampere A1 VM** (2 OCPU / 12 GB since the June 2026 cut), Ubuntu 24.04 arm64, Docker Compose.
   Chosen over Cloudflare Workers for full control and DevOps practice. Trade-off: you run patches, TLS, backups and uptime.
2. **Caddy** for automatic HTTPS + static web app + reverse proxy. HTTPS is mandatory for PWA install and push.
3. **SQLite (WAL) + Drizzle + better-sqlite3** on the block volume. FTS5 for notes. One user → no need for Postgres.
4. **Backups: Litestream (continuous) + nightly JSON export**, both to OCI Object Storage (S3-compatible). The VM is disposable.
5. **Auth: app-level single-user login** (argon2id password, 90-day HttpOnly session per device; passkeys in v4).
   Cloudflare Access needs a full domain on Cloudflare, which free subdomains (DuckDNS, is-a.dev) are not.
6. **SSH only over Tailscale**; public ports 80/443 only. GitHub Actions deploys through Tailscale.
7. **Images built on GitHub's arm64 runners**, pushed to GHCR, pulled on the VM.
8. Offline outbox + LWW per row; server authoritative on plan lock.
9. Simple scoring; habits tracked not scored. No streaks, no XP, grey misses. Story layer = paraphrased text only.

10. **Two clients: laptop website + native Android app (Expo SDK 57).** The phone needs reliable local notifications, share intent, a home-screen widget, automatic screen-time (UsageStatsManager) and background-safe timers — a PWA does these poorly or not at all. Trade-off: two UIs; mitigated by sharing `packages/core` (types, zod, scoring, story, sync) and one API. iOS possible later (needs paid Apple account).
11. **Night ritual is laptop-only;** the phone gets a 45-second Quick close fallback.
12. **Phone notifications are local,** not server push.
13. **Skills:** anthropics/skills, ui-ux-pro-max, superpowers, expo, vercel react skills, hashicorp terraform + 3 project skills (docs/09).

Full plan: https://claude.ai/code/artifact/f1fb71f2-d965-4018-9858-308733db30e5
