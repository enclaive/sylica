#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cp "$REPO_ROOT/SylicaOss/Patches/TdxLibNull.inf" MdePkg/Library/TdxLib/TdxLibNull.inf