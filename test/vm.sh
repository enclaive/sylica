#!/usr/bin/env bash

set -euo pipefail

base=(
  -global ICH9-LPC.disable_s3=1
  -nodefaults -nographic -no-reboot -vga none
  -serial stdio -m 512m -accel kvm
)
boot=(
  -bios CVMF.fd
  -kernel bzImage -initrd initrd.img
  -append '"console=ttyS0 quiet"'
)
snp=(
  -machine q35,confidential-guest-support=sev0
  -object sev-snp-guest,id=sev0,cbitpos=51,reduced-phys-bits=1,policy=0x30000,kernel-hashes=on
)
tdx=(
  -machine q35,confidential-guest-support=tdx0,kernel-irqchip=split
  -object "'"'{"qom-type":"tdx-guest","id":"tdx0","quote-generation-socket":{"type":"unix","path":"/var/run/tdx-qgs/qgs.socket"}}'"'"
)
debug=(
  -chardev file,id=debugcon,path=debug.log
  -device isa-debugcon,iobase=0x402,chardev=debugcon
)

echo "To test a firmware with KVM:"
echo '```bash'
echo "qemu-system-x86_64 ${base[@]} \\"
echo "    ${boot[@]}"
echo '```'
echo
echo "To launch a guest with SNP:"
echo '```bash'
echo "qemu-system-x86_64 ${base[@]} \\"
echo -n "    ${boot[@]} -cpu EPYC-v4"
for i in $(seq 2 2 "${#snp[@]}");do
  echo " \\"
  echo -n "    ${snp[$i-2]} ${snp[$i-1]}"
done; echo
echo '```'
echo
echo "To launch a guest with TDX:"
echo '```bash'
echo "qemu-system-x86_64 ${base[@]} \\"
echo -n "    ${boot[@]} -cpu host"
for i in $(seq 2 2 "${#tdx[@]}");do
  echo " \\"
  echo -n "    ${tdx[$i-2]} ${tdx[$i-1]}"
done; echo
echo '```'
