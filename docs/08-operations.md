# 08 · Operations

## Oracle Cloud facts (checked Oct 2026)
- Always Free Ampere A1: **2 OCPU / 12 GB** total since 15 Jun 2026 (was 4/24). Use it as one VM.
- Block storage 200 GB total (boot + block), Object Storage 20 GB (free-only accounts), 10 TB egress/month.
- **Idle reclamation:** over 7 days, CPU p95 < 20 % **and** network < 20 % **and** memory < 20 % → may be reclaimed. A one-user app looks idle. Preferred: upgrade to **Pay-As-You-Go** (Always Free stays free) + ₹1 budget alert. Don't fake load by default.
- "Out of host capacity" for A1 is common: retry off-peak / another AD / PAYG.
- Oracle Ubuntu images ship iptables rules rejecting all but 22 → open 80/443 in iptables and the security list.

## Deploy
Push to `main` → `deploy.yml`: build arm64 images on `ubuntu-24.04-arm` → GHCR (`tatakae-api`, `tatakae-web`, tagged with SHA + latest) → join tailnet → copy compose files → `deploy.sh <sha>` (snapshot DB, pull, up -d, health check, roll back on failure) → smoke test.

Phone: tag `mobile-vX.Y.Z` → `mobile.yml` builds a signed APK → GitHub Release → install on phone. JS-only fixes via EAS Update channel `preview`.

## Secrets
| Where | What |
|---|---|
| `/opt/tatakae/.env` (chmod 600) | OWNER_EMAIL, OWNER_PASSWORD_HASH, SESSION_SECRET, API_TOKEN, S3_*, VAPID_*, DOMAIN |
| GitHub secrets | TS_OAUTH_CLIENT_ID, TS_OAUTH_SECRET, VM_USER, VM_TAILNET_HOST, ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD |
| GitHub variables | DOMAIN |
| Your password manager | Android keystore file + passwords (losing it = can't update the app in place) |

## Backups
1. Litestream: continuous WAL replication, 30-day retention.
2. Nightly JSON export at 02:00 IST (30 kept).
3. `deploy.sh` takes a `sqlite3 .backup` before each deploy.
Phone holds an offline copy of v1 data as a last resort.

## Runbooks
- **Restore on a new VM:** `terraform apply` → cloud-init → copy `.env` → `restore.sh` → `docker compose up -d` → check `/api/health` → devices resync.
- **Rotate a lost phone:** revoke device in web Settings → Devices; log in on new phone.
- **Change domain:** update DNS, `DOMAIN`/`PUBLIC_ORIGIN` in `.env`, redeploy; reinstall web app on laptops; rebuild phone app with new `EXPO_PUBLIC_API_URL`.
- **Disk full:** `docker image prune -af`, check Litestream retention, check files dir.
- **Cert issues:** `docker compose logs web`; confirm 80/443 open in both firewalls.

## Domain
See DOMAIN.md — Namecheap `.me` via Student Pack; auto-renew off; DuckDNS fallback.

## Monitoring (lightweight)
`/api/health`, `job_runs` in Settings → System, optional free uptime check (e.g. a GitHub Actions cron hitting `/api/health` daily and opening an issue on failure).
