#!/usr/bin/env bash
# Run the website + API locally in Docker (deploy/docker-compose.local.yml).
# Uses TATAKAE_PORT if set, else the first free host port from 8080 upward. Extra args go to
# `docker compose up` (e.g. scripts/local-up.sh --force-recreate).
#   Stop:  docker compose -f deploy/docker-compose.local.yml down      (add -v to wipe the data)
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f deploy/docker-compose.local.yml)

port_in_use() {
  # Host listeners (ss) plus ports other containers have published.
  ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$" && return 0
  docker ps --format '{{.Ports}}' | grep -Eq "(^|[ :])$1->" && return 0
  return 1
}

# Re-use the port of an already running tatakae-local web container.
running=$(docker ps --filter "label=com.docker.compose.project=tatakae-local" --filter "label=com.docker.compose.service=web" \
  --format '{{.Ports}}' | sed -nE 's/.*127\.0\.0\.1:([0-9]+)->80.*/\1/p' | head -n1)

if [[ -n "${TATAKAE_PORT:-}" ]]; then
  port=$TATAKAE_PORT
elif [[ -n "$running" ]]; then
  port=$running
else
  port=8080
  while port_in_use "$port"; do
    port=$((port + 1))
    if ((port > 8180)); then echo "No free port between 8080 and 8180." >&2; exit 1; fi
  done
fi

echo "Starting tatakae-local on port $port…"
TATAKAE_PORT=$port "${COMPOSE[@]}" up -d --build "$@"
echo
echo "Tatakae is up: http://localhost:$port"
echo "Logs:  docker compose -f deploy/docker-compose.local.yml logs -f"
echo "Stop:  docker compose -f deploy/docker-compose.local.yml down"
