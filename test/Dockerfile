# Test asset build: kernel, initrd and EFI shell for test/, exported with
# `docker build -f test/Dockerfile -o test/out .`
ARG ENV_IMAGE=build-env

FROM $ENV_IMAGE AS test-env
RUN apt-get update \
 && apt-get install -y --no-install-recommends --allow-downgrades \
      flex \
      bison \
      bc \
      libelf-dev \
      zstd \
      cpio \
      busybox-static \
      libssl-dev \
      file \
      wget \
 && rm -rf /var/lib/apt/lists/*

# independent stages per artifact so they build in parallel

FROM test-env AS kernel
COPY test/kernel.sh test/kernel.config test/
# kernel.sh downloads the tarball itself and verifies its checksum
RUN test/kernel.sh

FROM test-env AS initrd
COPY test/initrd.sh test/
RUN --network=none test/initrd.sh

FROM test-env AS shell
RUN git clone --branch edk2-stable202605 --depth 1 https://github.com/tianocore/edk2 \
 && git -C edk2 submodule update --init --depth 1
RUN --network=none cd edk2 \
 && export PYTHON_COMMAND=python3 PYTHONHASHSEED=1 \
      WORKSPACE="$PWD" CONF_PATH="$PWD/Conf" EDK_TOOLS_PATH="$PWD/BaseTools" \
 && export PATH="$EDK_TOOLS_PATH/BinWrappers/PosixLike:$PATH" \
 && mkdir -p Conf \
 && for t in build_rule tools_def target; do cp "BaseTools/Conf/$t.template" "Conf/$t.txt"; done \
 && make -C BaseTools clean >/dev/null \
 && make -C BaseTools -j"$(nproc)" ARCH=X64 \
 && build -p ShellPkg/ShellPkg.dsc -t GCC -a X64 -b RELEASE

FROM scratch AS artifact
COPY --from=kernel /build/test/out/bzImage /
COPY --from=initrd /build/test/out/initrd.img /
COPY --from=shell /build/edk2/Build/Shell/RELEASE_GCC/X64/ShellPkg/Application/Shell/Shell/OUTPUT/Shell.efi /
