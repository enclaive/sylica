# Verifying Reproducible Builds

Sylica provides an automated verification procedure to confirm that a firmware build is reproducible.

The verification builds the same platform twice from the same source tree using the isolated Sylica build environment and compares the SHA-256 digest of the resulting firmware images.

A successful verification establishes that both builds produced a **byte-for-byte identical firmware image**.

For background on the inputs and mechanisms that make Sylica builds deterministic, see [Reproducible Builds](reproducibility.md).

## Verification model

Reproducibility verification answers the following question:

> Does the same Sylica source and pinned build environment produce exactly the same firmware binary when built independently?

The verification process is:

```text
                 Sylica source
                       │
              pinned dependencies
                       │
                       ▼
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
          isolated          isolated
           build 1           build 2
              │                 │
              ▼                 ▼
           CVMF.fd           CVMF.fd
              │                 │
              ▼                 ▼
           SHA-256           SHA-256
              │                 │
              └────────┬────────┘
                       │
                       ▼
                    compare
                       │
              ┌────────┴────────┐
              ▼                 ▼
            equal            different
              │                 │
              ▼                 ▼
       REPRODUCIBLE      NOT REPRODUCIBLE
```

The verification is implemented by:

```text
scripts/verify-reproducibility.sh
```

## Prerequisites

Verification requires:

* Git
* Docker with BuildKit support
* the Sylica repository
* access to the dependencies required to initialize the Git submodules

The firmware compilation itself runs inside the build environment defined by `reproduce/Dockerfile`.

No host compiler or locally installed edk2 toolchain is used for the firmware build.

## Verify a platform

The verification script accepts a Sylica platform as its argument:

```bash
scripts/verify-reproducibility.sh <platform>
```

For AMD SEV-SNP:

```bash
scripts/verify-reproducibility.sh sylica-sev
```

For Intel TDX:

```bash
scripts/verify-reproducibility.sh sylica-tdx
```

The same verification mechanism applies to both platforms. The platform-specific differences affect the firmware configuration and confidential-computing measurements, but not the reproducibility test itself.

Available platform definitions are stored under:

```text
platforms/
```

See [Platforms](platforms.md) for the supported platform variants.

## What the verification script does

`scripts/verify-reproducibility.sh` performs the following operations.

### 1. Validate the platform

The requested platform must have a corresponding configuration:

```text
platforms/<platform>.json
```

For example:

```text
platforms/sylica-sev.json
platforms/sylica-tdx.json
```

An unknown platform causes verification to stop before a build is started.

### 2. Initialize pinned source dependencies

The script initializes the Sylica edk2 submodule:

```bash
git submodule update --init --depth 1
```

and the submodules required by edk2:

```bash
git -C edk2 submodule update --init --depth 1
```

The Git revisions themselves are pinned by the repository and its submodule metadata.

This ensures that both verification builds use the same firmware source dependencies.

### 3. Perform the first isolated build

The script builds the selected platform using:

```bash
docker build \
    -f reproduce/Dockerfile \
    --target artifact \
    --build-arg PLATFORM=<platform> \
    --build-arg BUILD_ENV=<build-environment> \
    --no-cache-filter=build \
    -o out/verify-1 \
    .
```

The `artifact` target exports the generated firmware rather than leaving it inside the container image.

The build stage is explicitly excluded from Docker's layer cache using:

```text
--no-cache-filter=build
```

This forces the firmware compilation to execute again instead of accepting a previously cached firmware build result.

The resulting artifact is stored below:

```text
out/verify-1/<platform>/
```

For Sylica confidential-VM firmware, the firmware image is normally:

```text
CVMF.fd
```

### 4. Calculate the first firmware digest

The script calculates:

```text
SHA256(CVMF.fd)
```

using `sha256sum`.

For example, the output contains:

```text
build 1: <sha256>
```

The SHA-256 digest represents the complete firmware binary. If any byte of the firmware differs, the resulting digest will differ.

### 5. Perform a second isolated build

