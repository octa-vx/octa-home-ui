#!/usr/bin/env bash
# Runs a command inside the pinned toolchain image, e.g. tools/dev.sh pnpm check
# Node, pnpm and browsers stay off the host.
# Environment: OCTA_DEV_NETWORK (docker network, default bridge), OCTA_DEV_ARGS (extra docker args).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="mcr.microsoft.com/playwright:v1.56.1-noble"

# shellcheck disable=SC2086
exec docker run --rm --init --shm-size=1g \
  --user "$(id -u):$(id -g)" \
  --network "${OCTA_DEV_NETWORK:-bridge}" \
  -e HOME=/work/.cache/home \
  -e COREPACK_HOME=/work/.cache/corepack \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e PATH=/work/.cache/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  ${OCTA_DEV_ARGS:-} \
  -v "$ROOT:/work" -w /work \
  "$IMAGE" \
  sh -c 'mkdir -p "$HOME" /work/.cache/bin && corepack enable --install-directory /work/.cache/bin && exec "$@"' -- "$@"
