# Platforms

| Platform     | DSC                                | Output    | Purpose                                  |
|--------------|------------------------------------|-----------|------------------------------------------|
| `sylica-sev` | `SylicaOss/SylicaOssSev.dsc`       | `CVMF.fd` | Sylica firmware for AMD SEV-SNP.         |
| `sylica-tdx` | `SylicaOss/SylicaOssTdx.dsc`       | `CVMF.fd` | Sylica firmware for Intel TDX.           |
| `sylica-x86` | `SylicaOss/SylicaOssSev.dsc`       | `CVMF.fd` | Sylica firmware for non-confidential x86.|
| `debug-sev`  | `OvmfPkg/AmdSev/AmdSevX64.dsc`     | `OVMF.fd` | Unmodified upstream edk2 AmdSev build.   |
| `debug-tdx`  | `OvmfPkg/IntelTdx/IntelTdxX64.dsc` | `OVMF.fd` | Unmodified upstream edk2 IntelTdx build. |

## sylica-sev

Built from `SylicaOss`, Sylica's edk2 platform package. Differences from upstream AmdSev:

- secure boot enabled
- dynamic stack cookies

Replace libraries:

- platform boot manager (`SylicaOss/Library/PlatformBootManager`)

Firmware vendor and version strings identify the Sylica release.

## sylica-tdx

Forked from upstream `OvmfPkg/IntelTdx/IntelTdxX64.dsc` into `SylicaOss/SylicaOssTdx.dsc`. Differences from upstream IntelTdx:

- `GenericQemuLoadImageLib` replaces `X86QemuLoadImageLib` to align with `AmdSev` package
- flash device renamed to `CVMF_TDX`

TDX launch measurements (MRTD) are not computed yet; `measurements.json` carries the firmware hash only.

## sylica-x86

Same build recipe as `sylica-sev`, packaged as its own platform for non-confidential x86 virtual machines. The SEV code
paths stay inactive when no SEV guest context is present, so the image boots on any KVM/QEMU host. No launch
measurements apply; `measurements.json` carries the firmware hash only.

## debug-sev

Byte-for-byte upstream edk2 recipe, no Sylica code. Two roles:

- Canary: if both platforms fail reproducibility, the problem is infrastructure (toolchain, edk2 pin, container). If only `sylica-sev` fails, the problem is in `SylicaOss`.
- Reference: a known-good stock firmware to diff behavior and measurements against when debugging.

## debug-tdx

Byte-for-byte upstream edk2 IntelTdx recipe, no Sylica code. Same canary and reference roles as `debug-sev`, for the TDX side.

## Firmware naming

Sylica firmware is named `CVMF.fd` (Confidential Virtual Machine Firmware) to distinguish it from stock OVMF; the upstream
reference keeps `OVMF.fd`. Both are unified single-file images: code and variable store in one measured binary, passed
to QEMU via `-bios`. Split CODE/VARS images are not used because a writable variable store is outside the launch measurement.