Unless explicitly disabled for CI or diagnostic purposes, the script performs the complete build operation a second time.

The second build uses the same:

* source tree;
* platform configuration;
* pinned dependencies;
* build environment;
* Dockerfile; and
* build arguments.

The build stage is again executed with:

```text
--no-cache-filter=build
```

The second artifact is exported to:

```text
out/verify-2/<platform>/
```

and its SHA-256 digest is calculated.

The output contains:

```text
build 2: <sha256>
```

### 6. Compare the firmware digests

The two SHA-256 values are compared:

```text
SHA256(build 1/CVMF.fd)
             ==
SHA256(build 2/CVMF.fd)
```

If they are identical, the script reports:

```text
REPRODUCIBLE
```

and exits successfully.

If they differ, the script reports:

```text
NOT REPRODUCIBLE
```

and exits with an error.

## Successful verification

A successful run looks conceptually like:

```text
build 1: 81b7...c429
build 2: 81b7...c429
REPRODUCIBLE
```

This establishes:

```text
same source
    +
same pinned build environment
    +
independent firmware compilation
          │
          ▼
byte-identical CVMF.fd
```

Because SHA-256 is calculated over the complete firmware image, matching digests provide practical evidence that the two generated firmware binaries are byte-for-byte identical.

## AMD SEV-SNP and Intel TDX

Reproducibility verification is deliberately platform-independent.

For AMD SEV-SNP:

```bash
scripts/verify-reproducibility.sh sylica-sev
```

For Intel TDX:

```bash
scripts/verify-reproducibility.sh sylica-tdx
```

Both execute the same double-build and firmware-digest comparison.

The distinction between SEV-SNP and TDX becomes relevant **after** the firmware artifact has been reproduced, when the expected confidential-computing measurements are calculated.

Conceptually:

```text
                         reproducibility
                              │
                  ┌───────────┴───────────┐
                  │                       │
             sylica-sev              sylica-tdx
                  │                       │
                  ▼                       ▼
               CVMF.fd                 CVMF.fd
                  │                       │
                  ▼                       ▼
          identical SHA-256       identical SHA-256
                  │                       │
                  ▼                       ▼
        expected SNP launch       expected TDX
            measurement           measurement
```

The first part verifies the build artifact. The second part is platform-specific attestation measurement verification.

These should not be confused:

* the **firmware SHA-256** identifies the firmware file;
* the **SEV-SNP launch measurement** identifies measured initial guest state on AMD SEV-SNP;
* the **TDX measurements** identify measured initial TD state and subsequent measurement extensions on Intel TDX.

A reproducible firmware build therefore does not imply that SEV-SNP and TDX have identical measurement procedures.

## Using a specific build environment

The script supports overriding the build environment through the `BUILD_ENV` environment variable.

By default:

```text
BUILD_ENV=env
```

A different environment can be supplied when required by the build infrastructure:

```bash
BUILD_ENV=<environment> \
    scripts/verify-reproducibility.sh sylica-sev
```

For release verification, the build environment must correspond to the environment declared for that release. Changing the build environment changes one of the inputs to the reproducible build and therefore invalidates a direct reproducibility comparison unless the alternative environment is intentionally being tested.

## Single-build mode

The script supports:

```text
SKIP_COMPARE=true
```

For example:

```bash
SKIP_COMPARE=true \
    scripts/verify-reproducibility.sh sylica-sev
```

In this mode, only the first isolated build is performed.

The script prints:

```text
Skipping second build
```

and exits without comparing two firmware artifacts.

This mode is useful for build automation or diagnostics where only an isolated firmware build is required.

It **does not verify reproducibility** because no second independently compiled artifact exists for comparison.

A reproducibility claim therefore requires the normal double-build mode.

## Verify a published release

The double-build test verifies that a source tree builds deterministically.

Verifying a published release requires an additional comparison:

