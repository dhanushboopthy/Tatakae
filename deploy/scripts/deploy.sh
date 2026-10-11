#!/usr/bin/env bash
# Deploys image tag <tag> (a git SHA, or "latest") on the VM. Called by .github/workflows/deploy.yml over
# Tailscale SSH; also fine by hand:  /opt/tatakae/scripts/deploy.sh <tag>
#
#   1. snapshot the database with sqlite3 .backup → /srv/tatakae/data/backups/pre-deploy-<ts>.db (last 10 kept)
#   2. docker compose pull + up -d with TAG=<tag>
#   3. health check for up to HEALTH_TIMEOUT s: api /api/health from inside its container, Caddy answering on :80
#   4. success → record the tag in .last_tag (previous one in .prev_tag) and prune old images
#      failure → roll back to the previous tag and exit 1 (the DB snapshot is NOT restored automatically;
#                if a migration broke it: scripts/restore.sh --from-file <snapshot>)
#
# Images are pulled from GHCR anonymously, so the packages must be public. For private packages, run
# `docker login ghcr.io` once on the VM as this user (see docs/MANUAL-STEPS.md).
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/tatakae}
DATA_DIR=${DATA_DIR:-/srv/tatakae/data}
DB=${DATA_DIR}/tatakae.db
BACKUP_DIR=${DATA_DIR}/backups
KEEP_SNAPSHOTS=${KEEP_SNAPSHOTS:-10}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-60}
APP_UID=1000

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die() {
  log "ERROR: $*"
  exit 1
}

# Run a command as the owner of the data files (uid 1000 = `node` in the api image).
as_app() {
  if [[ $(id -u) -eq ${APP_UID} ]]; then
    "$@"
  else
    sudo -n -u "#${APP_UID}" -g "#${APP_UID}" "$@"
  fi
}

NEW_TAG=${1:-}
[[ -n ${NEW_TAG} ]] || die "usage: deploy.sh <image-tag>"
[[ ${NEW_TAG} =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || die "invalid tag: ${NEW_TAG}"

cd "${APP_DIR}"
[[ -f .env ]] || die "${APP_DIR}/.env is missing (see docs/MANUAL-STEPS.md)"
[[ -f docker-compose.yml ]] || die "${APP_DIR}/docker-compose.yml is missing"

# One deploy at a time.
exec 9>"${APP_DIR}/.deploy.lock"
flock -w 300 9 || die "another deploy is still running"

env_value() { # reads KEY from .env without sourcing it (values may contain $)
  sed -n "s/^$1=//p" .env | tail -n1 | sed -e "s/[[:space:]]#.*$//" -e "s/^['\"]//" -e "s/['\"]$//"
}
DOMAIN=$(env_value DOMAIN)

# Previous tag: what the last successful deploy recorded, else whatever the api container runs now.
PREV_TAG=""
if [[ -s .last_tag ]]; then
  PREV_TAG=$(<.last_tag)
elif api_id=$(docker compose ps -q api 2>/dev/null) && [[ -n ${api_id} ]]; then
  image=$(docker inspect -f '{{.Config.Image}}' "${api_id}" 2>/dev/null || true)
  PREV_TAG=${image##*:}
fi
log "deploying ${NEW_TAG} (previous: ${PREV_TAG:-none})"

# --- 1. snapshot --------------------------------------------------------------------------------------
if [[ -f ${DB} ]]; then
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  snapshot=${BACKUP_DIR}/pre-deploy-${ts}.db
  as_app mkdir -p "${BACKUP_DIR}"
  as_app sqlite3 -cmd ".timeout 10000" "${DB}" ".backup '${snapshot}'"
  log "snapshot ${snapshot} ($(du -h "${snapshot}" | cut -f1))"
  # keep the newest KEEP_SNAPSHOTS
  mapfile -t old < <(ls -1t "${BACKUP_DIR}"/pre-deploy-*.db 2>/dev/null | tail -n +"$((KEEP_SNAPSHOTS + 1))")
  if [[ ${#old[@]} -gt 0 ]]; then
    as_app rm -f -- "${old[@]}"
  fi
else
  log "no database yet (first deploy); skipping snapshot"
fi

# --- 2. pull + up -------------------------------------------------------------------------------------
export TAG=${NEW_TAG}
if ! docker compose pull --quiet; then
  die "pull failed for tag ${NEW_TAG}; nothing changed. Private GHCR packages? Make them public or 'docker login ghcr.io'."
fi

healthy() {
  local api_id status
  api_id=$(docker compose ps -q api 2>/dev/null) || return 1
  [[ -n ${api_id} ]] || return 1
  status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "${api_id}" 2>/dev/null) || return 1
  [[ ${status} == "healthy" ]] || return 1
  # The api answers from inside its own container …
  docker compose exec -T api node -e \
    "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1 || return 1
  # … and Caddy is up (port 80 answers, normally with a redirect to HTTPS).
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "Host: ${DOMAIN}" http://127.0.0.1/api/health || true)
  [[ ${code} =~ ^[23] ]] || return 1
}

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while [[ ${SECONDS} -lt ${deadline} ]]; do
    healthy && return 0
    sleep 3
  done
  return 1
}

up_ok=1
docker compose up -d --remove-orphans || up_ok=0

if [[ ${up_ok} -eq 1 ]] && wait_healthy; then
  if [[ -n ${PREV_TAG} && ${PREV_TAG} != "${NEW_TAG}" ]]; then
    printf '%s\n' "${PREV_TAG}" >.prev_tag
  fi
  printf '%s\n' "${NEW_TAG}" >.last_tag
  # Unused images older than 10 days; rollback images can always be pulled again from GHCR.
  docker image prune -af --filter "until=240h" >/dev/null || true
  log "healthy on ${NEW_TAG}"
  exit 0
fi

# --- rollback -----------------------------------------------------------------------------------------
log "unhealthy after ${HEALTH_TIMEOUT}s on ${NEW_TAG}; recent api logs:"
docker compose logs --tail 80 api >&2 || true
if [[ -z ${PREV_TAG} || ${PREV_TAG} == "${NEW_TAG}" ]]; then
  die "no previous tag to roll back to"
fi

log "rolling back to ${PREV_TAG}"
export TAG=${PREV_TAG}
if docker compose up -d --remove-orphans && wait_healthy; then
  log "rolled back to ${PREV_TAG} and healthy"
else
  log "rollback to ${PREV_TAG} is not healthy either"
fi
if [[ -n ${snapshot:-} ]]; then
  log "pre-deploy snapshot: ${snapshot} (restore with: ${APP_DIR}/scripts/restore.sh --from-file ${snapshot})"
fi
exit 1
