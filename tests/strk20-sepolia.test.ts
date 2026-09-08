import assert from "node:assert/strict";
import test from "node:test";
import {
  STRK20_EXPECTED_LIVE_ABI_SHA256,
  STRK20_LIVE_CASM_BYTECODE_LENGTH,
  STRK20_LIVE_SIERRA_LENGTH,
  STRK20_OBSERVED_POOL_CLASS_HASH,
  STRK20_SOURCE_CANDIDATE_RELEASE_CLASS_HASH,
  STRK20_SOURCE_CANDIDATE_RELEASE_SIERRA_LENGTH,
  STRK20_WALLET_SDK_COMMIT,
  STRK20_WALLET_SDK_PACKAGE,
  STRK20_WALLET_SDK_RELEASE,
  STRK20_WALLET_SDK_VERSION,
  STRK20_UNIVERSAL_SIERRA_COMPILER_VERSION,
} from "../src/lib/strk20-sepolia";

test("pins the exact SDK package that reproduces the live pool ABI", () => {
  assert.equal(STRK20_WALLET_SDK_PACKAGE, "@starkware-libs/starknet-privacy-sdk");
  assert.equal(STRK20_WALLET_SDK_VERSION, "0.14.3-rc.5");
  assert.equal(STRK20_WALLET_SDK_RELEASE, "PRIVACY-0.14.3-RC.5");
  assert.equal(STRK20_WALLET_SDK_COMMIT.length, 40);
  assert.equal(STRK20_EXPECTED_LIVE_ABI_SHA256.length, 64);
  assert.equal(STRK20_UNIVERSAL_SIERRA_COMPILER_VERSION, "2.8.0");
});

test("keeps ABI compatibility separate from source reproduction", () => {
  assert.notEqual(
    BigInt(STRK20_SOURCE_CANDIDATE_RELEASE_CLASS_HASH),
    BigInt(STRK20_OBSERVED_POOL_CLASS_HASH),
  );
  assert.notEqual(
    STRK20_SOURCE_CANDIDATE_RELEASE_SIERRA_LENGTH,
    STRK20_LIVE_SIERRA_LENGTH,
  );
  assert.equal(STRK20_LIVE_CASM_BYTECODE_LENGTH, 42_083);
});
