import assert from "node:assert/strict";
import test from "node:test";
import { privacyInvokeClaim } from "../src/lib/privacy-invoke-draft";
import { STRK20_SEPOLIA_POOL } from "../src/lib/strk20-sepolia";

const sellerWin = () => ({ outcome: "seller" as const, sellerClaimed: false, buyerClaimed: false, token: "0x123", amount: 42n });

test("only the pinned Sepolia pool can return one winner note", () => {
  const result = privacyInvokeClaim(`0x0${STRK20_SEPOLIA_POOL.slice(2)}`, sellerWin(), "seller", "0x101");
  assert.deepEqual(result.deposit, { noteId: "0x101", token: "0x123", amount: 42n });
  assert.equal(result.next.sellerClaimed, true);
  assert.throws(() => privacyInvokeClaim("0xdead", sellerWin(), "seller", "0x101"), /ONLY_PRIVACY_POOL/);
});

test("rejects wrong winner and double claims", () => {
  assert.throws(() => privacyInvokeClaim(STRK20_SEPOLIA_POOL, sellerWin(), "buyer", "0x101"), /CLAIM_NOT_AUTHORIZED/);
  const claimed = privacyInvokeClaim(STRK20_SEPOLIA_POOL, sellerWin(), "seller", "0x101").next;
  assert.throws(() => privacyInvokeClaim(STRK20_SEPOLIA_POOL, claimed, "seller", "0x102"), /DOUBLE_CLAIM/);
});

test("rejects malformed note fields and u128 overflow", () => {
  assert.throws(() => privacyInvokeClaim(STRK20_SEPOLIA_POOL, { ...sellerWin(), token: "0x0" }, "seller", "0x101"), /INVALID_OPEN_NOTE_DEPOSIT/);
  assert.throws(() => privacyInvokeClaim(STRK20_SEPOLIA_POOL, { ...sellerWin(), amount: 1n << 128n }, "seller", "0x101"), /INVALID_OPEN_NOTE_DEPOSIT/);
  assert.throws(() => privacyInvokeClaim(STRK20_SEPOLIA_POOL, sellerWin(), "seller", "not-a-felt"), /INVALID_OPEN_NOTE_DEPOSIT/);
});
