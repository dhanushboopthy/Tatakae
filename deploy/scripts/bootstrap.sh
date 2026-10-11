#!/usr/bin/env bash
# Run once on a fresh VM (if not using cloud-init). Idempotent.
set -euo pipefail
# TODO(phase0):
# 1. Docker Engine + compose plugin
# 2. iptables: Oracle Ubuntu images REJECT everything but 22 by default →
#    insert ACCEPT for 80/443 before the REJECT rule, persist with netfilter-persistent
# 3. ufw + fail2ban + unattended-upgrades
# 4. Tailscale (SSH over tailnet; then close public 22 in the OCI security list)
# 5. /srv/tatakae/data owned by uid 1000
echo "TODO"
