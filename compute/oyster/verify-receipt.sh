#!/usr/bin/env bash
set -euo pipefail

EXPECTED_VERSION="oyster-cvm 5.0.1"
EXPECTED_DARWIN_ARM64_SHA256="f1438044b90dfbf1d847cde869f779b99265bf8f2ac455bae96337bcaecca9a5"

if [[ "$#" -ne 3 ]]; then
  echo "usage: $0 <attestation.hex> <image-id-hex> <user-data-hex>"
  exit 2
fi

ATTESTATION_FILE="$1"
IMAGE_ID="$2"
USER_DATA="$3"

if [[ ! -f "$ATTESTATION_FILE" ]]; then
  echo "ATTESTATION_FILE_NOT_FOUND"
  exit 1
fi
if [[ ! "$IMAGE_ID" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "INVALID_OYSTER_IMAGE_ID"
  exit 1
fi
if [[ ! "$USER_DATA" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "INVALID_OYSTER_USER_DATA"
  exit 1
fi
if ! command -v oyster-cvm >/dev/null 2>&1; then
  echo "OYSTER_CVM_NOT_INSTALLED"
  exit 1
fi
if [[ "$(oyster-cvm --version)" != "$EXPECTED_VERSION" ]]; then
  echo "OYSTER_CVM_VERSION_MISMATCH expected=$EXPECTED_VERSION"
  exit 1
fi

if [[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" ]]; then
  ACTUAL_SHA256="$(shasum -a 256 "$(command -v oyster-cvm)" | awk '{print $1}')"
  if [[ "$ACTUAL_SHA256" != "$EXPECTED_DARWIN_ARM64_SHA256" ]]; then
    echo "OYSTER_CVM_BINARY_MISMATCH"
    exit 1
  fi
fi

oyster-cvm verify \
  --attestation-hex-file "$ATTESTATION_FILE" \
  --image-id "$IMAGE_ID" \
  --user-data "$USER_DATA" \
  --arch amd64 \
  --max-age 300000

echo "OYSTER_RECEIPT_SHA256=$(shasum -a 256 "$ATTESTATION_FILE" | awk '{print $1}')"
