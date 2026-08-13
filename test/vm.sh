#!/usr/bin/env bash

PLATFORM="${1:-sev-oss}"

# build -p ShellPkg/ShellPkg.dsc -t GCC -a X64 -b RELEASE
qemu-system-x86_64 -machine q35,accel=kvm -global ICH9-LPC.disable_s3=1 \
  -nodefaults -nographic -no-reboot \
  -bios out/sylica-"$PLATFORM"/CVMF.fd \
  -fw_cfg name=etc/boot/EFI\\BOOT\\BOOTX64.EFI,file=edk2/Build/Shell/RELEASE_GCC/X64/ShellPkg/Application/Shell/Shell/OUTPUT/Shell.efi \
  -serial stdio -chardev file,id=debugcon,path=test/debug.log -device isa-debugcon,iobase=0x402,chardev=debugcon \
  -pidfile test/qemu.pid -m 128m -fw_cfg name=etc/boot/startup.nsh,file=test/startup.nsh