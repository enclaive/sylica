# Purpose

The **tdx-measure** toolset computes Intel TDX firmware measurements used to verify Trusted Domain (TD) firmware images. It produces:

- **MRTD** — the build-time measurement of the initial TD memory (the base OVMF/TDVF image), and
- **RTMR0 values** — the measurement that would be extended into RTMR0 (TD-HOB + CVF after the separator) for a given guest RAM size.

# Key Functionality

- **`mrtd.py`** — compute the MRTD for an OVMF/TDVF firmware image.
- **`rtmr0.py`** — compute the RTMR0 measurement for a given firmware image and guest memory size.
- Integrates with repository verification tooling (e.g., `verify/file.sh`) to produce structured JSON verification output mapping memory sizes to measurements.

# How It Works (High-Level)

1. The scripts parse the firmware's GUIDed configuration tables and the TDVF metadata descriptor.
2. They validate metadata fields, section attributes, and page alignments to ensure the image contains valid TDVF sections.
3. Following TDX measurement semantics (ported from upstream tooling), they construct the measured data structures and compute cryptographic hashes to derive MRTD and RTMR0 values.
4. Output is printed to `stdout` so wrapper scripts can aggregate results into JSON for CI and verification workflows.

# Usage

## Requirements

- Python 3
- Standard Python library modules used by the scripts (e.g., `hashlib`, `struct`, `argparse`, `dataclasses`, `pathlib`)
- `jq` (optional) — when aggregating outputs in shell scripts like `verify/file.sh`

## Commands

Compute MRTD:

```sh
python tools/tdx-measure/mrtd.py <firmware-image>
```

Compute RTMR0 (requires memory size):

```sh
python tools/tdx-measure/rtmr0.py <firmware-image> <memory-size>
```

## Memory Size Format

Accepts decimal, `0x`-prefixed hex, or `K`/`M`/`G` suffixes (case-insensitive). For example:

- `128m`
- `2G`
- `0x80000000`

## Example Integration (used by `verify/file.sh`)

Compute the base MRTD once and compute RTMR0 across sizes:

```sh
OVMF_HASH=$(tools/tdx-measure/mrtd.py ovmf.bin)
tools/tdx-measure/rtmr0.py ovmf.bin 128m
```

The repository's verify script runs `rtmr0.py` for a range of sizes (`128m` → `128g`) and collects the outputs into a JSON object keyed by memory size.

# Why It Matters

- TDX measurements are essential for reproducible verification, attestation, and detection of firmware tampering for confidential VMs.
- Automating MRTD and RTMR0 calculation makes firmware verification practical in CI pipelines, audits, and supply-chain validation.
- Providing these values in machine-readable form simplifies downstream verification and policy enforcement.

# Notes & Attribution

- The scripts in this directory are ported from the upstream project (see [virtee/tdx-measure](https://github.com/virtee/tdx-measure)) and adapted for this repository.
- The tools perform strict validation and will error if the firmware image lacks expected TDVF metadata or has invalid alignment/sizing.
- See the source scripts (`mrtd.py`, `rtmr0.py`, and supporting library) for implementation details.

# License

See this repository's [LICENSE](../../LICENSE) and the upstream project's license for attribution and reuse terms.
