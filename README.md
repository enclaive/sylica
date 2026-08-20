# Sylica — Verifiable Firmware for Virtual Machines

**Sylica** is a security-focused UEFI firmware distribution for virtual machines.

Its firmware image, **CVMF (Confidential Virtual Machine Firmware)**, supports **AMD SEV-SNP** and **Intel TDX** confidential VMs as well as conventional **x86 virtual machines**.

Sylica reduces the firmware computing base, provides reproducible firmware artifacts, and publishes cryptographic measurements and release provenance so operators can independently verify the firmware they deploy and attest.

## Why Sylica?

Confidential computing protects workloads while they execute, but the firmware that establishes the virtual machine remains a critical part of the trust chain.

```text
Hardware
   │
   ▼
SEV-SNP / TDX
   │
   ▼
Sylica CVMF
   │
   ▼
Authenticated boot workload
   │
   ▼
Guest operating system
   │
   ▼
Application
```

A vulnerability, unexpected component, or unauthorized change in the firmware can undermine properties expected from the confidential VM.

Sylica addresses this with:

* **Reduced firmware computing base** — remove unnecessary firmware functionality and reduce privileged attack surface.
* **Reproducible builds** — independently rebuild firmware from pinned source and build inputs.
* **Deterministic artifacts** — identical inputs produce bit-identical firmware.
* **Precomputed measurements** — releases contain expected confidential-VM launch measurements.
* **Secure Boot support** — authenticate subsequent EFI boot components.
* **Release provenance** — releases contain cryptographic checksums and build attestations.
* **Controlled lifecycle** — versioned firmware releases provide a stable basis for deployment and attestation policies.

Sylica makes the firmware layer of the VM trust chain **smaller, controlled, and independently verifiable**.

## Choose Your Firmware

Sylica provides dedicated firmware variants for conventional and confidential virtual machines.

| VM type               | Platform         | Hardware requirement |
| --------------------- | ---------------- | -------------------- |
| Conventional x86 VM   | `sylica-x86`     | any x86-64 platform  |
| AMD confidential VM   | `sylica-sev-oss` | AMD SEV-SNP          |
| Intel confidential VM | `sylica-tdx-oss` | Intel TDX            |

### `sylica-x86`

`sylica-x86` runs on conventional x86 virtual machines and does **not** require confidential-computing hardware.

It provides the benefits of Sylica's reduced, controlled, and reproducible firmware computing base for ordinary VMs.

Use it for:

* conventional cloud or on-premises VMs;
* CVMF evaluation and development;
* firmware smoke testing;
* environments where SEV-SNP or TDX is not required.

### `sylica-sev-oss`

`sylica-sev-oss` targets AMD SEV-SNP confidential virtual machines.

It integrates CVMF with the SEV-SNP launch and measurement model so the firmware can participate in hardware-backed attestation.

### `sylica-tdx-oss`

`sylica-tdx-oss` targets Intel TDX Trust Domains.

It provides the CVMF configuration required for TDX and produces firmware measurements suitable for verification against TDX attestation evidence.

## Quick Start

