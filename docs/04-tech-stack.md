# 04 · Tech stack

Versions are the baseline at skeleton time (Oct 2026). Upgrade deliberately, one layer at a time.

| Layer | Choice | Version | Why | Rejected |
|---|---|---|---|---|
| Language | TypeScript (strict) | 5.x | One language across web, phone, API, core | — |
| Monorepo | pnpm workspaces | 9 | Fast, strict, Expo supports it | Nx/Turborepo (overkill for one person) |
| Shared logic | `packages/core` + Zod | zod 3 | One scoring/sync implementation everywhere | Duplicating logic per client |
| Web UI | React + Vite + Tailwind + TanStack Query + React Router | React 19.2, Vite 5 | Known stack, fast dev | Next.js (no SSR need) |
| Web offline | vite-plugin-pwa (injectManifest) + idb | — | Desktop install + IndexedDB outbox | — |
| Notes editor (v3) | BlockNote | latest | Block editor with JSON doc model | Tiptap raw (more work) |
| Phone app | **Expo SDK 57 + Expo Router** (React Native 0.86) | 57 | Native notifications, share intent, widgets, usage stats, background-safe timers; shares TS + core | PWA on phone (weak notifications, no widgets, no usage stats); Flutter/Kotlin (second language) |
| Phone storage | expo-sqlite + Drizzle | — | Same ORM and schema shapes as API | AsyncStorage (not relational) |
| Phone secrets | expo-secure-store | — | Keystore-backed token storage | — |
| Phone notifications | expo-notifications (local) | — | Reliable scheduled reminders without a push server | FCM server push (unneeded) |
| API | Hono on Node 22 (`@hono/node-server`) | Hono 4 | Tiny, typed, fast; same code could run on edge later | Express (untyped), NestJS (heavy), FastAPI (second language) |
| Database | SQLite (WAL) via better-sqlite3 + Drizzle | — | One user; zero ops; FTS5 for notes; Litestream backups | Postgres (ops overhead for no gain) |
| Jobs | croner (in-process, Asia/Kolkata) | 9 | No extra service | System cron (outside the app) |
| Auth | Argon2id + signed sessions; passkeys v4 | @node-rs/argon2 | Single user, works with any domain | Cloudflare Access (needs a Cloudflare zone), OAuth (overkill) |
| Reverse proxy | Caddy 2 | 2.x | Automatic HTTPS, simple config | Nginx + certbot |
| Backups | Litestream → OCI Object Storage + nightly JSON | 0.3 | Point-in-time restore, off-box | Volume snapshots only (same failure domain) |
| Hosting | Oracle Cloud Always Free, A1 Flex 2 OCPU / 12 GB arm64 | — | Free, enough for this; DevOps practice | Cloudflare Workers (original plan; less hands-on), Vercel/Render (sleep/limits) |
| IaC | Terraform `oracle/oci` provider + cloud-init | TF ≥ 1.6 | Rebuild the VM from code | Click-ops only |
| CI/CD | GitHub Actions; arm64 runners; GHCR | — | Native arm64 builds, free for public/student | Self-hosted runner |
| Admin network | Tailscale | — | No public SSH; CI deploys through tailnet | Open port 22 |
| Domain | Namecheap `.me` via GitHub Student Pack (`tatakae.<name>.me` or `tatakae.me`) | — | Free year 1 | See DOMAIN.md |
| Tests | Vitest; Playwright (web smoke, v4) | — | Fast unit tests for core/api | Jest |
| Mobile builds | EAS Build (free tier) or local Gradle in Actions; APK via GitHub Releases; EAS Update for JS | — | No Play Store needed for one user | Play Store (fee, review) |

## Version policy
- Expo: stay on one SDK per phase; upgrade between phases with `npx expo install --fix` and the `expo-upgrade` skill.
- Pin exact versions for `react`, `react-native`, `expo`; caret elsewhere.
- Renovate/Dependabot: optional from v4.
