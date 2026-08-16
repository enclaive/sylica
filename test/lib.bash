TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$TEST_ROOT/.." && pwd)"
OUT_DIR="$TEST_ROOT/out"
CONFIG="$TEST_ROOT/config.json"

SHELL_EFI="${SHELL_EFI:-$OUT_DIR/Shell.efi}"

has_kvm() { [ -w /dev/kvm ]; }
has_shell() { [ -f "$SHELL_EFI" ]; }
has_snp() { [ "$(cat /sys/module/kvm_amd/parameters/sev_snp 2>/dev/null)" = "Y" ]; }
has_tdx() { [ "$(cat /sys/module/kvm_intel/parameters/tdx 2>/dev/null)" = "Y" ]; }

platforms() {
    jq -r 'keys[]' "$CONFIG"
}

platform_mode() { jq -r ".\"$1\".mode" "$CONFIG"; }
platform_tests() { jq -r ".\"$1\".test[]" "$CONFIG"; }
platform_filename() { jq -r '.filename' "$REPO_ROOT/platforms/$1.json"; }

firmware() {
    local fw="$REPO_ROOT/out/$1/$(platform_filename "$1")"
    [ -f "$fw" ] || { echo "missing firmware: $fw (run scripts/build.sh $1)" >&2; return 1; }
    echo "$fw"
}

build_artifacts() {
    local p
    for p in $(platforms); do
        [ -f "$REPO_ROOT/out/$p/$(platform_filename "$p")" ] || "$REPO_ROOT/scripts/build.sh" "$p"
    done
    [ -f "$OUT_DIR/bzImage" ]    || "$TEST_ROOT/kernel.sh"
    [ -f "$OUT_DIR/initrd.img" ] || "$TEST_ROOT/initrd.sh"
}

run_vm() {
    local platform="$1" payload="$2" cc="${3:-none}"
    local fw
    fw="$(firmware "$platform")" || return 1

    local workdir="${BATS_TEST_TMPDIR:-$(mktemp -d)}"
    SERIAL_LOG="$workdir/serial.log"
    DEBUG_LOG="$workdir/debug.log"
    rm -f "$SERIAL_LOG" "$DEBUG_LOG"

    local args=(
        -global ICH9-LPC.disable_s3=1
        -nodefaults -nographic -no-reboot
        -bios "$fw"
        -serial "file:$SERIAL_LOG"
        -chardev "file,id=debugcon,path=$DEBUG_LOG"
        -device isa-debugcon,iobase=0x402,chardev=debugcon
        -m 512m
    )

    local kernel_hashes=off
    [ "$payload" = kernel ] && kernel_hashes=on

    case "$cc" in
    none)
        args+=(-machine q35)
        has_kvm && args+=(-accel kvm -cpu host)
        ;;
    snp)
        args+=(
            -machine q35,confidential-guest-support=sev0,memory-backend=ram1
            -object memory-backend-memfd,id=ram1,size=512M,share=true,prealloc=false
            -object "sev-snp-guest,id=sev0,cbitpos=51,reduced-phys-bits=1,policy=0x30000,kernel-hashes=$kernel_hashes"
            -cpu EPYC-v4
            -accel kvm
        )
        ;;
    tdx)
        args+=(
            -machine q35,confidential-guest-support=tdx0,kernel-irqchip=split
            -object '{"qom-type":"tdx-guest","id":"tdx0","quote-generation-socket":{"type":"unix","path":"/var/run/tdx-qgs/qgs.socket"}}'
            -cpu host
            -accel kvm
        )
        ;;
    esac

    case "$payload" in
    shell-fwcfg)
        args+=(
            -fw_cfg "name=etc/boot/EFI\\BOOT\\BOOTX64.EFI,file=$SHELL_EFI"
            -fw_cfg "name=etc/boot/startup.nsh,file=$TEST_ROOT/ci.nsh"
        )
        ;;
    shell-esp)
        "$TEST_ROOT/esp.sh" shell "$workdir/esp.img" >&2
        args+=(
            -drive "id=esp,file=$workdir/esp.img,format=raw,if=none"
            -device virtio-blk-pci,drive=esp,disable-legacy=on,disable-modern=off
        )
        ;;
    kernel)
        args+=(
            -kernel "$OUT_DIR/bzImage"
            -initrd "$OUT_DIR/initrd.img"
            -append "console=ttyS0"
        )
        # qemu >= 10 serves -kernel as etc/boot/kernel natively, older ones
        # only expose the legacy selector the loader does not read
        local qemu_major
        qemu_major="$(qemu-system-x86_64 --version | sed -n 's/.*version \([0-9]*\).*/\1/p')"
        [ "${qemu_major:-0}" -lt 10 ] && \
            args+=(-fw_cfg "name=etc/boot/kernel,file=$OUT_DIR/bzImage")
        ;;
    uki)
        "$TEST_ROOT/esp.sh" uki "$workdir/esp.img" >&2
        args+=(
            -drive "id=esp,file=$workdir/esp.img,format=raw,if=none"
            -device virtio-blk-pci,drive=esp,disable-legacy=on,disable-modern=off
        )
        ;;
    *)
        echo "unknown payload: $payload" >&2; return 1 ;;
    esac

    timeout --foreground "${SMOKE_TIMEOUT:-120}" qemu-system-x86_64 "${args[@]}"
}

assert_serial() {
    grep -aq "$1" "$SERIAL_LOG" || {
        echo "marker '$1' not found in serial output:" >&2
        cat "$SERIAL_LOG" >&2
        return 1
    }
}

save_serial() {
    cp "$SERIAL_LOG" "$OUT_DIR/$1-$2.serial.log"
}

boot_vm() {
    local rc=0
    run_vm "$1" "$2" "$3" || rc=$?
    save_serial "$1" "${4:-$2}"
    [ "$rc" -eq 0 ] || {
        echo "qemu exited with $rc, serial output:" >&2
        cat "$SERIAL_LOG" >&2
        return "$rc"
    }
}

run_test() {
    local platform="$1" feature="$2"
    local mode payload
    mode="$(platform_mode "$platform")"

    case "$feature" in
    shell)
        has_shell || skip "no Shell.efi (build -p ShellPkg/ShellPkg.dsc -t GCC -a X64 -b RELEASE)"
        [ "$mode" = direct ] && payload=shell-fwcfg || payload=shell-esp
        boot_vm "$platform" "$payload" none "$feature"
        assert_serial "SMOKE-OK"
        ;;
    boot)
        [ "$mode" = direct ] && payload=kernel || payload=uki
        boot_vm "$platform" "$payload" none "$feature"
        assert_serial "TSM-NONE"
        assert_serial "SYLICA-TEST-OK"
        ;;
    snp)
        has_snp || skip "no SNP host"
        [ "$mode" = direct ] && payload=kernel || payload=uki
        boot_vm "$platform" "$payload" snp "$feature"
        assert_serial "TSM-PROVIDER: sev_guest"
        assert_serial "REPORT-BEGIN"
        assert_serial "SYLICA-TEST-OK"
        ;;
    tdx)
        has_tdx || skip "no TDX host"
        [ "$mode" = direct ] && payload=kernel || payload=uki
        boot_vm "$platform" "$payload" tdx "$feature"
        assert_serial "TSM-PROVIDER: tdx_guest"
        assert_serial "REPORT-BEGIN"
        assert_serial "EVENTLOG-BEGIN"
        assert_serial "SYLICA-TEST-OK"
        ;;
    *)
        echo "unknown feature: $feature" >&2; return 1 ;;
    esac
}
