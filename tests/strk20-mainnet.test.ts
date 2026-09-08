import assert from "node:assert/strict";
import test from "node:test";
import {
  STARKNET_MAINNET_CHAIN_ID,
  STRK20_MAINNET_EXPECTED_ABI_SHA256,
  STRK20_MAINNET_POOL,
  STRK20_MAINNET_V2_CLASS_HASH,
  STRK20_MAINNET_V2_SOURCE_TAG,
} from "../src/lib/strk20-mainnet";
import { STRK20_REPRODUCED_V2_POOL_CLASS_HASH } from "../src/lib/strk20-sepolia";

test("pins the source-reproduced V2 pool as the Mainnet release target", () => {
  assert.equal(STARKNET_MAINNET_CHAIN_ID, "0x534e5f4d41494e");
  assert.equal(
    STRK20_MAINNET_POOL,
    "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
  );
  assert.equal(
    BigInt(STRK20_MAINNET_V2_CLASS_HASH),
    BigInt(STRK20_REPRODUCED_V2_POOL_CLASS_HASH),
  );
  assert.equal(STRK20_MAINNET_EXPECTED_ABI_SHA256.length, 64);
  assert.equal(STRK20_MAINNET_V2_SOURCE_TAG, "CONTRACT_V2_DEPLOYED_MAINNET_2026-07-08");
});
