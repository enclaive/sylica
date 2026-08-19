# Sylica Firmware Size and Secure Boot Impact

## Overview

Sylica aims to provide a reduced and security-focused EDK II firmware configuration for AMD SEV and SEV-SNP virtual machines. Firmware size is an important property because reducing unnecessary DXE components and libraries decreases the firmware footprint and can contribute to a smaller Trusted Computing Base (TCB).

A direct comparison with the `debug-sev` reference build initially shows that `sylica-sev-oss` consumes more space in the DXE firmware volume despite containing less platform code.

The primary reason is that Sylica enables **UEFI Secure Boot support by default**. This pulls `DxeImageVerificationLib` into the firmware and significantly increases the size of `SecurityStubDxe`.

When Secure Boot is removed from the build, the underlying size reduction achieved by Sylica becomes visible.


## Firmware Volume Layout

EDK II firmware is divided into multiple **Firmware Volumes (FVs)** that group executable modules and data according to the phase in which they are required. The size reported for a firmware volume therefore represents the code and data associated with a particular stage of the UEFI boot process rather than the size of the complete firmware image.

**SECFV** contains the firmware components required during the **Security (SEC) phase**, the first execution phase after the virtual CPU enters the firmware. Its responsibilities are deliberately minimal: establish the initial execution environment and transfer control to PEI. In confidential virtual machines, this early code is particularly security-sensitive because it forms part of the initial trusted execution path.

**PEIFV** contains the modules used during the **Pre-EFI Initialization (PEI) phase**. PEI establishes the environment required for the subsequent DXE phase, performs early platform initialization, discovers resources, and produces PEI Hand-Off Blocks (HOBs) describing the initialized platform. Once PEI has completed, control is transferred to the DXE environment.

**DXEFV** contains the majority of the **Driver Execution Environment (DXE)** firmware. DXE provides most UEFI services and loads the drivers required to initialize the platform and prepare it for booting the operating system. Components implementing functionality such as boot management, device support, cryptographic services, Secure Boot and image verification reside primarily in this stage. Consequently, DXEFV is normally the largest expanded firmware volume and is where changes to the set of included DXE drivers and libraries are most visible.

**FVMAIN_COMPACT** is the compact representation of the main firmware content stored in the final firmware image. Unlike the expanded DXE volume, its contents are compressed to reduce the amount of space required in the firmware image. During boot, the necessary firmware content is decompressed and made available to the corresponding execution phases. For this reason, changes in DXEFV occupancy do not translate linearly into changes in `FVMAIN_COMPACT`: several hundred KiB of additional executable DXE code may occupy considerably less space after compression.

Conceptually, the relationship can be viewed as:

```text
Firmware image
│
├── SECFV
│   └── SEC: initial firmware execution
│
├── PEIFV
│   └── PEI: early platform initialization
│
└── FVMAIN_COMPACT
    └── compressed main firmware content
         │
         └── DXEFV
             └── DXE drivers, UEFI services,
                 Secure Boot, boot infrastructure, etc.
```

When comparing Sylica builds, **DXEFV occupancy is particularly useful for assessing changes to the expanded DXE code footprint**, while `FVMAIN_COMPACT` is more representative of their impact on the size of the stored firmware image. SECFV and PEIFV provide corresponding measurements for the earlier and intentionally smaller boot phases.

## Firmware Volume Comparison

The following table compares the used space of the relevant firmware volumes.

| Firmware Volume | `debug-sev` | `sylica-sev-oss` |     Difference |
| --------------- | ----------: | ---------------: | -------------: |
| SECFV           |    48,304 B |         48,240 B |          −64 B |
| PEIFV           |   175,016 B |        166,888 B |       −8,128 B |
| DXEFV           | 2,631,520 B |      2,868,112 B | **+236,592 B** |
| FVMAIN_COMPACT  |   624,064 B |        742,080 B | **+118,016 B** |

The SEC and PEI firmware volumes are slightly smaller in Sylica. The major difference occurs in DXE.

`sylica-sev-oss` uses approximately **237 KB more DXEFV space** than `debug-sev`, even though the Sylica configuration contains less platform functionality.

This difference is caused primarily by Sylica's default Secure Boot configuration.

## Secure Boot Impact

Sylica enables Secure Boot by default. This requires image verification functionality during the DXE phase.

In particular, the build pulls in:

```text
DxeImageVerificationLib
```

This library is linked into the Secure Boot verification path and substantially increases the resulting size of:

```text
SecurityStubDxe
F80697E9-7FD6-4665-8646-88E33EF71DFC
```

Consequently, comparing only the final DXEFV occupancy can give the misleading impression that Sylica contains more firmware code than the reference configuration.

To isolate this effect, Sylica was also built without Secure Boot support.

## Sylica Without Secure Boot

The resulting firmware volume usage is:

| Firmware Volume |        Total |        Used |         Free | Utilization |
| --------------- | -----------: | ----------: | -----------: | ----------: |
| SECFV           |    212,992 B |    48,240 B |    164,752 B |         22% |
| PEIFV           |    851,968 B |   166,888 B |    685,080 B |         19% |
| DXEFV           | 15,204,352 B | 2,007,952 B | 13,196,400 B |         13% |
| FVMAIN_COMPACT  |  3,440,640 B |   651,944 B |  2,788,696 B |         18% |

