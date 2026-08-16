#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/test/out"
MODE="${1:?usage: esp.sh shell|uki [output.img]}"
IMG="${2:-$OUT_DIR/esp-$MODE.img}"

command -v mformat >/dev/null || { echo "mtools not installed" >&2; exit 1; }
mkdir -p "$OUT_DIR"

case "$MODE" in
  shell)
    PAYLOAD="${SHELL_EFI:-$OUT_DIR/Shell.efi}"
    [ -f "$PAYLOAD" ] || { echo "missing $PAYLOAD (copy a Shell.efi to test/out/ or docker build -f test/Dockerfile -o test/out .)" >&2; exit 1; }
    ;;
  uki)
    KERNEL="$OUT_DIR/bzImage"
    INITRD="$OUT_DIR/initrd.img"
    [ -f "$KERNEL" ] || { echo "missing $KERNEL (run test/kernel.sh)" >&2; exit 1; }
    [ -f "$INITRD" ] || { echo "missing $INITRD (run test/initrd.sh)" >&2; exit 1; }
    command -v ukify >/dev/null || { echo "ukify not installed (systemd-ukify)" >&2; exit 1; }
    PAYLOAD="$OUT_DIR/uki.efi"
    ukify build \
      --linux "$KERNEL" \
      --initrd "$INITRD" \
      --cmdline "console=ttyS0" \
      --output "$PAYLOAD" >/dev/null
    ;;
  *)
    echo "unknown mode: $MODE" >&2; exit 1 ;;
esac

rm -f "$IMG"
truncate -s 64M "$IMG"
mformat -i "$IMG" ::
mmd     -i "$IMG" ::/EFI ::/EFI/BOOT
mcopy   -i "$IMG" "$PAYLOAD" ::/EFI/BOOT/BOOTX64.EFI
if [ "$MODE" = shell ]; then
    mcopy -i "$IMG" "$REPO_ROOT/test/ci.nsh" ::/startup.nsh
fi
echo "esp ready: $IMG"
