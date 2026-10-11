#!/usr/bin/env bash
# Disaster recovery: new VM → restore latest DB from Object Storage via Litestream.
set -euo pipefail
# TODO(v4): docker compose stop api litestream
#           docker run --rm -v /srv/tatakae/data:/data --env-file .env litestream/litestream:0.3 restore -o /data/tatakae.db -config /etc/litestream.yml /data/tatakae.db
#           docker compose up -d
# Rehearse this once in v4 (gate item).
echo "TODO"
