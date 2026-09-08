#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK_TMP="$(mktemp -d /private/tmp/gigstark-specimen.XXXXXX)"
trap 'rm -rf "$TASK_TMP"' EXIT

if [[ "$(scarb --version | head -n 1)" != scarb\ 2.17.0* ]]; then
  echo "SCARB_VERSION_MISMATCH expected=2.17.0"
  exit 1
fi
if [[ "$(snforge --version)" != "snforge 0.59.0" ]]; then
  echo "SNFORGE_VERSION_MISMATCH expected=0.59.0"
  exit 1
fi

(cd "$ROOT" && shasum -a 256 -c compute/SHA256SUMS)
cargo test --locked --manifest-path "$ROOT/compute/enclave/Cargo.toml"
docker build \
  --platform linux/amd64 \
  --provenance=false \
  --tag gigstark-dispute-enclave:0.1.0 \
  "$ROOT/compute/enclave"
docker run \
  --platform linux/amd64 \
  --rm \
  --interactive \
  gigstark-dispute-enclave:0.1.0 \
  --stdio-once \
  < "$ROOT/compute/zk/fixtures/dispute-seller.request.json" \
  > "$TASK_TMP/enclave-response.json"

jq --sort-keys . "$TASK_TMP/enclave-response.json" > "$TASK_TMP/actual.json"
jq --sort-keys . "$ROOT/compute/zk/fixtures/enclave-response.json" > "$TASK_TMP/expected.json"
diff -u "$TASK_TMP/expected.json" "$TASK_TMP/actual.json"

jq --compact-output '[
  .dispute_input_commitment,
  .policy_id,
  .program_measurement_commitment,
  (.required_score | tostring),
  .evidence_commitment,
  .result_commitment,
  (.outcome | tostring),
  (.expires_at | tostring)
]' "$TASK_TMP/enclave-response.json" > "$TASK_TMP/public.json"
jq --compact-output . "$ROOT/compute/zk/fixtures/public.json" > "$TASK_TMP/expected-public.json"
diff -u "$TASK_TMP/expected-public.json" "$TASK_TMP/public.json"

(cd "$ROOT" && npm run proof:verify)
(cd "$ROOT/compute/cairo-verifier" && scarb build && snforge test)

echo "GIGSTARK_COMPUTE_SPECIMEN_OK"
