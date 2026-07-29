#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM="${1:?usage: measure.sh <platform> [firmware] (see platforms/)}"
PLATFORM_CONF="$REPO_ROOT/platforms/$PLATFORM.json"
[ -f "$PLATFORM_CONF" ] || { echo "unknown platform: $PLATFORM" >&2; exit 1; }

# Measure an existing firmware based on a platform description.
# Requires sev-snp-measure and does not yet support TDX.

source "$REPO_ROOT/scripts/util.sh"

FIRMWARE="${2:-$REPO_ROOT/out/$PLATFORM/$(sylica filename)}"
[ -f "$FIRMWARE" ] || { echo "missing firmware: $FIRMWARE (run scripts/build.sh first)" >&2; exit 1; }

mkdir -p "$REPO_ROOT/out/$PLATFORM"

"$REPO_ROOT/verify/file.sh" "${FIRMWARE}" "$(sylica measure)" | \
  tee "$REPO_ROOT/out/$PLATFORM/measurements.json"