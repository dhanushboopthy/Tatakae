#!/usr/bin/env bash
# Only for a duckdns.org name. Oracle reserved public IPs are static, so run once (or daily via cron as a safety net).
set -euo pipefail
source /opt/tatakae/.env
curl -fsS "https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=" && echo
