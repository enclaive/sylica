## Release verification

This is a utility command for verifying the `sigstore.json` release attestation without the GitHub CLI.

### Building

```bash
CGO_ENABLED=0 go build .
```

### Usage

```bash
# download public trusted roots
gh attestation trusted-root > trusted_root.json

# verify an already downloaded sigstore.json
./verify ORG-REPO-attestation-ID.sigstore.json <asset>
```