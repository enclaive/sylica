#!/usr/bin/env bash

arg=(
  -global ICH9-LPC.disable_s3=1
  -nodefaults -nographic -no-reboot -vga none
  -serial stdio -m 512m -accel kvm
  -chardev file,id=debugcon,path=debug.log
  -device isa-debugcon,iobase=0x402,chardev=debugcon
  -bios CVMF.fd
  -kernel bzImage -initrd initrd.img
  -append '"console=ttyS0 quiet"'
)

tdx=(
  -machine q35,confidential-guest-support=tdx0,kernel-irqchip=split
  -object "'"'{"qom-type":"tdx-guest","id":"tdx0","quote-generation-socket":{"type":"unix","path":"/var/run/tdx-qgs/qgs.socket"}}'"'"
  -cpu host
)
snp=(
  -machine q35,confidential-guest-support=sev0
  -object sev-snp-guest,id=sev0,cbitpos=51,reduced-phys-bits=1,policy=0x30000,kernel-hashes=on
  -cpu EPYC-v4
)

echo "To launch a guest with SNP:"
echo qemu-system-x86_64 ${arg[@]} ${snp[@]}
echo
echo "To launch a guest with TDX:"
echo qemu-system-x86_64 ${arg[@]} ${tdx[@]}
