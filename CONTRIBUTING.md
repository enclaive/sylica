# Contributing to Sylica

Thank you for your interest in contributing to Sylica.

Sylica is an enterprise-grade confidential VM firmware distribution for Intel TDX and AMD SEV-SNP. Because firmware
establishes the trusted foundation for confidential computing, contributions are subject to a higher level of security
and review discipline than typical software projects.

We welcome contributions that improve security, correctness, portability, reproducibility, documentation, testing, and developer experience.

## Before You Start

Please read:

* [`README.md`](README.md) for an overview of Sylica
* [`SECURITY.md`](SECURITY.md) for reporting security vulnerabilities
* [`docs/reproducibility.md`](docs/reproducibility.md) for reproducible builds

[//]: # (FIXME: Three dead links)
and:

* [`SylicaPkg/docs/TCB.md`](SylicaPkg/docs/TCB.md) for the trusted computing base
* [`SylicaPkg/docs/ARCHITECTURE.md`](SylicaPkg/docs/ARCHITECTURE.md) for the architecture
* [`SylicaPkg/docs/THREAT-MODEL.md`](SylicaPkg/docs/THREAT-MODEL.md) for security assumptions

By contributing to Sylica, you agree that your contributions are provided under the applicable project licence and contribution terms.

## Contribution Principles

Sylica follows these principles:

1. **Security first** — security takes precedence over convenience.
2. **Minimal TCB** — avoid introducing code or dependencies into the trusted computing base unless necessary.
3. **Reproducibility** — builds and measurements should be deterministic wherever technically possible.
4. **Verifiability** — security properties should be independently testable and verifiable.
5. **Small changes** — prefer focused, reviewable pull requests.
6. **Upstream compatibility** — changes should remain as compatible as reasonably possible with upstream edk2.
7. **Documentation** — security-relevant behaviour and architectural decisions must be documented.

## Repository Structure

The repository is organised roughly as follows:

```text
sylica/
├── docs/                  # Main Documentation
├── edk2/                  # Pinned upstream edk2 source
├── platforms/             # Platform-specific integration
├── reproduce              # Reproducible build tooling
├── scripts/
├── SylicaOss/             # Open-source Sylica components
│   ├── Patches/           # Files and diffs dropped into edk2
│   ├── Library/           # Libraries used by upstream components
│   ├── Include/           # Includes used internally
│   └── Driver/            # Custom drivers
├── SylicaPkg/             # Sylica-specific enterprise components
│   ├── configs/           # Build and platform configuration
│   ├── docs/              # Architecture and security documentation
│   └── security/          # Security-related material
└── verify/                # Measurement and verification tooling
```

Changes should be made in the appropriate component rather than duplicating functionality across directories.

## Development Environment

Sylica uses edk2 and its associated firmware build toolchain.

Before making changes, ensure that you can:

1. initialise the repository and submodules;
2. build an unmodified Sylica configuration;
3. run the available tests and validation tools;
4. reproduce the expected measurements where supported.

The canonical build and development procedures are documented in:

[`docs/build.md`](docs/build.md)

Development tooling should use the pinned toolchain and dependency versions wherever possible.

## Making Changes

Create a dedicated branch for each change:

```bash
git checkout -b feature/my-change
```

Keep changes focused. A pull request should normally address one logical problem.

Avoid combining unrelated changes such as:

* refactoring;
* formatting changes;
* dependency upgrades;
* feature development;
* documentation changes.

If such changes are necessary, explain the relationship in the pull request.

## Code Style

Follow the existing style of the relevant edk2 or Sylica component.

For new code:

* prefer simple and explicit implementations;
* avoid unnecessary dependencies;
* minimise code in security-sensitive paths;
* avoid unnecessary dynamic allocation;
* validate all external inputs;
* handle failure paths explicitly;
* avoid introducing undefined or implementation-dependent behaviour;
* document security assumptions where they are not obvious.

Do not perform broad formatting changes in security-sensitive source files unless required.

## Security-Sensitive Changes

Firmware changes can affect the security guarantees of the entire confidential VM.

Treat the following as security-sensitive:

* secure boot;
* measured boot;
* TDX integration;
* SEV-SNP integration;
* firmware measurement;
* attestation;
* memory isolation;
* page validation;
* cryptographic operations;
* key handling;
* secret provisioning;
* guest/hypervisor boundaries;
* firmware update mechanisms;
* platform configuration affecting security;
* changes to the firmware TCB.

Security-sensitive changes require additional explanation in the pull request.

At minimum, describe:

1. the security property being changed;
2. the relevant threat model;
3. the trust boundary affected;
4. whether the TCB changes;
5. whether measurements change;
6. how the change is tested;
7. whether existing attestation or verification procedures are affected.

If you discover a potential vulnerability, **do not open a public GitHub issue**. Follow the process in [`SECURITY.md`](SECURITY.md).

## TCB-Impacting Changes

Changes that add, remove, or modify code within the trusted computing base require particular scrutiny.

A TCB-impacting pull request should explicitly state:

```text
TCB impact:         Yes / No
Measurement impact: Yes / No
Attestation impact: Yes / No
Security boundary:  Changed / Unchanged
```

If the TCB is affected, explain:

* why the change is necessary;
* what code becomes trusted;
* which security properties depend on it;
* whether the TCB can be reduced further;
* how the change affects attack surface;
* how the resulting firmware can be independently verified.

Do not introduce a new dependency into the TCB merely for convenience.

## Measurement Changes

Changes that alter firmware measurements require explicit documentation.

A pull request that changes expected measurements should include:

* previous measurement;
* new measurement;
* reason for the change;
* affected platform;
* affected configuration;
* reproducibility evidence;
* impact on attestation policies.

Measurement changes should never be hidden as incidental build changes.

## Reproducible Builds

Sylica aims to provide reproducible firmware builds.

Contributors should avoid introducing sources of non-determinism such as:

* timestamps;
* random build identifiers;
* host-specific paths;
* environment-dependent configuration;
* unpinned dependencies;
* uncontrolled compiler or assembler versions.

When modifying the build system, verify that reproducibility remains intact.

See [`docs/reproducibility.md`](docs/reproducibility.md).

## Dependencies

New dependencies require justification.

Before introducing a dependency, consider:

* Does it increase the TCB?
* Is it required at runtime?
* Can existing functionality be reused?
* Is it actively maintained?
* What is its licence?
* Does it introduce additional transitive dependencies?
* Can its version be pinned?
* Can it be included without compromising reproducibility?
* Does it introduce additional attack surface?

Security-critical dependencies require additional review.

Update [`NOTICE.md`](NOTICE.md) when required.

## Documentation Changes

Documentation contributions are welcome and important.

Update documentation when a change affects:

* architecture;
* security assumptions;
* TCB composition;
* measurements;
* attestation;
* build procedures;
* supported platforms;
* configuration;
* reproducibility;
* deployment or operational behaviour.

Security-relevant documentation should be reviewed with the same care as security-relevant code.

## Branch Naming

Sylica uses the following branch naming convention:

```text
<type>/<short-description>
```

Branch names must use lowercase characters and hyphens.

### Branch Types

| Type           | Purpose                                         |
|----------------|-------------------------------------------------|
| `feature/`     | New functionality                               |
| `fix/`         | Bug fixes                                       |
| `security/`    | Security vulnerabilities and security hardening |
| `tcb/`         | Changes affecting the trusted computing base    |
| `measurement/` | Changes affecting firmware measurements         |
| `attestation/` | Attestation-related changes                     |
| `build/`       | Build system and toolchain changes              |
| `repro/`       | Reproducible-build changes                      |
| `platform/`    | Platform-specific changes                       |
| `upstream/`    | Upstream edk2 integration                       |
| `docs/`        | Documentation                                   |
| `ci/`          | Continuous integration and automation           |
| `refactor/`    | Refactoring without intended functional changes |
| `test/`        | Test-related changes                            |

Examples:

```text
feature/tdx-support
fix/page-validation
security/attestation-bypass
tcb/remove-unused-driver
measurement/deterministic-build
attestation/sev-snp-report
build/pin-edk2-toolchain
repro/remove-build-timestamp
platform/amd-genoa
upstream/edk2-update
docs/attestation-model
ci/reproducible-build
```

Security-sensitive changes must use the appropriate `security/`, `tcb/`, `measurement/`, or `attestation/` prefix rather than the generic `feature/` or `fix/` prefix.

Branch names should be concise and describe the purpose of the change. Avoid personal names, spaces, uppercase characters, and unnecessarily long descriptions.

## Commit Messages

Use concise, descriptive commit messages.

Prefer:

```text
tdx: validate shared memory before accepting page
```

over:

```text
fix stuff
```

A commit should describe the intent of the change rather than simply the implementation.

Keep commits logically separated where practical.

## Pull Requests

Before opening a pull request:

```bash
git status
git diff
```

Review the complete change and ensure that no unintended files, credentials, build artefacts, or generated files are included.

A pull request should contain:

### Summary

What does this change do?

### Motivation

Why is the change necessary?

### Design

How does the implementation work?

### Security impact

Describe relevant security implications.

### TCB impact

State whether the TCB changes.

### Measurement impact

State whether firmware measurements change.

### Testing

Describe the tests performed.

### Reproducibility

Describe any relevant reproducibility verification.

### Compatibility

Describe compatibility with existing Sylica and upstream edk2 functionality.

### Example

A security-sensitive pull request might contain:

```text
Summary:
Add validation of the TDX shared-memory boundary before accepting a page.

Motivation:
Prevent acceptance of pages outside the expected shared-memory range.

Security impact:
Reduces the attack surface at the guest/hypervisor boundary.

TCB impact:
No new TCB components.

Measurement impact:
Yes. The affected firmware binary changes.

Testing:
- Unit tests
- TDX integration test
- Reproducible build
- Measurement verification

Reproducibility:
Verified against the canonical Sylica build container.

Compatibility:
No change to the public firmware configuration.
```

## Review Requirements

All changes require review before merging.

Additional review may be required for:

* TCB changes;
* security-sensitive code;
* measurement changes;
* attestation changes;
* cryptographic code;
* platform security mechanisms;
* changes to the edk2 submodule;
* build and reproducibility infrastructure.

Sylica maintainers may request additional testing, security analysis, or independent review before accepting a change.

Review approval does not imply that the reviewer guarantees the absence of security vulnerabilities.

## Upstream edk2

Sylica incorporates upstream edk2 as a pinned dependency.

Changes that belong upstream should preferably be developed in a form that can also be contributed upstream.

When modifying behaviour originating from edk2:

* identify the relevant upstream component;
* explain why Sylica requires the change;
* preserve upstream compatibility where possible;
* avoid unnecessary divergence;
* document any intentional divergence.

Do not modify the pinned edk2 revision without explicit review.

## Testing

At minimum, contributors should run the tests relevant to their change.

Depending on the affected area, this may include:

* build validation;
* unit tests;
* firmware boot tests;
* TDX tests;
* SEV-SNP tests;
* measurement verification;
* attestation verification;
* reproducibility checks;
* static analysis;
* CI checks.

Do not claim tests were performed if they were not.

If hardware is unavailable, clearly state the limitation in the pull request.

## Generated Files and Build Artefacts

Do not commit generated build artefacts unless the repository explicitly requires them.

Examples include:

* firmware binaries;
* temporary build directories;
* compiler output;
* debug logs;
* host-specific configuration;
* temporary measurement files.

If a generated artefact is intentionally committed, document why it is part of the source distribution.

## Reporting Bugs

For non-security bugs, open a GitHub issue with:

* Sylica version or commit;
* platform;
* CPU and firmware environment;
* configuration;
* reproduction steps;
* expected behaviour;
* actual behaviour;
* relevant logs;
* measurement information where applicable.

Please remove secrets and sensitive information before submitting logs.

## Security Vulnerabilities

Please do **not** report security vulnerabilities through public GitHub issues, pull requests, or discussions.

Follow the private disclosure procedure described in [`SECURITY.md`](SECURITY.md).

Security reports should contain enough information to reproduce and assess the issue, while avoiding unnecessary disclosure of exploit details before a coordinated resolution.

## Licensing

Contributions to Sylica must comply with the project's licensing requirements.

Before contributing, review:

* [`LICENSE`](LICENSE)
* [`LICENSE-NFSL-1.0.md`](LICENSE-NFSL-1.0.md)
* [`LICENSE-SYLICA.md`](LICENSE-SYLICA.md)
* [`NOTICE.md`](NOTICE.md)

Contributors must have the right to submit the code they contribute.

Do not submit proprietary or third-party code unless its licence permits the intended use and the required attribution and notices are provided.

## Contributor Agreement

If Sylica requires a Contributor License Agreement (CLA) or Developer Certificate of Origin (DCO), the applicable requirement will be documented here and enforced through the contribution workflow.

Until then, contributors should ensure that they have the legal right to submit their contributions under the project's applicable licence.

## Code of Conduct

All contributors are expected to follow the project's [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Maintainers

Sylica is maintained by the Sylica maintainers.

Maintainers are responsible for:

* reviewing contributions;
* protecting the project's security properties;
* maintaining the TCB;
* evaluating measurement and attestation impact;
* managing releases;
* coordinating security disclosures;
* maintaining upstream compatibility.

The maintainers may reject changes that technically work but materially weaken the security model, reproducibility, maintainability, or long-term architecture of Sylica.

## Questions

For general questions, use the project's supported public communication channels described in [`SUPPORT.md`](SUPPORT.md).

For security vulnerabilities, always use the private reporting process in [`SECURITY.md`](SECURITY.md).

Thank you for helping improve Sylica.
