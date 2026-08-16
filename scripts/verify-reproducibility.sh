#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM="${1:?usage: verify-reproducibility.sh <platform> (see platforms/)}"
PLATFORM_CONF="$REPO_ROOT/platforms/$PLATFORM.json"
[ -f "$PLATFORM_CONF" ] || { echo "unknown platform: $PLATFORM" >&2; exit 1; }

# Build the firmware twice in full docker-build isolation and compare hashes.
# Second build bypasses the layer cache for the build stage only.

source "$REPO_ROOT/scripts/util.sh"

mkdir -p "$REPO_ROOT/out"

git submodule update --init --depth 1
git -C edk2 submodule update --init --depth 1

run_build() {
    rm -rf "$REPO_ROOT/out/verify-$1"
    docker build -f "$REPO_ROOT/reproduce/Dockerfile" \
        --target artifact \
        --build-arg PLATFORM="$PLATFORM" \
        --build-arg BUILD_ENV="${BUILD_ENV:-env}" \
        --no-cache-filter=build \
        -o "$REPO_ROOT/out/verify-$1" "$REPO_ROOT"
}

run_build 1
H1="$(sha256sum "$REPO_ROOT/out/verify-1/$PLATFORM/$(sylica filename)" | awk '{print $1}')"
echo "build 1: $H1"

if [[ "${SKIP_COMPARE:-}" == "true" ]]; then
    echo "Skipping second build"
    exit 0
fi

run_build 2
H2="$(sha256sum "$REPO_ROOT/out/verify-2/$PLATFORM/$(sylica filename)" | awk '{print $1}')"
echo "build 2: $H2"

if [ "$H1" != "$H2" ]; then
    echo "NOT REPRODUCIBLE" >&2
    exit 1
fi
echo "REPRODUCIBLE"