Removing Secure Boot reduces DXEFV occupancy from:

```text
2,868,112 B
```

to:

```text
2,007,952 B
```

This corresponds to a reduction of:

```text
860,160 B
≈ 840 KiB
≈ 30%
```

of the Secure-Boot-enabled Sylica DXEFV footprint.

## Comparison Without the Secure Boot Overhead

Comparing `debug-sev` with Sylica without Secure Boot demonstrates the underlying firmware reduction more clearly.

| Firmware Volume | `debug-sev` | Sylica without Secure Boot |     Difference |
| --------------- | ----------: | -------------------------: | -------------: |
| SECFV           |    48,304 B |                   48,240 B |          −64 B |
| PEIFV           |   175,016 B |                  166,888 B |       −8,128 B |
| DXEFV           | 2,631,520 B |                2,007,952 B | **−623,568 B** |
| FVMAIN_COMPACT  |   624,064 B |                  651,944 B |      +27,880 B |

The Sylica DXE firmware content is therefore approximately:

```text
623,568 B
≈ 609 KiB
≈ 23.7%
```

smaller than `debug-sev` when the Secure Boot contribution is excluded.

This demonstrates that the underlying Sylica configuration achieves a substantial reduction in DXE firmware content.

## Why FVMAIN_COMPACT Shows a Smaller Difference

The reduction in DXEFV occupancy does not translate directly into an equivalent reduction in `FVMAIN_COMPACT`.

For example:

|                     | Secure Boot | Without Secure Boot | Difference |
| ------------------- | ----------: | ------------------: | ---------: |
| DXEFV used          | 2,868,112 B |         2,007,952 B | −860,160 B |
| FVMAIN_COMPACT used |   742,080 B |           651,944 B |  −90,136 B |

This behavior is expected.

`FVMAIN_COMPACT` stores compressed firmware content. Executable code and libraries that occupy significant space when expanded into DXEFV can compress efficiently in the compact firmware volume.

The approximately 840 KiB reduction in expanded DXE content therefore results in only approximately 88 KiB less space in `FVMAIN_COMPACT`.

Firmware size comparisons should consequently distinguish between:

* expanded firmware-volume occupancy;
* compressed firmware-image size; and
* the size of individual FFS files, PE/COFF images, and linked libraries.

These measurements answer different questions and should not be treated as interchangeable.

## Security Versus Firmware Size

The larger default Sylica firmware should not be interpreted as an increase in general platform complexity.

It reflects a deliberate security choice:

> **Sylica enables Secure Boot support by default, trading additional firmware size for cryptographic verification of executable images during the UEFI boot process.**

The underlying Sylica firmware configuration remains substantially smaller than the reference configuration when this security feature is excluded from the comparison.

This distinction is particularly important when firmware size is used as an approximation for TCB reduction.

Binary size alone is not an exact measurement of TCB. Secure Boot verification code is part of the security-critical firmware path and therefore intentionally adds code that performs a defined security function.

A useful assessment should therefore consider both:

1. **TCB minimization** — removing unnecessary drivers, protocols, libraries, and platform functionality.
2. **Required security functionality** — retaining code necessary for Secure Boot, measured boot, confidential-computing initialization, and other security properties.

Sylica prioritizes minimizing unnecessary firmware functionality rather than minimizing binary size at the expense of required security controls.

## Verifying the Source of the Difference

The build-level comparison shows the cost associated with enabling the Sylica Secure Boot configuration. It does not, by itself, prove that the complete difference originates exclusively from `DxeImageVerificationLib`.

For a component-level analysis, compare the build reports of both configurations and inspect:

```text
SecurityStubDxe
F80697E9-7FD6-4665-8646-88E33EF71DFC
```

The analysis should compare:

* FFS file size;
* PE32 executable size;
* linked library instances;
* `DxeImageVerificationLib`;
* dependent cryptographic libraries;
* additional Secure Boot dependencies; and
* firmware-volume alignment or padding changes.

This allows the Secure Boot overhead to be attributed to individual firmware components rather than inferred only from aggregate FV occupancy.

## Summary

The default `sylica-sev-oss` image is larger than `debug-sev` in DXEFV:

```text
debug-sev             2,631,520 B
sylica-sev-oss        2,868,112 B
difference             +236,592 B
```

However, this comparison hides the reduction achieved by Sylica because Secure Boot is enabled by default.

Without Secure Boot:

```text
debug-sev             2,631,520 B
sylica-sev-oss        2,007,952 B
difference             -623,568 B
```

Sylica therefore reduces the underlying DXE firmware footprint by approximately **609 KiB (23.7%)** relative to `debug-sev`.

Enabling Sylica's Secure Boot configuration adds approximately **840 KiB of expanded DXE content**, primarily associated with the image-verification path including `DxeImageVerificationLib` and `SecurityStubDxe`.

The larger default firmware image is consequently not evidence of additional general-purpose firmware functionality. It is predominantly the result of an intentional security feature enabled by default.
