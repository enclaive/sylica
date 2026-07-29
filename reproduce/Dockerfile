ARG SNAPSHOT=20260323T000000Z
ARG BUILD_ENV=env

FROM ubuntu:22.04@sha256:0e0a0fc6d18feda9db1590da249ac93e8d5abfea8f4c3c0c849ce512b5ef8982 AS env

ARG SNAPSHOT
ENV DEBIAN_FRONTEND=noninteractive

RUN printf 'Acquire::Retries "10";\nAcquire::Retries::Delay::Maximum "30";\n' \
      > /etc/apt/apt.conf.d/80-retries

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN printf 'deb [check-valid-until=no] http://snapshot.ubuntu.com/ubuntu/%s jammy main universe\n\
deb [check-valid-until=no] http://snapshot.ubuntu.com/ubuntu/%s jammy-updates main universe\n\
deb [check-valid-until=no] http://snapshot.ubuntu.com/ubuntu/%s jammy-security main universe\n' \
      "$SNAPSHOT" "$SNAPSHOT" "$SNAPSHOT" > /etc/apt/sources.list \
 && rm -rf /etc/apt/sources.list.d/* \
 && printf 'Package: *\nPin: origin snapshot.ubuntu.com\nPin-Priority: 1001\n' \
      > /etc/apt/preferences.d/snapshot

RUN apt-get update \
 && apt-get dist-upgrade -y --allow-downgrades \
 && apt-get install -y --no-install-recommends --allow-downgrades \
      bash \
      build-essential \
      ca-certificates \
      git \
      jq \
      nasm \
      acpica-tools \
      uuid-dev \
      python3 \
      python-is-python3 \
 && rm -rf /var/lib/apt/lists/*

RUN dpkg-query -W -f '${Package} ${Version}\n' | sort > /tools-manifest.txt

WORKDIR /build

# Fully isolated build: repo baked in, network off, artifacts exported with
# `docker build --target artifact --build-arg PLATFORM=<p> -o <dir> .`
FROM $BUILD_ENV AS build
COPY . .
ARG PLATFORM
RUN --network=none reproduce/build.sh "$PLATFORM"

FROM scratch AS artifact
COPY --from=build /build/out/ /
