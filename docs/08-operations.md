# 08 · Operations

> The Oracle Cloud VM and Zoho Catalyst setups were removed (owner's decision, Nov 2026). Tatakae now runs on the
> shared `duolink` server, described next. The API is a plain Node process that needs a durable disk for its SQLite
> file, so any host with a persistent volume works the same way.

## Production: the `duolink` server (since 11 Nov 2026)
**URL:** https://tatakae.srikrishnlegaloffice.in. DNS: an `A` record `tatakae` → the server's public IPv4 (Hostinger DNS).
The server is shared with other sites, so Tatakae stays out of their way: its own Linux user, its own nginx server
block, and its own port.

| Piece | Where / how |
|---|---|
| Linux user | `tatakae` (no sudo). Always log in as it, never root. Repo at `/home/tatakae/TATAKAE` |
| API | `systemd --user` unit `tatakae-api` (`~/.config/systemd/user/tatakae-api.service`), `node dist/server.js` in `apps/api`, listening on **`127.0.0.1:8791`**. Do not use 8787: another site owns it. `loginctl enable-linger tatakae` keeps it running after logout and reboot |
| Config / secrets | `~/tatakae.env` (mode 600): `NODE_ENV=production`, `PORT=8791`, `PUBLIC_ORIGIN`, `TRUSTED_PROXY_HOPS=1`, `OWNER_EMAIL`, `OWNER_PASSWORD_HASH`, `SESSION_SECRET`, `DATABASE_PATH`, `FILES_DIR`, `BACKUP_DIR`, `MIGRATIONS_DIR` |
| Data | `~/tatakae-data/` (`tatakae.db`, `files/`, `backups/`) |
| Website | static build in `apps/web/dist`, served by nginx. `/home/tatakae` is mode 711 so nginx can reach it (no listing) |
| nginx | server block `/etc/nginx/sites-available/tatakae.srikrishnlegaloffice.in` plus `/etc/nginx/snippets/tatakae-headers.conf`. Reference copies: `deploy/nginx/`. `/api/` proxies to the API; `/assets/` is immutable-cached; everything else falls back to `index.html` with `no-cache`; body cap 25 MB; CSP and security headers as in `deploy/Caddyfile.local` |
| HTTPS | Let's Encrypt via `certbot --nginx`, renewed automatically (`certbot renew` timer). It added the 443 block and the http → https redirect |
| Firewall | ufw allows 22, 80, 443 only. The API port is not reachable from outside |

### Deploy an update
Merge to `main`, then from the laptop:
```bash
ssh tatakae@duolink 'cd ~/TATAKAE && deploy/scripts/deploy.sh'
```
`deploy/scripts/deploy.sh [git-ref]` (run as `tatakae`, never root) fetches, fast-forwards to `origin/main` (or the ref
you give), runs `pnpm install --frozen-lockfile`, builds web and API, snapshots the database to
`~/tatakae-data/backups/pre-deploy-*.db` (newest 5 kept), restarts `tatakae-api` and waits for `/api/health`. If the
health check fails it goes back to the previous commit, rebuilds and restarts, then exits 1. It refuses to run with
local changes in the checkout or to move backwards. Database migrations run on API start. The website needs no
restart: nginx reads the new `dist`.
Logs: `journalctl --user -u tatakae-api -f`. Status: `systemctl --user status tatakae-api`.

### Set up from scratch (what was done)
1. Root, once: `useradd -m -s /bin/bash tatakae`; copy `authorized_keys` into `/home/tatakae/.ssh`.
2. As `tatakae`: install the repo (rsync without `node_modules`), `corepack enable --install-directory ~/.local/bin`, `pnpm install --frozen-lockfile`, build web and API.
3. As `tatakae`: create `~/tatakae.env` (generate `SESSION_SECRET` with `openssl rand -hex 32`; hash the owner password with `deploy/scripts/hash-password.sh - --raw`, keeping the hash in single quotes), then the systemd user unit, `systemctl --user enable --now tatakae-api`.
4. Root, once: `chmod 711 /home/tatakae`, `loginctl enable-linger tatakae`, install the files from `deploy/nginx/` to the paths above, symlink into `sites-enabled`, `nginx -t && systemctl reload nginx`, then `certbot --nginx -d tatakae.srikrishnlegaloffice.in --redirect`.
5. Add the DNS `A` record before step 4's certbot, or the certificate request fails.

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
1. Nightly JSON export at 02:00 IST: the newest 7 kept in `~/tatakae-data/backups`, and the newest 30 in the S3 bucket when `S3_*` is set.
2. Settings → Data downloads everything as JSON at any time.
The phone also holds an offline copy of the data as a last resort.
**Gap:** on `duolink` the nightly backups sit on the same disk as the database and `S3_*` is not set, so a lost disk loses both.
Until an off-box copy exists, download the export from Settings → Data now and then, or copy
`~/tatakae-data/backups` to your laptop with `rsync -a tatakae@duolink:tatakae-data/backups/ ./tatakae-backups/`.

## Runbooks
- **Rotate a lost phone:** revoke the device in web Settings → Devices; log in on the new phone. Check "Recent sign-ins and changes" there for anything that wasn't you.
- **Change the password:** `deploy/scripts/hash-password.sh` → replace `OWNER_PASSWORD_HASH` in `~/tatakae.env` (single quotes around the hash) → `systemctl --user restart tatakae-api`. On boot the API notices the new login and signs every device out (logged as "Password changed"); sign in again everywhere. Without a restart, Settings → Devices → "Sign out every other device" does the same for the others.
- **Change domain:** update the DNS record, `server_name` and certificate (`certbot --nginx -d <new>`), `PUBLIC_ORIGIN` (and `WEBAUTHN_*` if set) in `~/tatakae.env`, reinstall the web app on laptops (passkeys are tied to the domain), and rebuild the phone app with the new `EXPO_PUBLIC_API_URL` and the `DOMAIN` repository variable.
- **API won't start:** `journalctl --user -u tatakae-api -n 50`. A missing or invalid variable is listed by name. A port clash shows `EADDRINUSE`: check `ss -tlnp | grep 8791`.
- **Certificate problems:** `sudo certbot certificates` (root), and check the DNS `A` record still points at the server.

## Domain
`srikrishnlegaloffice.in` on Hostinger, subdomain `tatakae`. See DOMAIN.md for the general options.

## Monitoring (lightweight)
`/api/health`, `job_runs` in Settings → System, optional free uptime check (e.g. a GitHub Actions cron hitting `/api/health` daily and opening an issue on failure).
