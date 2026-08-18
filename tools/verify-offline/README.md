## Purpose
This tool verifies Sylica release artifacts' cryptographic signatures (stored in `sigstore.json` attestation files) **without requiring the GitHub CLI**. This enables offline verification of firmware authenticity.

## Key Functionality
- **Reads a Sigstore bundle** (the `sigstore.json` attestation file)
- **Computes the SHA256 digest** of the firmware asset being verified
- **Validates the attestation** against the asset using Sigstore's trust root and verification policies
- **Outputs the verified attestation payload** as JSON (in-toto statement format)

## How It Works
1. Takes a Sigstore bundle file and an asset file (firmware) as input
2. Requires a `trusted_root.json` file (containing Sigstore's public trust anchors) — obtained via `gh attestation trusted-root`
3. Uses libraries from `sigstore-go` and the GitHub CLI to verify signatures cryptographically
4. Returns the verified attestation statement if successful, or an error if verification fails

## Usage
```bash
# Download Sigstore's trusted roots (one-time setup)
gh attestation trusted-root > trusted_root.json

# Verify a downloaded release attestation against an asset
./verify ORG-REPO-attestation-ID.sigstore.json firmware.fd
```

## Why It Matters
The Sylica project releases firmware with cryptographic attestations. This tool lets users verify that released binaries are authentic and haven't been tampered with, even without access to GitHub's CLI tools or network connectivity.
