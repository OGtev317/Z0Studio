#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$ROOT/../.." && pwd)"
BUILD="$ROOT/build"
CIRCUIT="$ROOT/circuits/gigstark_dispute.circom"
REQUEST="$ROOT/fixtures/dispute-seller.request.json"
SNARKJS="$PROJECT_ROOT/node_modules/.bin/snarkjs"

if [[ "$(circom --version)" != "circom compiler 2.2.3" ]]; then
  echo "CIRCOM_VERSION_MISMATCH expected=2.2.3"
  exit 1
fi
if [[ ! -x "$SNARKJS" ]]; then
  echo "SNARKJS_0_7_6_MISSING"
  exit 1
fi

mkdir -p "$BUILD"
cargo run --quiet --locked \
  --manifest-path "$PROJECT_ROOT/compute/enclave/Cargo.toml" \
  -- --stdio-once < "$REQUEST" > "$BUILD/enclave-response.json"
node "$ROOT/scripts/prepare-input.mjs" \
  "$REQUEST" "$BUILD/enclave-response.json" "$BUILD/input.json"

circom "$CIRCUIT" --r1cs --wasm --sym -o "$BUILD"
"$SNARKJS" powersoftau new bn128 12 "$BUILD/pot12_0000.ptau" -v
"$SNARKJS" powersoftau contribute \
  "$BUILD/pot12_0000.ptau" "$BUILD/pot12_0001.ptau" \
  --name="Gigstark local test-only contribution" \
  -e="gigstark-test-only-do-not-deploy-v1"
"$SNARKJS" powersoftau prepare phase2 \
  "$BUILD/pot12_0001.ptau" "$BUILD/pot12_final.ptau" -v
"$SNARKJS" groth16 setup \
  "$BUILD/gigstark_dispute.r1cs" "$BUILD/pot12_final.ptau" "$BUILD/dispute_0000.zkey"
"$SNARKJS" zkey contribute \
  "$BUILD/dispute_0000.zkey" "$BUILD/dispute_final.zkey" \
  --name="Gigstark synthetic dispute fixture" \
  -e="gigstark-synthetic-dispute-fixture-v1"
"$SNARKJS" zkey export verificationkey \
  "$BUILD/dispute_final.zkey" "$BUILD/verification_key.json"
node "$BUILD/gigstark_dispute_js/generate_witness.js" \
  "$BUILD/gigstark_dispute_js/gigstark_dispute.wasm" \
  "$BUILD/input.json" "$BUILD/witness.wtns"
"$SNARKJS" groth16 prove \
  "$BUILD/dispute_final.zkey" "$BUILD/witness.wtns" \
  "$BUILD/proof.json" "$BUILD/public.json"
"$SNARKJS" groth16 verify \
  "$BUILD/verification_key.json" "$BUILD/public.json" "$BUILD/proof.json"

echo "GIGSTARK_REAL_GROTH16_PROOF_OK"
