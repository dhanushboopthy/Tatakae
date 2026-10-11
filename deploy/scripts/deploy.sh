#!/usr/bin/env bash
# Called by GitHub Actions over Tailscale SSH: pull new images and restart.
set -euo pipefail
cd /opt/tatakae
export TAG="${1:-latest}"
# TODO(phase0): sqlite3 .backup snapshot before migrate, then:
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f
# TODO(phase0): curl -fsS https://$DOMAIN/api/health or roll back to previous TAG
