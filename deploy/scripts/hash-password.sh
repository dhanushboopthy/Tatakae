#!/usr/bin/env bash
# Prints an argon2id hash for OWNER_PASSWORD_HASH as a ready-to-paste .env line.
#
#   deploy/scripts/hash-password.sh                    prompts twice, nothing echoed (recommended)
#   printf '%s' 'secret' | deploy/scripts/hash-password.sh -    password from stdin
#   deploy/scripts/hash-password.sh 'secret'           works, but the password lands in your shell history
#   add --raw to print only the hash
#
# Runs anywhere:
#   - in this repo after `pnpm install`: uses apps/api's own @node-rs/argon2 with your local node (fast, offline)
#   - otherwise (e.g. on the VM): Docker, node:22-bookworm-slim, installs @node-rs/argon2 in a throwaway container
# Same library and parameters as the API: argon2id, m=19456 KiB, t=2, p=1. The password goes over stdin,
# never on a command line.
set -euo pipefail

die() {
  printf 'hash-password: %s\n' "$*" >&2
  exit 1
}

RAW=0
ARGS=()
for a in "$@"; do
  case ${a} in
    --raw) RAW=1 ;;
    -h | --help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) ARGS+=("${a}") ;;
  esac
done

PASSWORD=""
if [[ ${#ARGS[@]} -gt 0 && ${ARGS[0]} != "-" ]]; then
  PASSWORD=${ARGS[0]}
elif [[ ${#ARGS[@]} -gt 0 || ! -t 0 ]]; then
  IFS= read -r PASSWORD || true
else
  IFS= read -rsp 'Password: ' PASSWORD
  echo >&2
  IFS= read -rsp 'Again:    ' again
  echo >&2
  [[ ${PASSWORD} == "${again}" ]] || die "passwords do not match"
fi
[[ -n ${PASSWORD} ]] || die "empty password"
[[ ${#PASSWORD} -ge 12 ]] || printf 'hash-password: warning: fewer than 12 characters\n' >&2

# Reads the password from stdin, prints the PHC string. ARGON2_FROM = a package.json that can resolve the lib.
read -r -d '' JS <<'NODE' || true
const { createRequire } = require("node:module");
const { hash } = createRequire(process.env.ARGON2_FROM)("@node-rs/argon2");
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  const password = input.replace(/\r?\n$/, "");
  if (!password) { console.error("empty password"); process.exit(2); }
  // algorithm 2 = Argon2id
  const out = await hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.stdout.write(out + "\n");
});
NODE

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
API_DIR=$(cd "${SCRIPT_DIR}/../.." 2>/dev/null && pwd)/apps/api

if command -v node >/dev/null && [[ -e ${API_DIR}/node_modules/@node-rs/argon2 ]]; then
  HASH=$(printf '%s' "${PASSWORD}" | ARGON2_FROM="${API_DIR}/package.json" node -e "${JS}")
elif command -v docker >/dev/null; then
  printf 'hash-password: using Docker (node:22-bookworm-slim), first run downloads the image…\n' >&2
  HASH=$(printf '%s' "${PASSWORD}" | docker run --rm -i -e ARGON2_FROM=/work/package.json node:22-bookworm-slim sh -c '
    set -e
    mkdir -p /work && cd /work
    npm init -y >/dev/null
    npm install --silent --no-audit --no-fund --no-progress @node-rs/argon2@2 </dev/null >/dev/null 2>&1
    exec node -e "$0"' "${JS}")
else
  die "need either node + 'pnpm install' in this repo, or Docker"
fi

[[ ${HASH} == '$argon2id$'* ]] || die "unexpected output: ${HASH}"
if [[ ${RAW} -eq 1 ]]; then
  printf '%s\n' "${HASH}"
else
  # Single quotes matter: Docker Compose would otherwise try to expand the $ signs in the hash.
  printf "OWNER_PASSWORD_HASH='%s'\n" "${HASH}"
fi
