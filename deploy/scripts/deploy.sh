#!/usr/bin/env bash
# Deploy the latest code on the server. Run it ON the server, as the `tatakae` user (never root):
#
#   ssh tatakae@duolink 'cd ~/TATAKAE && deploy/scripts/deploy.sh'
#   deploy/scripts/deploy.sh [git-ref]      default: origin/main
#
# What it does: fetch → fast-forward to the ref → pnpm install (frozen lockfile) → build web and API →
# snapshot the database → restart the API → wait for /api/health. If the health check fails it goes back
# to the previous commit, rebuilds and restarts, then exits 1. The website needs no restart: nginx reads
# apps/web/dist directly. Database migrations run when the API starts.
#
# Env overrides: HEALTH_URL (default http://127.0.0.1:8791/api/health), SERVICE (default tatakae-api),
# DATA_DIR (default ~/tatakae-data), KEEP_SNAPSHOTS (default 5).
set -euo pipefail

die() {
  printf 'deploy: %s\n' "$*" >&2
  exit 1
}
step() { printf '\n==> %s\n' "$*"; }

[[ $(id -u) -ne 0 ]] || die "run as the tatakae user, not root"
export PATH="${HOME}/.local/bin:${PATH}"
command -v pnpm >/dev/null || die "pnpm not found (corepack enable --install-directory ~/.local/bin)"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REF="${1:-origin/main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8791/api/health}"
SERVICE="${SERVICE:-tatakae-api}"
DATA_DIR="${DATA_DIR:-${HOME}/tatakae-data}"
KEEP_SNAPSHOTS="${KEEP_SNAPSHOTS:-5}"
cd "${REPO}"

build() {
  pnpm install --frozen-lockfile
  pnpm --filter web build
  pnpm --filter api build
}

wait_healthy() {
  local i
  for i in $(seq 1 20); do
    if curl -fsS --max-time 3 "${HEALTH_URL}" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

# Copy of the database before the new code touches it (a migration can run on start). Uses SQLite's own
# backup API, so it is consistent even while the API is writing.
snapshot_db() {
  local db="${DATA_DIR}/tatakae.db" dir="${DATA_DIR}/backups"
  [[ -f ${db} ]] || { echo "no database yet, skipping snapshot"; return 0; }
  mkdir -p "${dir}"
  local out="${dir}/pre-deploy-$(date +%Y%m%d-%H%M%S).db"
  (cd "${REPO}/apps/api" && node -e '
    const Database = require("better-sqlite3");
    const [src, dest] = process.argv.slice(1);
    const db = new Database(src, { readonly: true });
    db.backup(dest).then(() => { db.close(); console.log("snapshot " + dest); })
      .catch((e) => { console.error(e); process.exit(1); });
  ' "${db}" "${out}")
  # keep only the newest N pre-deploy snapshots
  ls -1t "${dir}"/pre-deploy-*.db 2>/dev/null | tail -n +"$((KEEP_SNAPSHOTS + 1))" | xargs -r rm -f --
}

step "Fetching"
git fetch --prune origin
PREV="$(git rev-parse HEAD)"
TARGET="$(git rev-parse --verify "${REF}^{commit}")" || die "unknown ref: ${REF}"
if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
  die "the working tree has local changes; commit or discard them first"
fi
if git merge-base --is-ancestor "${TARGET}" "${PREV}" && [[ ${TARGET} != "${PREV}" ]]; then
  die "${REF} is behind the checked-out commit; refusing to go backwards (deploy a ref explicitly after checkout)"
fi

step "Updating ${PREV:0:7} → ${TARGET:0:7}"
git merge --ff-only "${TARGET}"

step "Building"
build

step "Snapshotting the database"
snapshot_db

step "Restarting ${SERVICE}"
systemctl --user restart "${SERVICE}"
if wait_healthy; then
  step "Healthy at ${HEALTH_URL}"
  git log --oneline -3
  exit 0
fi

printf '\ndeploy: health check failed, rolling back to %s\n' "${PREV:0:7}" >&2
journalctl --user -u "${SERVICE}" -n 20 --no-pager >&2 || true
git reset --hard "${PREV}"
build
systemctl --user restart "${SERVICE}"
if wait_healthy; then
  die "rolled back to ${PREV:0:7} and it is healthy again; fix the new version before deploying it"
fi
die "rollback also failed to start: check 'journalctl --user -u ${SERVICE}'"
