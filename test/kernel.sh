#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KERNEL_VERSION="${KERNEL_VERSION:-6.12.41}"
KERNEL_SHA256="${KERNEL_SHA256:-6b19a3ae99423de2416964d67251d745910277af258b4c4c63e88fd87dbf0e27}"
BUILD_DIR="${KERNEL_BUILD_DIR:-$REPO_ROOT/test/build}"
OUT_DIR="$REPO_ROOT/test/out"
SRC_DIR="$BUILD_DIR/linux-$KERNEL_VERSION"
TARBALL="$BUILD_DIR/linux-$KERNEL_VERSION.tar.xz"

for tool in gcc make flex bison bc; do
    command -v "$tool" >/dev/null || { echo "missing tool: $tool" >&2; exit 1; }
done

mkdir -p "$BUILD_DIR" "$OUT_DIR"

if [ ! -f "$TARBALL" ]; then
    wget -q -O "$TARBALL" "https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-$KERNEL_VERSION.tar.xz"
fi
echo "$KERNEL_SHA256  $TARBALL" | sha256sum -c --quiet

if [ ! -d "$SRC_DIR" ]; then
    tar -C "$BUILD_DIR" -xf "$TARBALL"
fi

cd "$SRC_DIR"

make defconfig
scripts/kconfig/merge_config.sh -m .config "$REPO_ROOT/test/kernel.config"
make olddefconfig

for opt in CONFIG_64BIT CONFIG_EFI_STUB CONFIG_AMD_MEM_ENCRYPT CONFIG_INTEL_TDX_GUEST \
           CONFIG_SEV_GUEST CONFIG_TDX_GUEST_DRIVER CONFIG_TSM_REPORTS CONFIG_VIRTIO_BLK; do
    grep -q "^$opt=y" .config || { echo "$opt did not stick, check dependencies" >&2; exit 1; }
done

make -j"$(nproc)" bzImage

cp arch/x86/boot/bzImage "$OUT_DIR/bzImage"
echo "kernel ready: $OUT_DIR/bzImage"
