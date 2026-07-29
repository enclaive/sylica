#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM="${1:?usage: build.sh <platform> (see platforms/)}"
PLATFORM_CONF="$REPO_ROOT/platforms/$PLATFORM.json"
[ -f "$PLATFORM_CONF" ] || { echo "unknown platform: $PLATFORM" >&2; exit 1; }

# Inner build. Runs from the repo root, in the sylica-build container or
# directly on a host with the toolchain installed. Offline: submodules must
# already be initialized.

source "$REPO_ROOT/scripts/util.sh"

cd "$REPO_ROOT/edk2"

if git submodule status --recursive | grep -q '^-'; then
    echo "edk2 submodules not initialized" >&2
    exit 1
fi

BUILD_DIR="$(dirname "$(dirname "$(sylica output)")")"
mkdir -p "$BUILD_DIR"

export SOURCE_DATE_EPOCH="$(cat "$REPO_ROOT/reproduce/SOURCE_DATE_EPOCH")"

# copy stack cookie values
cp "$REPO_ROOT/reproduce/StackCookieValues32.json" "$BUILD_DIR/"
cp "$REPO_ROOT/reproduce/StackCookieValues64.json" "$BUILD_DIR/"

# set required build environment
export PYTHON_COMMAND=python3
export PYTHONHASHSEED=1
export WORKSPACE="$PWD"
export CONF_PATH="$WORKSPACE/Conf"
export EDK_TOOLS_PATH="$WORKSPACE/BaseTools"
export PATH="$EDK_TOOLS_PATH/BinWrappers/PosixLike:$PATH"

# replacement for edksetup.sh
template() { cp "$EDK_TOOLS_PATH/Conf/$1.template" "$CONF_PATH/$1.txt"; }
template build_rule
template tools_def
template target

# ensure all tools are present
make -C BaseTools -j"$(nproc)" ARCH=X64

# only modify sylica builds for clean comparison
SYLICA_PKG="$(sylica package)"
if [ -n "${SYLICA_PKG}" ]; then
    # link the sylica package to not depend on EDK2 build specifics
    ln -sfn ../SylicaOss SylicaOss
    [[ "$SYLICA_PKG" == "SylicaPkg" ]] && ln -sfn ../SylicaPkg SylicaPkg

    # perform variant specific modifications
    "$REPO_ROOT/SylicaOss/build.sh"
    [[ "$SYLICA_PKG" == "SylicaPkg" ]] && "$REPO_ROOT/SylicaPkg/build.sh"
else
    # upstream AmdSev expects this file
    touch OvmfPkg/AmdSev/Grub/grub.efi
fi

# run the main build
build -p "$(sylica platform)" -b "$(sylica target)" -a "$(sylica arch)" -t "$(sylica toolchain)" \
  $(sylica arguments)

# copy out finished artifacts
OUT_DIR="$REPO_ROOT/out/$PLATFORM"
mkdir -p "$OUT_DIR"

if [ -f /tools-manifest.txt ]; then
    cp /tools-manifest.txt "$OUT_DIR/tools-manifest.txt"
else
    echo "running local build, skipping tools manifest"
fi

cp "$(sylica output)" "$OUT_DIR/$(sylica filename)"

cd "$OUT_DIR"
sha256sum "$(sylica filename)" | tee sha256sums
b2sum     "$(sylica filename)" | tee b2sums
