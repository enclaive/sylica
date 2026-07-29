#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM="${1:?usage: build.sh <platform> (see platforms/)}"
PLATFORM_CONF="$REPO_ROOT/platforms/$PLATFORM.json"
[ -f "$PLATFORM_CONF" ] || { echo "unknown platform: $PLATFORM" >&2; exit 1; }

# Local development build: sets up the repository and runs reproduce/build.sh
# directly on the host. Requires the toolchain from reproduce/Dockerfile
# (build-essential, git, nasm, acpica-tools, uuid-dev, python3) and initializes
# all required git submodules for this repository and EDK2

for tool in gcc make nasm iasl python3; do
    command -v "$tool" >/dev/null || { echo "missing tool: $tool (see reproduce/Dockerfile)" >&2; exit 1; }
done

cd "$REPO_ROOT"

git submodule update --init --depth 1
git -C edk2 submodule update --init --depth 1

exec reproduce/build.sh "$PLATFORM"
