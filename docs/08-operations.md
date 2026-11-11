# 08 · Operations

> **Hosting is undecided.** The Oracle Cloud VM setup and the Zoho Catalyst setup were both removed (owner's
> decision, Nov 2026). The API is a plain Node process (or the Docker image in `apps/api/Dockerfile`) that needs
> a durable disk for its SQLite file, so any host that gives it a persistent volume works. This page covers what is
> independent of the host. Add a "Deploy" section here once the new plan is chosen.

## Run locally
`scripts/local-up.sh` builds the website and API in Docker from `deploy/docker-compose.local.yml` and serves them
on `127.0.0.1` (first free port from 8080). For development without Docker: `pnpm dev` (API :8787, web :5173).

## Phone releases
Tag `mobile-vX.Y.Z` → `mobile.yml` builds a signed APK → GitHub Release → install on the phone. JS-only fixes go
out through EAS Update (channel `production`, signed). Steps: `docs/MANUAL-STEPS.md`.

## Configuration
The API reads environment variables only (`apps/api/src/env.ts`): `OWNER_EMAIL`, `OWNER_PASSWORD_HASH`,
`SESSION_SECRET`, `PUBLIC_ORIGIN`, `DATABASE_PATH`, `FILES_DIR`, `BACKUP_DIR`, optional `S3_*` (off-box backups to
any S3-compatible bucket), `VAPID_*` (web push), `MIN_MOBILE_VERSION` and `LATEST_APK_URL` (phone update banner).
Secrets stay out of the repo and out of images.

| Where | What |
|---|---|
| The API's environment | the variables above |
| GitHub secrets | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` |
| Your password manager | Android keystore file + passwords (losing it = can't update the app in place), EAS signing key |

## Backups
1. Nightly JSON export at 02:00 IST: the newest 7 kept on disk, and the newest 30 in the S3 bucket when `S3_*` is set.
2. Settings → Data downloads everything as JSON at any time.
The phone also holds an offline copy of the data as a last resort. Whatever host you pick should also snapshot the
volume that holds `DATABASE_PATH`.

## Runbooks
- **Rotate a lost phone:** revoke the device in web Settings → Devices; log in on the new phone. Check "Recent sign-ins and changes" there for anything that wasn't you.
- **Change the password:** `deploy/scripts/hash-password.sh` → replace `OWNER_PASSWORD_HASH` in the API's environment → restart the API. On boot the API notices the new login and signs every device out (logged as "Password changed"); sign in again everywhere. Without a restart, Settings → Devices → "Sign out every other device" does the same for the others.
- **Change domain:** update `PUBLIC_ORIGIN` (and `WEBAUTHN_*` if set), reinstall the web app on laptops (passkeys are tied to the domain), and rebuild the phone app with the new `EXPO_PUBLIC_API_URL`.

## Domain
See DOMAIN.md.

## Monitoring (lightweight)
`/api/health`, `job_runs` in Settings → System, optional free uptime check (e.g. a GitHub Actions cron hitting `/api/health` daily and opening an issue on failure).
