#!/usr/bin/env bash
# Prepares an Ubuntu 24.04 (arm64) Oracle Cloud VM for TATAKAE. Idempotent: safe to run again at any time.
#
# cloud-init runs this on first boot (as /usr/local/sbin/tatakae-bootstrap). On an existing VM:
#   sudo TAILSCALE_AUTH_KEY=tskey-auth-... ./bootstrap.sh       # key only needed if Tailscale is not up yet
#
# Steps
#   1. base packages
#   2. iptables: open 80/443 (+ Tailscale 41641/udp) before Oracle's REJECT rule, persist
#   3. Docker Engine + compose plugin (docker.com apt repo), log rotation, docker group
#   4. Tailscale (`tailscale up --ssh`)
#   5. ufw (deny incoming; 80,443/tcp, 443/udp, 41641/udp; everything on tailscale0), fail2ban, unattended-upgrades
#   6. /opt/tatakae for compose files, owned by the admin user
#   7. data volume: format if blank, mount at /srv/tatakae (fstab UUID + nofail), /srv/tatakae/data owned by 1000
#
# Settings (environment, or /etc/tatakae/bootstrap.env written by cloud-init; the environment wins):
#   TATAKAE_USER        admin login user                       (default: ubuntu)
#   TAILSCALE_AUTH_KEY  one-off auth key for `tailscale up`    (default: none → prints the manual command)
#   TAILSCALE_HOSTNAME  machine name on the tailnet            (default: tatakae)
#   DATA_DEVICE         block device for /srv/tatakae          (default: auto-detect the single non-boot disk)
#   VOLUME_WAIT_SECS    how long to wait for the volume        (default: 900; OCI attaches it after boot)
#   ALLOW_NO_VOLUME=1   use the boot disk if no volume appears (default: fail instead)
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

