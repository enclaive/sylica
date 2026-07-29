# Reproducibility

The same source commit always produces bit-identical firmware. This is the base of the Sylica trust model: anyone can
rebuild a release from source and confirm the published binary and its launch measurement.

## Verification

```bash
scripts/verify-reproducibility.sh <platform>
```

Runs the isolated build twice, the second time bypassing the container layer cache for the build stage, and fails unless
both firmware hashes match. CI runs this for every platform on every pull request.

## Pinned inputs

| Input              | Pin                                                                                       |
|--------------------|-------------------------------------------------------------------------------------------|
| edk2 source        | git submodule locked to a release tag, recursive submodules included                      |
| Base image         | `ubuntu:22.04` by digest                                                                  |
| Toolchain packages | `snapshot.ubuntu.com` at a fixed snapshot date, versions recorded in `tools-manifest.txt` |
| Timestamps         | `SOURCE_DATE_EPOCH` fixed in `reproduce/SOURCE_DATE_EPOCH`                                |
| Stack cookies      | `reproduce/StackCookieValues32.json`, `reproduce/StackCookieValues64.json`                |

## Stack cookies

`SylicaOssSev.dsc` enables `StackCheckLib`. EDK2 BaseTools normally generates random per-module stack cookie values for
every fresh build directory, which makes each build unique and breaks reproducibility. Sylica pins these values in the
repository; the inner build script seeds them into the build directory before compiling, and BaseTools only generates
values when the files are absent.

This does not weaken the mitigation: firmware binaries are published, so build-time cookie values are public regardless
of how they are generated. DXE and UEFI drivers replace the cookie with a random value at every boot (`DynamicStackCookieEntryPointLib`, hardware RNG).
PEI keeps the build-time value, unchanged from stock edk2 behavior.

## Rebuilding a release

```bash
git clone --recurse-submodules https://github.com/enclaive/sylica
cd sylica
git checkout <release-tag>
git submodule update --init --depth 1
git -C edk2 submodule update --init --depth 1
docker build -f reproduce/Dockerfile --target artifact \
    --build-arg PLATFORM=sylica-sev -o out .
sha256sum out/sylica-sev/CVMF.fd
```

The hash must match `sha256sums`/`b2sums` of the published release artifact.
