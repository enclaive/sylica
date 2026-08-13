#!/usr/bin/bash

set -euo pipefail

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"

mkdir -p "$SCRIPT_DIR/static"
cd "$SCRIPT_DIR/static"

install_deps() {
  pushd . >/dev/null

  local depth="$1" && shift

  for x in $(seq 1 "$depth");do
    cd "npm/$1" && shift || exit 1
  done

  for dep in "$@";do
    mkdir -p "npm/$dep"
    t="npm/$dep/index.js"

    [[ -f "$t" ]] && continue
    wget -nv "https://cdn.jsdelivr.net/npm/$dep/+esm" -O "$t"

    tail -n1 "$t" | grep '^//# sourceMappingURL=' >/dev/null && sed -i '$d' "$t"

    grep -Eo '"/npm/[^"]+/\+esm"' "$t" >/dev/null && sed -Ei 's|"/(npm/[^"]+)/\+esm"|"./\1/index.js"|g' "$t"
  done

  popd >/dev/null
}

install_deps 0 pkijs@3.4.0
install_deps 1 pkijs@3.4.0 asn1js@3.0.7 bytestreamjs@2.0.1 pvutils@1.1.5 pvtsutils@1.3.6 @noble/hashes@1.4.0/sha1 @noble/hashes@1.4.0/sha2
install_deps 2 pkijs@3.4.0 asn1js@3.0.7 pvutils@1.1.5 pvtsutils@1.3.6
install_deps 2 pkijs@3.4.0 @noble/hashes@1.4.0/sha1 @noble/hashes@1.4.0/crypto
install_deps 2 pkijs@3.4.0 @noble/hashes@1.4.0/sha2 @noble/hashes@1.4.0/crypto
