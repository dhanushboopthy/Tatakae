# Hosting on Zoho Catalyst

TATAKAE runs as **one AppSail container** (`deploy/catalyst/Dockerfile`, linux/amd64) that serves the
api and the website on one origin. AppSail's disk is wiped on restart, so nothing lasting lives there:

| What | Where | Why |
|---|---|---|
| Database | **Turso** (hosted libSQL), opened as an embedded replica by `libsql` | Keeps SQLite, Drizzle, FTS5 search and the transactional sync merge as they are |
| Uploaded files, nightly JSON backup | **Catalyst Stratus**, over REST with a Zoho refresh token | Durable; the nightly job needs no request context |
| Website | Served by the api (`WEB_DIST`) with the same headers and caching as the old Caddyfile | One origin: cookie login, CSRF checks and passkeys work unchanged |

The Oracle setup (`deploy/` compose, Caddy, Litestream, `infra/terraform`, `deploy.yml`) stays in the
repo until this is live. Do the steps in order; each says what "done" looks like.

> Marked **check** = taken from Catalyst's docs/agent skills but not run against a real account yet.
> If a step differs on screen, the screen wins; tell Claude what you saw.

---

## 0. Lockfile (once, on your laptop)
The api gained one dependency, `libsql` (owner approved). The sandbox couldn't reach npm, so:
```bash
pnpm install          # updates pnpm-lock.yaml
pnpm typecheck && pnpm test
TEST_MANUAL_SAVEPOINTS=1 pnpm --filter api test   # the transaction path Turso uses
git add pnpm-lock.yaml && git commit -m "build: lockfile for libsql"
```
Done: CI's `pnpm install --frozen-lockfile` passes.

## 1. Turso database
1. Sign up at turso.tech, install the CLI, `turso auth login`.
2. Create the database close to Catalyst's India data centre (list regions with `turso db locations`;
   Mumbai is `aws-ap-south-1`):
   ```bash
   turso db create tatakae --location aws-ap-south-1
   # moving existing data instead? turso db create tatakae --from-file /path/to/tatakae.db
   turso db show tatakae --url          # TURSO_DATABASE_URL (libsql://…)
   turso db tokens create tatakae       # TURSO_AUTH_TOKEN (store it in your password manager)
   ```
3. Migrations run on the first boot; there is nothing else to create.

Done: `turso db shell tatakae ".tables"` works (empty is fine before the first deploy).

## 2. Catalyst project and CLI
1. Console (catalyst.zoho.in for the India DC) → create project **Tatakae**.
2. `npm install -g zcatalyst-cli` (1.27 or newer), `catalyst login`.
3. At the repo root: `catalyst init` and pick the project. **Check** what it wrote (`catalyst.json`,
   `.catalystrc`): project ids only, no tokens. Commit both; the deploy workflow needs them.

## 3. Stratus bucket
Console → Stratus → **Create bucket**, e.g. `tatakae-files-<something>` (names are global). Keep it
private, **versioning off** (the api replaces objects with `overwrite: true`, which only works without
versioning). Note the bucket URL, e.g. `https://tatakae-files-xyz.zohostratus.in` (**check** the domain
shown for your DC) → `STRATUS_BUCKET_URL`.

## 4. Zoho OAuth for Stratus (self client)
1. api-console.zoho.in → **Self Client** → note Client ID and Secret.
2. **Generate Code** with scope `Stratus.fileop.CREATE,Stratus.fileop.READ` (**check** the exact names in
   the Stratus REST docs), 10 minutes, then exchange it once:
   ```bash
   curl -s https://accounts.zoho.in/oauth/v2/token \
     -d grant_type=authorization_code -d client_id=<id> -d client_secret=<secret> -d code=<code>
   ```
   Keep `refresh_token` from the answer → `ZOHO_REFRESH_TOKEN`. It doesn't expire; revoke it in the API
   console if it leaks.

## 5. First image and AppSail service
```bash
docker build --platform linux/amd64 -f deploy/catalyst/Dockerfile -t tatakae:first .
catalyst deploy appsail --name tatakae --source docker://tatakae:first --port 9000
```
Then Console → AppSail → **tatakae** → Configuration:
- **Instances: min 1, max 1.** The nightly backup and morning push run inside the process, and the login
  limits and passkey challenges live in its memory; two instances would double the jobs and split the limits.
- **Memory 512 MB**, health check path `/api/health`.
- **Environment variables** (the Console is the source of truth for this kind of deploy; avoid the word
  CATALYST in names, AppSail reserves it):

| Variable | Value |
|---|---|
| `OWNER_EMAIL` | your login email |
| `OWNER_PASSWORD_HASH` | `deploy/scripts/hash-password.sh --raw` (paste as is, no quotes) |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `PUBLIC_ORIGIN` | the exact https URL you'll open (step 6), no trailing slash |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | step 1 |
| `STRATUS_BUCKET_URL` | step 3 |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` | step 4 (`ZOHO_ACCOUNTS_URL` comes from AppSail itself) |
| `TRUSTED_PROXY_HOPS` | `1` to start (see step 7) |
| `MIN_MOBILE_VERSION`, `LATEST_APK_URL`, `VAPID_*` | as before, optional |

`NODE_ENV=production`, `WEB_DIST` and the `/tmp/tatakae` paths are set in the image. Redeploy (or
restart) after changing variables.

Done: the AppSail URL answers `/api/health` with `{"ok":true,…}` and shows the login page.

## 6. Domain
Use the `*.catalystappsail.com` URL, or map your own domain in the Console (**check**: AppSail →
Domain mapping, with Catalyst's TLS). Decide before adding passkeys: `PUBLIC_ORIGIN`'s host is the
passkey RP ID, so changing the domain later means adding passkeys again. Point the phone at it too:
repository variable `DOMAIN` → next APK build (`EXPO_PUBLIC_API_URL`).

## 7. Check it end to end
1. Sign in on the laptop and the phone; both sync.
2. Settings → Devices → **Recent sign-ins and changes**: the IP should be your real public IP. If it is a
   private one (10.x, 172.16–31.x, 192.168.x), Catalyst has another proxy in front: set
   `TRUSTED_PROXY_HOPS=2` and check again.
3. Attach a small file to a note, restart the AppSail service, open the file again (it now comes from Stratus).
4. Next morning: Settings → Data → the 02:00 backup says "local + Stratus".

## 8. Deploys from GitHub
1. `catalyst token:generate` → GitHub secret **`ZC_DEPLOY_TOKEN`**.
2. Repository variable **`CATALYST_APP_URL`** (same as `PUBLIC_ORIGIN`); optional `CATALYST_SERVICE`.
3. Settings → Environments → **catalyst** → add yourself as required reviewer (a deploy then waits for you).
4. Actions → **catalyst** → Run workflow. When that works, add `push: branches: [main]` to
   `catalyst.yml` and remove it from `deploy.yml`.

## Costs and limits
- Free trial: **$250 credit for 180 days**. AppSail at 512 MB always on is about **$29 a month**
  ($0.08 per GB-hour); Stratus and the rest are cents. After the credit, Catalyst bills monthly
  ($5 minimum per project above the free tier). Set a billing alert in the Console.
- Turso's free plan covers this app's size; check its current limits and backup retention.

## Backups and restore
- **Turso** keeps its own history (point-in-time restore depends on your plan: `turso db create
  <new> --from-db tatakae --timestamp <time>`).
- **Stratus** keeps 30 nightly JSON exports (`backups/<date>.json`, auto-deleted after 30 days) and every
  uploaded file.
- There is no "import a JSON export" tool yet; restoring from JSON would be a small script. The Turso
  restore is the real path.
