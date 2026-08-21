# Sylica Tools

The `tools/` directory contains utilities for calculating confidential-computing measurements and verifying Sylica release provenance.

```text
tools/
├── measure-browser/
├── tdx-measure/
└── verify-offline/
```

The tools cover three different parts of the verification workflow:

```text
Firmware / attestation data
          │
          ├── measure-browser
          │      └── interactive browser-based verification
          │
          ├── tdx-measure
          │      └── Intel TDX MRTD / RTMR calculations
          │
          └── verify-offline
                 └── release provenance verification
```

| Tool                                  | Purpose                                                          | Platform              |
| ------------------------------------- | ---------------------------------------------------------------- | --------------------- |
| [`measure-browser`](measure-browser/) | Interactive browser-based measurement and attestation inspection | Intel TDX and AMD SEV-SNP |
|                                       | available online: [https://enclaive.github.io/sylica/](https://enclaive.github.io/sylica/)                      |            |
| [`tdx-measure`](tdx-measure/)         | Calculate Intel TDX firmware measurements                        | Intel TDX             |
| [`verify-offline`](verify-offline/)   | Verify Sylica release attestations and artifact integrity        | Release supply chain  |

These tools complement the higher-level verification scripts under `verify/` and the `measurements.json` files published with Sylica releases.

## Verification Model

Sylica separates release verification from runtime measurement verification.

```text
Sylica source
     │
     ▼
Reproducible build
     │
     ▼
CVMF.fd
     │
     ├───────────────┐
     ▼               ▼
release         expected confidential
provenance       VM measurements
     │               │
     ▼               ▼
verify-offline   tdx-measure /
                  measurement tooling
                     │
                     ▼
               attestation report
```

The tools therefore answer different questions.

**`verify-offline`**

> Did the expected Sylica release process attest this artifact or checksum manifest?

**`tdx-measure`**

> What Intel TDX measurement should this firmware and VM configuration produce?

**`measure-browser`**

> How does the supplied attestation and measurement data compare interactively?

A complete confidential-computing trust decision normally combines release provenance, firmware identity, expected measurements, and hardware-backed attestation.

---

# `measure-browser`

`tools/measure-browser` provides an interactive, browser-based interface for confidential-computing measurement and attestation analysis.

It is designed for situations where an operator or security engineer wants to inspect verification data without manually using command-line tools.

The tool runs as a small local web application:

```text
Browser
   │
   ▼
static JavaScript application
   │
   ├── cryptographic processing
   ├── binary parsing
   └── measurement verification
   │
   ▼
local Python HTTP server
```

The cryptographic processing runs primarily in the browser. The Python server is used to serve the static application.

## Main components

```text
measure-browser/
├── README.md
├── server.py
├── vendor.sh
└── static/
```

### `server.py`

Starts the local HTTP server used to serve the application.

Typical usage:

```bash
cd tools/measure-browser

python3 server.py
```

The application is then available at:

```text
http://localhost:8080
```

### `vendor.sh`

Downloads and vendors the JavaScript dependencies required by the browser application.

Run it before starting the application if the vendored dependencies are not already present:

```bash
cd tools/measure-browser

./vendor.sh
python3 server.py
```

Vendoring avoids relying on external CDNs when the application executes and fixes the dependency versions used by the tool.

The frontend uses libraries including:

* PKI.js;
* ASN.1.js;
* `@noble/hashes`;
* binary and PKI utility libraries.

## Typical workflow

```text
attestation / measurement files
              │
              ▼
        drag into browser
              │
              ▼
       parse and calculate
              │
              ▼
       display verification
              │
              ▼
          operator review
```

The browser tool is particularly useful for:

* manual attestation analysis;
* comparing expected and observed measurements;
* demonstrations;
* troubleshooting confidential VM launches;
* reviewing attestation evidence without building a dedicated verifier.

For automated CI or policy enforcement, prefer machine-readable command-line tooling.

See [`measure-browser/README.md`](measure-browser/README.md) for detailed usage.

---

# `tdx-measure`

`tools/tdx-measure` calculates measurements used by the Intel TDX attestation model.

The toolset currently provides calculations for:

* **MRTD** — the initial measurement of the Trust Domain;
* **RTMR0-related state** — measurements extended during the TD firmware boot process.

The directory contains:

```text
tdx-measure/
├── README.md
├── _library.py
├── mrtd.py
└── rtmr0.py
```

The implementation is written in Python and is based on upstream TDX measurement tooling adapted for Sylica.

## MRTD

`MRTD` represents the initial measured state of a TDX Trust Domain.

For CVMF, this includes the firmware pages populated as part of initial TD construction.

Calculate MRTD with:

```bash
python3 tools/tdx-measure/mrtd.py <firmware-image>
```

For example:

```bash
python3 tools/tdx-measure/mrtd.py \
    platform-sylica-tdx-oss/CVMF.fd
```

The tool parses the TDVF metadata embedded in the firmware and reproduces the measurement operations used during TD construction.

Conceptually:

```text
CVMF.fd
   │
   ▼
TDVF metadata
   │
   ▼
measured memory regions
   │
   ▼
TDX measurement algorithm
   │
   ▼
MRTD
```

The resulting value can be compared with the corresponding field in TDX attestation evidence.

## RTMR0

TDX also provides Runtime Measurement Registers (RTMRs).

`rtmr0.py` calculates the expected RTMR0-related measurement for a particular firmware image and guest-memory configuration.

Usage:

```bash
python3 tools/tdx-measure/rtmr0.py \
    <firmware-image> \
    <guest-memory-size>
```

For example:

```bash
python3 tools/tdx-measure/rtmr0.py \
    platform-sylica-tdx-oss/CVMF.fd \
    2G
```

Memory sizes may be expressed using formats such as:

```text
128m
2G
0x80000000
```

The guest-memory size matters because parts of the TDX firmware state and TD hand-off structures depend on the VM memory layout.

## Integration with Sylica verification

The TDX measurement scripts are consumed by Sylica's verification tooling to generate release measurement metadata.

Conceptually:

```text
CVMF.fd
   │
   ├── mrtd.py
   │      └── MRTD
   │
   └── rtmr0.py
          └── RTMR0 values for supported memory sizes
                 │
                 ▼
          measurements.json
```

A Sylica release can therefore publish expected measurements before the VM is launched.

At runtime:

```text
measurements.json
        │
        │ expected
        ▼
     MRTD / RTMR
        │
        │ compare
        ▼
TDX attestation quote
```

This makes TDX measurements reproducible and usable in attestation policies.

See [`tdx-measure/README.md`](tdx-measure/README.md) for command details and supported input formats.

---

# `verify-offline`

`tools/verify-offline` verifies Sylica release attestations without requiring the normal `gh attestation verify` command during verification.

The implementation is written in Go and uses Sigstore and GitHub attestation verification libraries.

```text
verify-offline/
├── README.md
├── main.go
├── go.mod
└── go.sum
```

Its purpose is **release provenance verification**, not confidential-VM runtime attestation.

## What it verifies

Sylica releases publish cryptographic attestation bundles alongside their release checksum manifests.

The verification chain is:

```text
Sylica release workflow
          │
          ▼
    checksum manifest
          │
          ▼
  Sigstore attestation
          │
          ▼
   attestation.json
```

`verify-offline` takes:

1. an attestation bundle;
2. one or more local assets;
3. a local Sigstore trusted root;

and verifies that the asset digest is covered by a valid attestation.

The tool computes the SHA-256 digest of the supplied asset and applies the Sigstore verification policy.

## Build

Build the tool with Go:

```bash
cd tools/verify-offline

go build -o verify .
```

## Trusted root

The verifier requires:

```text
trusted_root.json
```

This contains the Sigstore trust anchors used to verify the attestation.

It can initially be obtained using:

```bash
gh attestation trusted-root > trusted_root.json
```

Once the trusted root, release attestation, and release files have been transferred to the verification system, the verification itself can be performed locally.

## Usage

```bash
./verify <attestation-bundle> <asset>
```

For example:

```bash
./verify \
    attestation.json \
    sha256sums
```

Multiple assets can also be supplied:

```bash
./verify \
    attestation.json \
    sha256sums \
    b2sums
```

A successful verification prints the verified in-toto attestation statement as JSON.

Failure results in a non-zero exit status.

## Verification scope

It is important to distinguish what this tool establishes.

It verifies release provenance:

```text
attestation.json
       +
trusted_root.json
       +
release asset
       │
       ▼
cryptographic verification
       │
       ▼
verified provenance statement
```

It does **not** verify that a running VM is using the expected firmware.

Runtime verification requires confidential-computing attestation:

```text
released CVMF.fd
       │
       ▼
expected measurement
       │
       ▼
SEV-SNP / TDX report
       │
       ▼
runtime attestation verification
```

The two mechanisms are complementary.

See [`verify-offline/README.md`](verify-offline/README.md) for details.

---

# How the Tools Fit Together

A complete Sylica verification workflow can use all three tool categories.

```text
                    Sylica Release
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
       attestation.json             CVMF.fd
              │                        │
              ▼                        ▼
       verify-offline          expected measurements
              │                        │
              ▼             ┌──────────┴──────────┐
       release provenance   ▼                     ▼
                       TDX measurement      SNP measurement
                           tools                tooling
                              │
                              ▼
                      measurements.json
                              │
                              ▼
                    confidential VM launch
                              │
                              ▼
                      attestation evidence
                              │
                              ▼
                       measure-browser
                              │
                              ▼
                      verification result
```

The intended separation is:

| Stage                      | Tool              | Security question                                        |
| -------------------------- | ----------------- | -------------------------------------------------------- |
| Release provenance         | `verify-offline`  | Did the expected release process attest this artifact?   |
| TDX measurement generation | `tdx-measure`     | What MRTD/RTMR values should this TDX VM produce?        |
| Interactive inspection     | `measure-browser` | Does supplied attestation data match the expected state? |

For production automation, these tools can be combined with the scripts under `verify/` and the `measurements.json` files distributed with each Sylica release.

## Related Documentation

* [`../docs/verification.md`](../docs/verification.md) — firmware and attestation verification
* [`../docs/reproducibility.md`](../docs/reproducibility.md) — reproduce Sylica firmware from source
* [`measure-browser/README.md`](measure-browser/README.md) — browser measurement tool
* [`tdx-measure/README.md`](tdx-measure/README.md) — Intel TDX measurement tools
* [`verify-offline/README.md`](verify-offline/README.md) — offline release attestation verifier

I used `verify-offline` because that is the directory currently present in `tools/`; there is no `verify-online` directory in the repository.  The TDX tooling computes MRTD and RTMR0-related values, while the offline verifier checks Sigstore/GitHub release provenance rather than guest attestation.