Prebuilt CVMF firmware is available from the [Sylica GitHub Releases](https://github.com/enclaive/sylica/releases/).

Download the package for your platform:

```text
platform-sylica-x86-<version>.tar.zst
platform-sylica-sev-oss-<version>.tar.zst
platform-sylica-tdx-oss-<version>.tar.zst
```

For example:

```bash
tar -xf platform-sylica-x86-<version>.tar.zst
cd platform-sylica-x86
```

Verify the firmware:

```bash
sha256sum -c sha256sums
b2sum -c b2sums
```

The deployable firmware image is:

```text
CVMF.fd
```

Launch it with QEMU:

```bash
qemu-system-x86_64 \
    -enable-kvm \
    -machine q35 \
    -cpu host \
    -m 4G \
    -bios CVMF.fd \
    ...
```

This conventional `sylica-x86` launch does not require SEV-SNP or TDX hardware.

AMD SEV-SNP and Intel TDX require additional QEMU confidential-guest configuration and corresponding host hardware support.

See [Getting Started](https://docs.enclaive.cloud/sylica/documentation) for complete x86, SEV-SNP, and TDX launch instructions.

## Verification

Sylica is designed so that trust in a firmware release does not have to depend solely on where the binary was downloaded.

The verification model is:

```text
Source
   │
   ▼
Pinned build environment
   │
   ▼
Reproducible build
   │
   ▼
CVMF.fd
   │
   ├──────────────► firmware hash
   │
   └──────────────► expected measurement
                           │
                           ▼
                    VM attestation
                           │
                           ▼
                    policy decision
```

Each release provides multiple complementary verification mechanisms.

### Firmware integrity

Each platform package contains:

```text
CVMF.fd
sha256sums
b2sums
```

Verify the extracted firmware with:

```bash
sha256sum -c sha256sums
b2sum -c b2sums
```

### Reproducibility

CVMF builds use:

* pinned Sylica source;
* pinned EDK2 source;
* a pinned Ubuntu 22.04 package snapshot;
* exact build-tool versions;
* an immutable build-environment container;
* deterministic build settings.

Each package includes:

```text
tools-manifest.txt
```

with the exact package versions used by the release build.

An independent rebuild of the same release should produce a bit-identical `CVMF.fd`.

See [Reproducible Builds](docs/reproducibility.md).

### Measurements

Each platform package contains:

```text
measurements.json
```

with the firmware hash and precomputed launch measurements for supported configurations.

For confidential VMs, these values can be compared against hardware-backed attestation evidence.

For AMD SEV-SNP, verify the applicable:

```text
MEASUREMENT
```

For Intel TDX, verify the applicable:

```text
MRTD
```

A valid hardware attestation report alone does not establish that a VM is running approved firmware. The reported measurement must also satisfy the verifier's policy.

See [Verification and Usage](docs/verification.md).

### Release provenance

Sylica releases additionally contain release-wide checksum manifests and GitHub build provenance:

```text
sha256sums
b2sums
attestation.json
```

This allows an operator to establish a chain from the source revision through the release workflow to the downloaded firmware package.

See [Release Model](https://docs.enclaive.cloud/sylica/documentation).

## Reduced Firmware Computing Base

General-purpose OVMF is designed to support a broad range of virtual hardware, boot methods, and deployment environments.

Sylica takes a more restrictive approach.

CVMF removes functionality that is unnecessary for its supported VM configurations and keeps the firmware configuration explicit.

Conceptually:

```text
General-purpose OVMF

UEFI
├── broad device support
├── multiple boot paths
├── compatibility functionality
├── optional services
└── platform-specific functionality


Sylica CVMF

UEFI
├── required boot path
├── required virtual devices
├── required security services
└── confidential-computing integration
```

Reducing the firmware computing base:

* decreases privileged code;
* reduces host-controlled input processing;
* reduces attack surface;
* reduces dependencies;
* makes firmware behavior easier to reason about;
* reduces the amount of code requiring security review.

A reduced computing base does not by itself prove that the firmware is secure. It makes the security-critical firmware surface smaller and more reviewable.

## Architecture

CVMF is based on EDK2/OVMF and follows the standard UEFI firmware boot phases:

```text
Reset
  │
  ▼
 SEC
  │
  ▼
 PEI
  │
  ▼
 DXE
  │
  ▼
 BDS
  │
  ▼
EFI boot
workload
  │
  ▼
Guest OS
```

Sylica controls the EDK2 revision, platform configuration, firmware modules, build environment, and resulting firmware artifacts.

For confidential VMs, CVMF operates inside the hardware protection boundary established by AMD SEV-SNP or Intel TDX.

```text
              Untrusted host
                    │
          Hypervisor / QEMU
                    │
════════════════════╪════════════════════
     hardware confidentiality boundary
════════════════════╪════════════════════
                    │
                   CVMF
                    │
                    ▼
             Boot workload
                    │
                    ▼
                Guest OS
```

CVMF does not create the hardware isolation boundary. SEV-SNP or TDX provides that boundary.

CVMF provides the firmware layer executing inside it.

See [Architecture](https://docs.enclaive.cloud/sylica/documentation)

## Supported Environments

### CPU technologies

| Technology          | Status    |
| ------------------- | --------- |
| Conventional x86-64 | Supported |
| AMD SEV-SNP         | Supported |
| Intel TDX           | Supported |
| ARM CCA             | Planned   |

### Virtualization

CVMF primarily targets KVM/QEMU-based virtualization.

| Environment    | Status             |
| -------------- | ------------------ |
| KVM/QEMU       | Supported          |
| libvirt        | Supported          |
| Proxmox VE     | Compatible         |
| VMware vSphere | Platform-dependent |

Support for a CPU confidential-computing technology does not automatically imply support for custom firmware on every hypervisor or cloud platform.


### Confidential containers

CVMF can be used as the firmware of confidential PodVMs and microVMs in confidential-container architectures.

Relevant integrations include:

| Environment    | Status             |
| -------------- | ------------------ |
| Dyneemes       | Supported          |
| Cofidential Containers        | Supported          |
| Kata Containers    | Compatible         |
| Red Hat Sandboxed Containers | Platform-dependent |
| Contrast | to be verified |

In these environments, CVMF runs inside the VM backing the confidential container rather than directly in Kubernetes.

## Release Model

Every Sylica release builds all supported firmware platforms from a common, pinned build environment.

```text
Git tag
   │
   ▼
Pinned build environment
   │
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
sylica-x86   sylica-sev-oss sylica-tdx-oss
   │              │              │
   ▼              ▼              ▼
CVMF.fd        CVMF.fd        CVMF.fd
   │              │              │
   └──────────────┴──────────────┘
                  │
                  ▼
         platform packages
                  │
                  ▼
         release checksums
                  │
                  ▼
        release attestation
```

A platform package contains the firmware and the metadata required to inspect and verify it:

```text
platform-sylica-<platform>/
├── CVMF.fd
├── sha256sums
├── b2sums
├── measurements.json
├── tools-manifest.txt
└── license and notice files
```

See [Release Model](https://docs.enclaive.cloud/sylica/documentation) for the complete artifact and provenance model.

## Build from Source

Clone the repository including its pinned EDK2 submodule:

```bash
git clone --recursive https://github.com/enclaive/sylica.git
cd sylica
```

Build a platform using the Sylica build tooling.

For example:

```bash
scripts/build.sh sylica-x86
```

The available build configurations include:

```text
sylica-x86
sylica-sev-oss
sylica-tdx-oss
debug-sev
debug-tdx
```

The `debug-*` builds are upstream reference configurations intended primarily for development, comparison, debugging, and reproducibility analysis.

For production artifacts and reproducible builds, use the isolated build environment documented in [Building Sylica Firmware](docs/build.md).

## Documentation

See also [docs.enclaive.cloud/sylica](https://docs.enclaive.cloud/sylica)

## Security

Sylica is security-critical firmware distribution.

The security model explicitly distinguishes between properties provided by:

* AMD SEV-SNP or Intel TDX hardware;
* CVMF;
* UEFI Secure Boot;
* the guest boot chain;
* the reproducible build process;
* release provenance;
* the attestation verifier.

See [Security Model](https://docs.enclaive.cloud/sylica/documentation) before using Sylica as part of a confidential-computing trust decision.

To report a vulnerability, follow [SECURITY.md](SECURITY.md). We follow a **safe harbor** policy for security researchers.

## Contributing

Contributions are welcome.

Before submitting changes, read:

* [CONTRIBUTING.md](CONTRIBUTING.md)
* [Building](docs/build.md)
* [Reproducibility](docs/reproducibility.md)

Changes to firmware configuration or source code may change the resulting `CVMF.fd` and confidential-computing measurements. Such changes should therefore be treated as security-relevant.

## License

Sylica contains software distributed under multiple licenses.

See:

* [LICENSE](LICENSE)
* [NOTICE.md](NOTICE.md)

Review the applicable license terms before redistribution, embedding, or commercial use.
