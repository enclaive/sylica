#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/test/out"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

BUSYBOX="${BUSYBOX:-/bin/busybox}"
[ -x "$BUSYBOX" ] || { echo "$BUSYBOX not found (install busybox-static)" >&2; exit 1; }
file "$BUSYBOX" | grep -q 'statically linked' || \
    { echo "$BUSYBOX is not static, install busybox-static" >&2; exit 1; }

for tool in cpio zstd; do
    command -v "$tool" >/dev/null || { echo "missing tool: $tool" >&2; exit 1; }
done

mkdir -p "$OUT_DIR" "$STAGE"/{bin,proc,sys,dev}
ln -s . "$STAGE/usr"
cp "$BUSYBOX" "$STAGE/bin/busybox"
"$BUSYBOX" --install -s "$STAGE/bin"

cat > "$STAGE/init" << 'EOF'
#!/bin/sh

set -eu

export PATH=/bin
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mount -t configfs none /sys/kernel/config 2>/dev/null

# wait for serial console to clear up / use "quiet"
#sleep 1

echo "SYLICA-TEST: kernel $(uname -r)"

TSM=/sys/kernel/config/tsm/report/r0
if mkdir "$TSM" 2>/dev/null; then
    PROVIDER=$(cat "$TSM/provider")
    echo "TSM-PROVIDER: $PROVIDER"
    head -c 64 /dev/zero > "$TSM/inblob"
    echo "REPORT-BEGIN"
    xxd -p "$TSM/outblob" | tr -d '\n';echo
    echo "REPORT-END"
else
    echo "TSM-NONE"
fi

CCEL=/sys/firmware/acpi/tables/data/CCEL
if [ -f "$CCEL" ]; then
    echo "EVENTLOG-BEGIN"
    # the file is 64k and tr | sed is not happy
    xxd -p "$CCEL" -c "$(stat -c %s "$CCEL")" | sed -E 's|(ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)+$||g';echo
    echo "EVENTLOG-END"
else
    echo "EVENTLOG-NONE"
fi

echo "SYLICA-TEST-OK"
sleep 1
poweroff -f
EOF
chmod +x "$STAGE/init"

cd "$STAGE"
find . -print0 | sort -z | \
  cpio --null -o --format=newc --owner=0:0 --reproducible --quiet | \
  zstd -q -f -o "$OUT_DIR/initrd.img"

for entry in init bin/busybox bin/sh; do
    zstd -q -d -c "$OUT_DIR/initrd.img" | cpio -t --quiet | grep -qx "$entry" || \
        { echo "initrd verification failed: $entry missing" >&2; exit 1; }
done
echo "initrd ready: $OUT_DIR/initrd.img"