ENV_FILE=/etc/tatakae/bootstrap.env
if [[ -r ${ENV_FILE} ]]; then
  while IFS='=' read -r key value; do
    [[ ${key} =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    [[ -n ${!key:-} ]] && continue # explicit environment wins
    export "${key}=${value}"
  done <"${ENV_FILE}"
fi

TATAKAE_USER=${TATAKAE_USER:-ubuntu}
TAILSCALE_HOSTNAME=${TAILSCALE_HOSTNAME:-tatakae}
TAILSCALE_AUTH_KEY=${TAILSCALE_AUTH_KEY:-}
DATA_DEVICE=${DATA_DEVICE:-}
VOLUME_WAIT_SECS=${VOLUME_WAIT_SECS:-900}
ALLOW_NO_VOLUME=${ALLOW_NO_VOLUME:-0}

DATA_MOUNT=/srv/tatakae
DATA_DIR=${DATA_MOUNT}/data
APP_DIR=/opt/tatakae
APP_UID=1000 # the `node` user inside the api image
APP_GID=1000

export DEBIAN_FRONTEND=noninteractive
APT_OPTS=(-y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)

# Messages go to stderr so functions can print results on stdout.
log() { printf '[tatakae-bootstrap %s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
warn() { log "WARNING: $*"; }
die() {
  log "ERROR: $*"
  exit 1
}

# Writes stdin to a file only when the content differs. Returns 0 if the file changed.
write_if_changed() {
  local path=$1 mode=${2:-0644} tmp
  tmp=$(mktemp)
  cat >"${tmp}"
  if [[ -f ${path} ]] && cmp -s "${tmp}" "${path}"; then
    rm -f "${tmp}"
    return 1
  fi
  install -D -m "${mode}" "${tmp}" "${path}"
  rm -f "${tmp}"
  return 0
}

id -u "${TATAKAE_USER}" >/dev/null 2>&1 || die "user '${TATAKAE_USER}' does not exist (set TATAKAE_USER)"
# shellcheck source=/dev/null
. /etc/os-release
CODENAME=${UBUNTU_CODENAME:-${VERSION_CODENAME}}
ARCH=$(dpkg --print-architecture)

# ---------------------------------------------------------------------------------------------------------
# 1. Base packages
# ---------------------------------------------------------------------------------------------------------
step_packages() {
  log "1/7 base packages"
  apt-get update -q
  apt-get install "${APT_OPTS[@]}" ca-certificates curl gnupg jq sqlite3 e2fsprogs util-linux
}

# ---------------------------------------------------------------------------------------------------------
# 2. iptables. Oracle's Ubuntu images ship rules that REJECT everything except 22, persisted in
#    /etc/iptables/rules.v4. Insert ACCEPTs just before that REJECT and save. Saving only happens when a rule
#    was added (first run, before Docker exists), so Docker's own chains are never written into rules.v4.
# ---------------------------------------------------------------------------------------------------------
step_iptables() {
  log "2/7 iptables (Oracle image rules)"
  if ! command -v iptables >/dev/null; then
    warn "iptables not installed; skipping"
    return
  fi

  local changed=0 proto port pos
  for rule in tcp:80 tcp:443 udp:443 udp:41641; do
    proto=${rule%%:*}
    port=${rule##*:}
    if iptables -C INPUT -p "${proto}" -m conntrack --ctstate NEW -m "${proto}" --dport "${port}" -j ACCEPT 2>/dev/null; then
      continue
    fi
    pos=$(iptables -L INPUT -n --line-numbers | awk '$2 == "REJECT" { print $1; exit }')
    if [[ -z ${pos} ]]; then
      log "   no REJECT rule in INPUT; ${proto}/${port} needs no iptables change"
      continue
    fi
    iptables -I INPUT "${pos}" -p "${proto}" -m conntrack --ctstate NEW -m "${proto}" --dport "${port}" -j ACCEPT
    log "   opened ${proto}/${port} (before REJECT at position ${pos})"
    changed=1
  done

  if [[ ${changed} -eq 1 ]]; then
    if command -v netfilter-persistent >/dev/null; then
      netfilter-persistent save
      log "   saved with netfilter-persistent"
    else
      warn "netfilter-persistent not installed; the iptables change lasts until reboot (ufw covers it afterwards)"
    fi
  fi
}

# ---------------------------------------------------------------------------------------------------------
# 3. Docker Engine + compose plugin from docker.com
# ---------------------------------------------------------------------------------------------------------
step_docker() {
  log "3/7 docker"
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -s /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  local repo_changed=0
  if echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" |
    write_if_changed /etc/apt/sources.list.d/docker.list; then
    repo_changed=1
  fi
  if [[ ${repo_changed} -eq 1 ]] || ! dpkg -s docker-ce docker-compose-plugin >/dev/null 2>&1; then
    apt-get update -q
    apt-get install "${APT_OPTS[@]}" docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  # Rotate container logs so they cannot fill the boot disk.
  local daemon_changed=0
  if write_if_changed /etc/docker/daemon.json <<'JSON'; then
{
  "log-driver": "local",
  "log-opts": { "max-size": "20m", "max-file": "5" },
  "live-restore": true
}
JSON
    daemon_changed=1
  fi

  systemctl enable --now docker.service containerd.service
  if [[ ${daemon_changed} -eq 1 ]]; then
    systemctl restart docker.service
  fi

  if ! id -nG "${TATAKAE_USER}" | tr ' ' '\n' | grep -qx docker; then
    usermod -aG docker "${TATAKAE_USER}"
    log "   added ${TATAKAE_USER} to the docker group (takes effect on next login)"
  fi
  docker --version
  docker compose version
}

# ---------------------------------------------------------------------------------------------------------
# 4. Tailscale (SSH over the tailnet; public 22 gets closed in the OCI security list afterwards)
# ---------------------------------------------------------------------------------------------------------
tailscale_running() {
  command -v tailscale >/dev/null &&
    [[ $(tailscale status --json 2>/dev/null | jq -r '.BackendState // empty') == "Running" ]]
}

step_tailscale() {
  log "4/7 tailscale"
  local keyring=/usr/share/keyrings/tailscale-archive-keyring.gpg
  if [[ ! -s ${keyring} ]]; then
    curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/${CODENAME}.noarmor.gpg" -o "${keyring}"
  fi
  if [[ ! -s /etc/apt/sources.list.d/tailscale.list ]]; then
    curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/${CODENAME}.tailscale-keyring.list" \
      -o /etc/apt/sources.list.d/tailscale.list
    apt-get update -q
  fi
  dpkg -s tailscale >/dev/null 2>&1 || apt-get install "${APT_OPTS[@]}" tailscale
  systemctl enable --now tailscaled.service

  if tailscale_running; then
    log "   already connected as $(tailscale status --json | jq -r '.Self.DNSName')"
    tailscale set --ssh --auto-update >/dev/null 2>&1 || tailscale set --ssh
  elif [[ -n ${TAILSCALE_AUTH_KEY} ]]; then
    tailscale up --ssh --authkey="${TAILSCALE_AUTH_KEY}" --hostname="${TAILSCALE_HOSTNAME}"
    tailscale set --auto-update >/dev/null 2>&1 || warn "could not enable tailscale auto-update"
    log "   connected as $(tailscale status --json | jq -r '.Self.DNSName')"
  else
    warn "Tailscale is not connected and no TAILSCALE_AUTH_KEY was given."
    warn "Run: sudo tailscale up --ssh --hostname=${TAILSCALE_HOSTNAME}   (then open the printed login URL)"
  fi

  # The key is single-use; don't leave it lying around once we are connected.
  if tailscale_running && [[ -f ${ENV_FILE} ]] && grep -q '^TAILSCALE_AUTH_KEY=' "${ENV_FILE}"; then
    sed -i '/^TAILSCALE_AUTH_KEY=/d' "${ENV_FILE}"
  fi
}

# ---------------------------------------------------------------------------------------------------------
# 5. ufw, fail2ban, unattended-upgrades
#    Note: on Ubuntu, installing ufw may remove iptables-persistent/netfilter-persistent (they conflict).
#    That is fine: after a reboot ufw is the only firewall and allows the same ports. Docker-published ports
#    (80/443 on the web container) bypass ufw by design; nothing else is published.
# ---------------------------------------------------------------------------------------------------------
step_firewall_and_hardening() {
  log "5/7 ufw, fail2ban, unattended-upgrades"
  apt-get install "${APT_OPTS[@]}" ufw fail2ban unattended-upgrades

  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow 80/tcp comment 'http (caddy)' >/dev/null
  ufw allow 443/tcp comment 'https (caddy)' >/dev/null
  ufw allow 443/udp comment 'http3 (caddy)' >/dev/null
  ufw allow 41641/udp comment 'tailscale direct' >/dev/null
  ufw allow in on tailscale0 comment 'tailnet (ssh, admin)' >/dev/null
  # Keep public SSH reachable at the OS level until the tailnet works, so a failed `tailscale up`
  # never locks you out. The OCI security list still limits 22 to admin_cidr.
  if tailscale_running; then
    ufw delete allow 22/tcp >/dev/null 2>&1 || true
  else
    ufw allow 22/tcp comment 'ssh until tailscale is up' >/dev/null
    warn "public 22/tcp left open in ufw until Tailscale is connected; re-run this script afterwards"
  fi
  ufw --force enable >/dev/null
  ufw status verbose

  write_if_changed /etc/fail2ban/jail.d/tatakae.local <<'INI' || true
[DEFAULT]
# Never ban tailnet addresses.
ignoreip = 127.0.0.1/8 ::1 100.64.0.0/10

[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
INI
  systemctl enable fail2ban.service >/dev/null
  systemctl restart fail2ban.service

  write_if_changed /etc/apt/apt.conf.d/20auto-upgrades <<'APT' || true
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT
  # Security updates daily; reboot for kernel updates at 21:30 UTC = 03:00 IST (between the 02:00 IST backup
  # and the 04:00 IST day boundary). Containers come back by themselves (restart: unless-stopped).
  write_if_changed /etc/apt/apt.conf.d/52tatakae-unattended-upgrades <<'APT' || true
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "21:30";
APT
  systemctl enable --now unattended-upgrades.service >/dev/null
}

# ---------------------------------------------------------------------------------------------------------
# 6. /opt/tatakae: docker-compose.yml, litestream.yml, scripts/ and .env (copied by the deploy workflow)
# ---------------------------------------------------------------------------------------------------------
step_app_dir() {
  log "6/7 ${APP_DIR}"
  install -d -m 0750 -o "${TATAKAE_USER}" -g "${TATAKAE_USER}" "${APP_DIR}"
  install -d -m 0750 -o "${TATAKAE_USER}" -g "${TATAKAE_USER}" "${APP_DIR}/scripts"
  if [[ -f ${APP_DIR}/.env ]]; then
    chown "${TATAKAE_USER}:${TATAKAE_USER}" "${APP_DIR}/.env"
    chmod 600 "${APP_DIR}/.env"
  fi
}

# ---------------------------------------------------------------------------------------------------------
# 7. Data volume at /srv/tatakae
# ---------------------------------------------------------------------------------------------------------
boot_disk() {
  local src
  src=$(findmnt -nvo SOURCE /)
  lsblk -ndo PKNAME "${src}" 2>/dev/null | head -n1 | grep . || basename "${src}"
}

# Prints whole disks that are not the boot disk, not read-only and have nothing mounted on them.
candidate_disks() {
  local boot name type ro
  boot=$(boot_disk)
  while read -r name type ro; do
    [[ ${type} == "disk" && ${ro} == "0" ]] || continue
    [[ $(basename "${name}") == "${boot}" ]] && continue
    [[ $(basename "${name}") == zram* ]] && continue
    lsblk -nro MOUNTPOINT "${name}" | grep -q . && continue
    printf '%s\n' "${name}"
  done < <(lsblk -dnpo NAME,TYPE,RO -e 1,7,11) # skip ram, loop, sr
}

# Prints the data device. Returns 1 if none appeared in time, 2 if the choice is unsafe/ambiguous.
find_data_device() {
  if [[ -n ${DATA_DEVICE} ]]; then
    if [[ ! -b ${DATA_DEVICE} ]]; then
      log "ERROR: DATA_DEVICE=${DATA_DEVICE} is not a block device"
      return 2
    fi
    printf '%s\n' "${DATA_DEVICE}"
    return 0
  fi
  local waited=0 disks=()
  while :; do
    mapfile -t disks < <(candidate_disks)
    if [[ ${#disks[@]} -eq 1 ]]; then
      printf '%s\n' "${disks[0]}"
      return 0
    fi
    if [[ ${#disks[@]} -gt 1 ]]; then
      log "ERROR: several candidate disks (${disks[*]}); set DATA_DEVICE explicitly"
      return 2
    fi
    if [[ ${waited} -ge ${VOLUME_WAIT_SECS} ]]; then
      return 1
    fi
    if [[ $((waited % 60)) -eq 0 ]]; then
      log "   waiting for the block volume to attach (${waited}s)"
    fi
    sleep 10
    waited=$((waited + 10))
  done
}

step_data_volume() {
  log "7/7 data volume → ${DATA_MOUNT}"
  if mountpoint -q "${DATA_MOUNT}"; then
    log "   already mounted ($(findmnt -nvo SOURCE "${DATA_MOUNT}"))"
  else
    if [[ -d ${DATA_MOUNT} ]] && [[ -n $(ls -A "${DATA_MOUNT}") ]]; then
      die "${DATA_MOUNT} exists on the boot disk and is not empty; refusing to mount over it"
    fi

    local dev rc=0
    dev=$(find_data_device) || rc=$?
    if [[ ${rc} -eq 2 ]]; then
      die "cannot pick the data volume safely (see above)"
    elif [[ ${rc} -ne 0 ]]; then
      if [[ ${ALLOW_NO_VOLUME} == "1" ]]; then
        warn "no data volume found; using the boot disk for ${DATA_MOUNT} (ALLOW_NO_VOLUME=1)"
        dev=""
      else
        die "no data volume appeared within ${VOLUME_WAIT_SECS}s. Check the attachment in OCI, then re-run (or ALLOW_NO_VOLUME=1)"
      fi
    fi

    if [[ -n ${dev} ]]; then
      local fstype pttype uuid
      fstype=$(blkid -p -o value -s TYPE "${dev}" 2>/dev/null || true)
      pttype=$(blkid -p -o value -s PTTYPE "${dev}" 2>/dev/null || true)
      if [[ -n ${pttype} ]]; then
        die "${dev} has a partition table (${pttype}); not touching it. Mount it by hand or set DATA_DEVICE"
      fi
      if [[ -z ${fstype} ]]; then
        log "   ${dev} is blank → mkfs.ext4"
        mkfs.ext4 -q -L tatakae-data -m 1 "${dev}"
        fstype=ext4
      else
        log "   ${dev} already has ${fstype}; keeping its data"
      fi
      uuid=$(blkid -s UUID -o value "${dev}")
      [[ -n ${uuid} ]] || die "could not read the UUID of ${dev}"

      install -d -m 0755 "${DATA_MOUNT}"
      if ! grep -qE "^[^#]*[[:space:]]${DATA_MOUNT}[[:space:]]" /etc/fstab; then
        printf 'UUID=%s %s %s defaults,nofail,noatime,x-systemd.device-timeout=30s 0 2\n' \
          "${uuid}" "${DATA_MOUNT}" "${fstype}" >>/etc/fstab
        log "   added to /etc/fstab (UUID=${uuid}, nofail)"
      fi
      systemctl daemon-reload
      mount "${DATA_MOUNT}"
    fi
  fi

  # Docker must not start without the volume: otherwise the api would create an empty database on the
  # boot disk and Litestream would happily replicate it.
  if mountpoint -q "${DATA_MOUNT}"; then
    if write_if_changed /etc/systemd/system/docker.service.d/10-tatakae-data.conf <<UNIT; then
[Unit]
RequiresMountsFor=${DATA_MOUNT}
UNIT
      systemctl daemon-reload
    fi
  fi

  install -d -m 0750 -o "${APP_UID}" -g "${APP_GID}" "${DATA_DIR}"
  install -d -m 0750 -o "${APP_UID}" -g "${APP_GID}" "${DATA_DIR}/files"
  install -d -m 0750 -o "${APP_UID}" -g "${APP_GID}" "${DATA_DIR}/backups"
  df -h "${DATA_MOUNT}"
}

main() {
  log "starting (user=${TATAKAE_USER}, ubuntu=${CODENAME}, arch=${ARCH})"
  step_packages
  step_iptables
  step_docker
  step_tailscale
  step_firewall_and_hardening
  step_app_dir
  step_data_volume
  log "done. Next: copy /opt/tatakae/.env, then deploy (see docs/MANUAL-STEPS.md)"
}

main "$@"
