#!/bin/bash
# Reproducible build: pins from reproducible.env, SOURCE_DATE_EPOCH from the commit,
# image exporter forced to rewrite-timestamp=true.
set -uo pipefail
cd "$(dirname "$0")"

set -a
# shellcheck disable=SC1091
. ./reproducible.env
set +a
# Epoch 0 so rewrite-timestamp's clamp normalizes every file mtime.
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-0}"
echo "SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}"

# Strip group/world write so COPY layer modes don't depend on the umask of
# whoever ran git checkout.
[ -d .git ] && find . -path ./.git -prune -o -exec chmod go-w {} +

BAKE_SET=()
while IFS='=' read -r k v; do
  case "$k" in ''|\#*) continue;; esac
  BAKE_SET+=(--set "*.args.${k}=${v}")
done < <(grep -vE '^[[:space:]]*(#|$)' reproducible.env)
BAKE_SET+=(--set "*.args.SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}")

shopt -s expand_aliases
if ! which docker-compose > /dev/null 2>&1; then
    alias docker-compose='docker compose'
fi

if docker --help | grep -q buildx; then
  # Recreate super-builder if its BuildKit image doesn't match BUILDKIT_REF.
  if docker buildx inspect super-builder >/dev/null 2>&1; then
    CURRENT_BUILDKIT=$(docker buildx inspect super-builder \
      | sed -n 's/.*image="\([^"]*\)".*/\1/p' | head -1)
    if [ -n "${BUILDKIT_REF:-}" ] && [ "$CURRENT_BUILDKIT" != "${BUILDKIT_REF}" ]; then
      docker buildx rm super-builder
    fi
  fi
  docker buildx create --name super-builder --driver docker-container \
    --driver-opt "image=${BUILDKIT_REF}" 2>/dev/null || true
  # Always export with rewrite-timestamp; map --load/--push onto the exporter.
  OUTPUT="type=docker,rewrite-timestamp=true"
  ARGS=()
  for a in "$@"; do
    case "$a" in
      --load) ;;
      --push) OUTPUT="type=registry,rewrite-timestamp=true" ;;
      *) ARGS+=("$a") ;;
    esac
  done
  # ${ARGS[@]+...} guards the empty-array expansion under `set -u` on bash 3.2 (macOS).
  docker buildx bake --builder super-builder --file docker-compose.yml \
    "${BAKE_SET[@]}" --set "*.output=${OUTPUT}" ${ARGS[@]+"${ARGS[@]}"}
else
  # Fallback (no buildx): NOT bit-for-bit (docker exporter can't rewrite timestamps).
  export DOCKER_BUILDKIT=1
  export COMPOSE_DOCKER_CLI_BUILD=1
  docker-compose build "$@"
fi

ret=$?
if [ "$ret" -ne "0" ]; then
  echo "Tip: if the build failed to resolve domain names,"
  echo "consider running ./base/docker_nftables_setup.sh"
  echo "since iptables has been disabled for docker in the"
  echo "SPR installer"
  exit $ret
fi
