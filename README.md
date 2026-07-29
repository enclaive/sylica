# Sylica - The Confidential Computing Firmware Distribution

Confidential Computing protects workloads while they execute, but its security depends on one critical assumption:

> **The firmware establishing the confidential virtual machine can be trusted.**

Without a trusted firmware foundation, remote attestation, confidential computing, and policy-based key release lose much of their security value.

**Sylica** is an enterprise-grade confidential VM firmware distribution engineered specifically for **Intel TDX**, **AMD SEV-SNP**,
and **ARM CCA**. It provides a **minimal trusted computing base**, **deterministic measurements**, **reproducible builds**,
and an **enterprise security lifecycle**, enabling security teams to independently verify the integrity of the firmware protecting their most sensitive workloads.

Rather than extending trust to cloud-provider firmware, Sylica establishes an **independently verifiable root of trust for confidential computing**.

## Why Sylica

Confidential computing introduces a new infrastructure layer where firmware becomes part of the workload trust chain.

Traditional VM firmware is designed for compatibility. Sylica is designed for:

- deterministic builds
- reproducible measurements
- reduced computing base / loc
- automated deployment
- supply-chain verification
- enterprise lifecycle management

## Design Principles

Sylica is built around five principles:

1. **Minimise trust**

   Reduce the trusted computing base to only what is required.

2. **Make trust verifiable**

   Enable independent verification of firmware binaries and measurements.

3. **Make builds reproducible**

   Ensure the same source and toolchain produce the same firmware.

4. **Make security lifecycle predictable**

   Provide controlled releases, vulnerability management, and long-term support.

5. **Make confidential computing enterprise-ready**

   Deliver the assurance required for regulated and mission-critical workloads.

## Documentation

- [Building](docs/build.md)
- [Platforms](docs/platforms.md)
- [Reproducibility](docs/reproducibility.md)
- [Verification and usage](docs/verification.md)

## Supported Platforms

### CPU Technologies

| Platform    | Support   |
|-------------|-----------|
| AMD SEV-SNP | Supported |
| Intel TDX   | Supported |
| ARM CCA     | Planned   |

### Virtualisation Platforms

| Platform | Support   |
|----------|-----------|
| KVM/QEMU | Supported |
| libvirt  | Supported |
| Proxmox  | Supported |
| VSphere  | Supported |

### Kubernetes Platforms

| Platform                       | Support   |
|--------------------------------|-----------|
| Dyyneemes                      | Supported |
| Confidential Containers        | Supported |
| Openshift Sandboxed Containers | Planned   |
   
