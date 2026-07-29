#!/usr/bin/env bash

set -euo pipefail

function measure_none() {
  jq -n --arg name "$1" --arg digest "$2" '
  {
    filename: $name,
    digest: $digest
  }'
}

function measure_snp() {
  command -v sev-snp-measure >/dev/null || \
    { echo "sev-snp-measure not installed (see docs/verification.md)" >&2; exit 1; }

  for type in EPYC-v4 EPYC-Rome-v3 EPYC-Milan-v2 EPYC-Genoa-v1 EPYC-Turin;do
  for vcpus in $(seq 0 5 | awk '{print 2^$1}');do
    sev-snp-measure --mode snp --vcpus "$vcpus" --vcpu-type "$type" --ovmf "$3" \
      | jq -R --arg vcpus "$vcpus" '{key: $vcpus, value: .}'
  done | jq -s --arg type "$type" '{key: $type, value: .}'
  done | jq -s 'map(.value|=from_entries)|from_entries' \
  | jq --arg name "$1" --arg digest "$2" '
  {
    filename: $name,
    digest: $digest,
    measure: .
  }'
}

FILE="${1:?usage: file.sh <file> <mode>}"
MODE="${2:?usage: file.sh <file> <mode>}"
NAME="$(basename -- "$FILE")"
HASH="$(sha256sum "$FILE" | awk '{print $1}')"

case "${MODE}" in
  none)
    measure_none "$NAME" "$HASH" ;;
  snp)
    measure_snp  "$NAME" "$HASH" "$FILE" ;;
  tdx)
    echo "TDX is not supported set"
    exit 1
    ;;
  *)
    echo "unknown measurement mode: $MODE"
    exit 1
    ;;
esac