#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

source "$REPO_ROOT/test/lib.bash"
build_artifacts

exec bats "$REPO_ROOT/test/boot.bats" "$@"
