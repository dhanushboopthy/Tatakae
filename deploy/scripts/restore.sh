#!/usr/bin/env bash
# Disaster recovery: put a database back at /srv/tatakae/data/tatakae.db and restart the stack.
#
# Run on the VM as the admin user (ubuntu), from anywhere:
#   /opt/tatakae/scripts/restore.sh                                   latest state from Object Storage (Litestream)
#   /opt/tatakae/scripts/restore.sh --timestamp 2026-11-02T18:30:00Z  point in time (UTC, RFC 3339)
#   /opt/tatakae/scripts/restore.sh --from-file /srv/tatakae/data/backups/pre-deploy-20261102T183000Z.db
#   add --no-start to leave api + litestream stopped afterwards (e.g. to inspect the file first)
#
# The current database (if any) is moved to /srv/tatakae/data/pre-restore-<timestamp>/, never deleted.
# Needs: /opt/tatakae/{.env,docker-compose.yml,litestream.yml}, Docker, sqlite3, passwordless sudo (cloud default).
# Full runbook (new VM): terraform apply → cloud-init → copy .env → deploy once → restore.sh → /api/health.
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/tatakae}
DATA_DIR=${DATA_DIR:-/srv/tatakae/data}
DB_NAME=tatakae.db
DB=${DATA_DIR}/${DB_NAME}
APP_UID=1000
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-90}

log() { printf '[restore %s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die() {
  log "ERROR: $*"
  exit 1
}
usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

# Run a command as the owner of the data files (uid 1000 = `node` in the api image).
as_app() {
  if [[ $(id -u) -eq ${APP_UID} ]]; then
    "$@"
  else
    sudo -n -u "#${APP_UID}" -g "#${APP_UID}" "$@"
  fi
}

TIMESTAMP=""
FROM_FILE=""
START=1
while [[ $# -gt 0 ]]; do
  case $1 in
    --timestamp) TIMESTAMP=${2:?--timestamp needs a value}; shift 2 ;;
    --from-file) FROM_FILE=${2:?--from-file needs a path}; shift 2 ;;
    --no-start) START=0; shift ;;
    -h | --help) usage 0 ;;
    *) log "unknown argument: $1"; usage 1 ;;
  esac
done
[[ -n ${TIMESTAMP} && -n ${FROM_FILE} ]] && die "use either --timestamp or --from-file, not both"

cd "${APP_DIR}"
for f in .env docker-compose.yml litestream.yml; do
  [[ -f ${f} ]] || die "${APP_DIR}/${f} is missing"
done
command -v sqlite3 >/dev/null || die "sqlite3 is not installed (sudo apt-get install -y sqlite3)"
mountpoint -q /srv/tatakae || log "WARNING: /srv/tatakae is not a mount point; restoring onto the boot disk"

# Keep the image version that was last deployed successfully.
if [[ -s ${APP_DIR}/.last_tag ]]; then
  TAG=$(<"${APP_DIR}/.last_tag")
  export TAG
fi

if [[ -n ${FROM_FILE} ]]; then
  [[ -f ${FROM_FILE} ]] || die "${FROM_FILE} not found"
  log "checking ${FROM_FILE}"
  [[ $(as_app sqlite3 -readonly "${FROM_FILE}" 'PRAGMA integrity_check;') == "ok" ]] ||
    die "${FROM_FILE} fails PRAGMA integrity_check"
fi

log "stopping api and litestream"
docker compose stop api litestream

TS=$(date -u +%Y%m%dT%H%M%SZ)
ASIDE=${DATA_DIR}/pre-restore-${TS}
moved=0
for f in "${DB}" "${DB}-wal" "${DB}-shm" "${DATA_DIR}/.${DB_NAME}-litestream"; do
  if [[ -e ${f} ]]; then
    as_app mkdir -p "${ASIDE}"
    as_app mv "${f}" "${ASIDE}/"
    moved=1
  fi
done
[[ ${moved} -eq 1 ]] && log "moved the current database to ${ASIDE}"

if [[ -n ${FROM_FILE} ]]; then
  log "copying ${FROM_FILE} → ${DB}"
  as_app cp "${FROM_FILE}" "${DB}"
  as_app chmod 0640 "${DB}"
else
  args=(restore -config /etc/litestream.yml -o "/data/${DB_NAME}")
  [[ -n ${TIMESTAMP} ]] && args+=(-timestamp "${TIMESTAMP}")
  args+=("/data/${DB_NAME}")
  log "litestream ${args[*]}"
  if ! docker compose run --rm --no-deps -T litestream "${args[@]}"; then
    die "litestream restore failed. The previous database (if any) is in ${ASIDE}; move it back to retry the old state."
  fi
fi

log "integrity check"
result=$(as_app sqlite3 "${DB}" 'PRAGMA integrity_check;')
[[ ${result} == "ok" ]] || die "restored database fails integrity_check: ${result}"
log "tables: $(as_app sqlite3 "${DB}" "SELECT count(*) FROM sqlite_master WHERE type = 'table';")"

if [[ ${START} -eq 0 ]]; then
  log "done; services left stopped (--no-start). Start with: cd ${APP_DIR} && docker compose up -d"
  exit 0
fi

log "starting the stack"
docker compose up -d

api_id=$(docker compose ps -q api)
deadline=$((SECONDS + HEALTH_TIMEOUT))
until [[ $(docker inspect -f '{{.State.Health.Status}}' "${api_id}" 2>/dev/null) == "healthy" ]]; do
  if [[ ${SECONDS} -ge ${deadline} ]]; then
    docker compose logs --tail 50 api >&2 || true
    die "api not healthy after ${HEALTH_TIMEOUT}s"
  fi
  sleep 3
done
log "api healthy. Devices resync on their next open; check /api/health from outside and Settings → System."
