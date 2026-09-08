import assert from "node:assert/strict";
import test from "node:test";
import { claimPrivateNote, createEscrow, openDispute, settle, submitDelivery } from "../src/lib/escrow";

const funded = () => createEscrow({ id: "e-1", buyerCommitment: "buyer", sellerCommitment: "seller", amount: 1n });

test("buyer confirmation settles to a single seller claim", () => {
  const delivered = submitDelivery(funded(), "delivery-hash");
  const settled = settle(delivered, "seller");
  const claimed = claimPrivateNote(settled, "seller");
  assert.equal(claimed.sellerClaimed, true);
  assert.throws(() => claimPrivateNote(claimed, "seller"), /DOUBLE_CLAIM/);
});

test("dispute can resolve to buyer and rejects seller claim", () => {
  const disputed = openDispute(submitDelivery(funded(), "delivery-hash"));
  const refunded = settle(disputed, "buyer");
  assert.equal(claimPrivateNote(refunded, "buyer").buyerClaimed, true);
  assert.throws(() => claimPrivateNote(refunded, "seller"), /CLAIM_NOT_AUTHORIZED/);
});

test("replay and invalid ordering fail", () => {
  assert.throws(() => submitDelivery(submitDelivery(funded(), "a"), "b"), /DELIVERY_NOT_ALLOWED/);
  assert.throws(() => settle(funded(), "seller"), /SETTLEMENT_NOT_ALLOWED/);
});
