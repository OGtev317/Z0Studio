#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$ROOT/../.." && pwd)"
SNARKJS="$PROJECT_ROOT/node_modules/.bin/snarkjs"

"$SNARKJS" groth16 verify \
  "$ROOT/fixtures/verification_key.json" \
  "$ROOT/fixtures/public.json" \
  "$ROOT/fixtures/proof.json"
