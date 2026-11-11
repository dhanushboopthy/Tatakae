# Decisions (ADR-lite)

> **Update (Nov 2026):** items 1, 4, 6 and 7 below describe the Oracle Cloud VM setup, which the owner dropped, as
> did the later Zoho Catalyst plan. Both are removed from the repo. Tatakae now runs on the owner's shared `duolink` server behind nginx, as its own
> Linux user (see `08-operations.md`).
> The rest still stands.

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
11. **Night ritual started laptop-only;** the phone got a 45-second Quick close fallback. *Changed Nov 2026:* the owner wanted every feature on the phone, so the phone now has the full eight-step ritual too (`app/ritual.tsx`), plus reviews, inbox triage, goal editing, the week planner and the remaining settings. Quick close stays as the fast fallback.
12. **Phone notifications are local,** not server push.
13. **Skills:** anthropics/skills, ui-ux-pro-max, superpowers, expo, vercel react skills, hashicorp terraform + 3 project skills (docs/09).
14. **Visual direction "Soft Bento"** from user references (docs/10-design-system.md): light by day, dark at night; ink text on accent fills (references used white text that fails contrast); red removed from deltas.

Full plan: https://claude.ai/code/artifact/f1fb71f2-d965-4018-9858-308733db30e5
