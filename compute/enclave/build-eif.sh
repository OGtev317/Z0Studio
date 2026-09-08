#!/usr/bin/env bash
set -euo pipefail

NITRO_CLI_VERSION="1.5.0"
IMAGE="gigstark-dispute-enclave:0.1.0"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARTIFACTS="$ROOT/artifacts"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "EIF_BUILD_REQUIRES_LINUX"
  exit 1
fi
if ! command -v nitro-cli >/dev/null 2>&1; then
  echo "NITRO_CLI_MISSING"
  exit 1
fi
if ! nitro-cli --version 2>&1 | grep -Fq "$NITRO_CLI_VERSION"; then
  echo "NITRO_CLI_VERSION_MISMATCH expected=$NITRO_CLI_VERSION"
  exit 1
fi

mkdir -p "$ARTIFACTS"
docker build --platform linux/amd64 --provenance=false --tag "$IMAGE" "$ROOT"
nitro-cli build-enclave \
  --docker-uri "$IMAGE" \
  --output-file "$ARTIFACTS/gigstark-dispute-v0.1.0.eif" \
  > "$ARTIFACTS/measurements.json"

python3 - "$ARTIFACTS/measurements.json" <<'PY'
import json
import sys

data = json.load(open(sys.argv[1], encoding="utf-8"))
measurements = data.get("Measurements", data)
pcr0 = measurements.get("PCR0", "")
if len(pcr0) != 96 or set(pcr0) == {"0"}:
    raise SystemExit("INVALID_OR_DEBUG_PCR0")
print(f"EIF_MEASUREMENT_OK PCR0={pcr0}")
PY