```text
                   release source
                         │
                         ▼
                reproducibility test
                         │
                  ┌──────┴──────┐
                  ▼             ▼
               build 1       build 2
                  │             │
                  └──────┬──────┘
                         │
                   hashes equal
                         │
                         ▼
                reproduced firmware
                         │
                         ▼
                  published digest
                         │
                         ▼
                      compare
```

First check out the exact release:

```bash
git clone https://github.com/enclaive/sylica.git
cd sylica
git checkout <release-tag>
```

Then run:

```bash
scripts/verify-reproducibility.sh sylica-sev
```

or:

```bash
scripts/verify-reproducibility.sh sylica-tdx
```

After successful reproducibility verification, calculate the digest of the resulting firmware:

```bash
sha256sum out/verify-1/sylica-sev/CVMF.fd
```

For TDX:

```bash
sha256sum out/verify-1/sylica-tdx/CVMF.fd
```

Compare this value with the SHA-256 digest published with the corresponding Sylica release.

Both conditions should hold:

```text
SHA256(build 1) == SHA256(build 2)

and

SHA256(build 1) == SHA256(published firmware)
```

The first condition establishes deterministic reproduction.

The second establishes that the reproduced artifact corresponds to the firmware distributed with the release.

## What successful verification proves

A successful double-build comparison demonstrates that, for the tested source tree and build environment:

1. two isolated firmware compilations produced the same output;
2. the resulting firmware images are byte-for-byte identical;
3. no observed build-time nondeterminism changed the resulting firmware.

When the resulting digest also matches the published release digest, it additionally establishes that the locally reproduced firmware is identical to the published firmware artifact.

This creates the following verification chain:

```text
published source
       │
       ▼
pinned build environment
       │
       ▼
independent rebuild
       │
       ▼
reproduced CVMF.fd
       │
       ▼
SHA-256
       │
       ▼
published SHA-256
       │
       ▼
     MATCH
```

## What reproducibility verification does not prove

A successful reproducibility test does not by itself establish that:

* the source code is free from vulnerabilities;
* the compiler or build tools are trustworthy;
* the source revision was correctly reviewed;
* the published source repository was not compromised;
* a running confidential VM is using the reproduced firmware;
* the host platform satisfies an SEV-SNP or TDX security policy;
* the guest operating system or workload is trusted.

These properties require additional controls such as source review, supply-chain security, release provenance, hardware-backed remote attestation, and workload-specific policy verification.

In particular:

```text
reproducibility
      │
      ▼
"What firmware binary should exist?"

remote attestation
      │
      ▼
"What measured environment is actually running?"
```

Both are required when Sylica firmware identity is used as part of a confidential-computing trust decision.

## Troubleshooting

If the script reports:

```text
NOT REPRODUCIBLE
```

retain both output directories:

```text
out/verify-1/<platform>/
out/verify-2/<platform>/
```

and first confirm the firmware hashes manually:

```bash
sha256sum \
    out/verify-1/<platform>/CVMF.fd \
    out/verify-2/<platform>/CVMF.fd
```

Then verify the repository state:

```bash
git status
git rev-parse HEAD
git submodule status --recursive
```

Typical causes of nondeterministic firmware output include:

* timestamps embedded in generated files;
* random build-time values;
* unpinned tools or dependencies;
* generated files whose ordering is unstable;
* host information leaking into the build;
* absolute build paths;
* environment-dependent build behavior.

Sylica fixes known nondeterministic inputs through its pinned build environment, fixed `SOURCE_DATE_EPOCH`, pinned dependencies, and deterministic stack-cookie handling.

See [Reproducible Builds](reproducibility.md) for details.

## CI verification

Sylica CI runs reproducibility verification for the supported platform matrix.

The same script used by developers and independent verifiers is used by CI:

```bash
scripts/verify-reproducibility.sh <platform>
```

Using the repository verification script avoids maintaining a separate CI-only implementation of the reproducibility test.

The verification path is therefore the same whether it is executed:

* during development;
* in continuous integration;
* before a release; or
* independently by a third-party verifier.

This makes reproducibility a directly testable property of the Sylica build rather than only a property asserted by the release process.
