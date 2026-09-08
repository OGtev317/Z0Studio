#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EIF="$ROOT/artifacts/gigstark-dispute-v0.1.0.eif"

if [[ "$(uname -s)" != "Linux" ]] || [[ ! -e /dev/nitro_enclaves ]]; then
  echo "NITRO_ENCLAVE_PARENT_REQUIRED"
  exit 1
fi
if [[ ! -f "$EIF" ]]; then
  echo "EIF_MISSING"
  exit 1
fi

# Deliberately no --debug-mode: debug attestation has all-zero PCRs.
nitro-cli run-enclave \
  --cpu-count 2 \
  --memory 512 \
  --enclave-cid 16 \
  --eif-path "$EIF"
