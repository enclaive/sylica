# Verification and usage

## Launch measurements

AMD SEV-SNP measures the initial guest memory contents, including the firmware, into a launch digest that appears in
every attestation report. Because Sylica builds are reproducible, the expected digest is computable in advance:

```bash
pip install --require-hashes -r requirements.txt
verify/measure.sh sylica-sev
```

This writes `out/sylica-sev/measurements.json` with the firmware hash and the SNP launch digest per vCPU count. The
digest depends on the vCPU count and type, so a variation of deployment sizes is precomputed.

## Verifying a running VM

1. Get the attestation report from inside the guest (`snpguest report` or any SNP attestation client).
2. Compare the report's `MEASUREMENT` field against `measurements.json` for the deployed vCPU count.
3. A match proves the VM was launched with exactly this firmware on genuine SEV-SNP hardware.

With `-kernel` direct boot and `kernel-hashes=on`, the kernel, initrd, and cmdline hashes become part of the same
measurement; compute the expected digest with the corresponding `sev-snp-measure` options.

## Booting

Unified firmware image, passed via `-bios`:

```bash
qemu-system-x86_64 \
  -machine q35,confidential-guest-support=sev0 \
  -object sev-snp-guest,id=sev0,cbitpos=51,reduced-phys-bits=1,kernel-hashes=on \
  -cpu EPYC-v4 -smp 4 -m 4096 \
  -bios out/sylica-sev/CVMF.fd \
  -kernel vmlinuz -initrd initrd.img -append "console=ttyS0" \
  -nographic
```

`kernel-hashes=on` extends the launch measurement over the injected kernel, initrd, and cmdline.

Firmware SecureBoot enrolls values to the variable store which are measured as part of the firmware,
so the attestation report also proves which SecureBoot variables are in effect.
