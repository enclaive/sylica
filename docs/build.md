# Building

Sylica builds firmware from a pinned edk2 tree inside a pinned container image. Every input is fixed: edk2 is a git
submodule locked to a tag, the toolchain comes from an apt snapshot, and `SOURCE_DATE_EPOCH` removes timestamps. Two
builds of the same commit produce bit-identical firmware. See [reproducibility.md](reproducibility.md).

## Isolated build (CI and releases)

The whole build runs inside `docker build`. The repository is copied into the image and the compile step runs with `--network=none`
to ensure the build environment contains every dependency. Artifacts are exported directly:

```bash
git submodule update --init --depth 1
git -C edk2 submodule update --init --depth 1
docker build -f reproduce/Dockerfile --target artifact \
    --build-arg PLATFORM=<platform> -o out .
```

Results land in `out/<platform>/`: the firmware image, `sha256sums`/`b2sums`, and `tools-manifest.txt` (exact package versions of the toolchain).

## Local development build

`scripts/build.sh` initializes submodules and runs `reproduce/build.sh` directly on the host, without docker, so edk2 incremental builds work between runs:

```bash
scripts/build.sh <platform>
```

The host needs the toolchain packages listed in `reproduce/Dockerfile` (build-essential, git, nasm, acpica-tools,
uuid-dev, python3). A host build is for development only; release verification uses the isolated docker build with the
pinned toolchain.

## Container image

`reproduce/Dockerfile` has three stages:

| Stage      | Content                                                   |
|------------|-----------------------------------------------------------|
| `env`      | Toolchain from a pinned Ubuntu apt snapshot               |
| `build`    | Repository copy, compile step with `RUN --network=none`   |
| `artifact` | Scratch image holding `out/` for `docker build -o` export |

The inner build script `reproduce/build.sh` performs the edk2 build: platform conf sourcing, BaseTools, stack cookie
seeding, `build`, artifact copy.

CI publishes the `env` stage to `ghcr.io/enclaive/sylica/build-env` on pushes to `main` (also tagged `latest`) and on release tags.

## Platform configuration

A platform is a build recipe defined in `platforms/<name>.json`. See [platforms.md](platforms.md) for the available platforms.

| Key         | Meaning                        |
|-------------|--------------------------------|
| `package`   | Sylica platform variant        |
| `platform`  | edk2 dsc to build              |
| `target`    | `RELEASE` or `DEBUG`           |
| `arch`      | Target architecture            |
| `toolchain` | edk2 toolchain                 |
| `output`    | Path of the built flash volume |
| `filename`  | File name of the shipped image |
| `measure`   | Select measurement mode        |

## Adding a platform

1. Add DSC and FDF files under `SylicaOss/` (or reference upstream edk2 ones).
2. Create `platforms/<name>.json`.
3. Add the platform to the matrix in `.github/workflows/build.yml`.
4. If the platform is neither SEV-SNP nor Intel TDX, adjust the measurement step.

## CI

`.github/workflows/build.yml` runs a matrix over all platforms. Each job performs the reproducibility double build,
computes measurements, and uploads the firmware, checksums, toolchain manifest, and measurements as an artifact.

Tags matching `v*` additionally create a GitHub release with one tarball per platform (firmware, `sha256sums`/`b2sums`,
`tools-manifest.txt`, `measurements.json`, license files, `BUILD_ENV.txt` with the pinned build-env image digest) plus a
combined `sha256sums`/`b2sums` over the tarballs. Release notes list the firmware hashes, the build environment digest, and the
reproduce command.
