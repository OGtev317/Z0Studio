import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_MARKETPLACE, acceptProposal, appendFeedPost, createGig, fundOrder, recordDelivery, reputationFor, settleOrder, submitProposal, upsertProfile } from "../src/lib/marketplace";

const seeded = () => {
  let state = upsertProfile(EMPTY_MARKETPLACE, { id: "creator", handle: "mira", displayName: "Mira", role: "creator" });
  state = upsertProfile(state, { id: "buyer", handle: "kai", displayName: "Kai", role: "buyer", starkName: "kai.stark" });
  return state;
};

test("marketplace creates a proposal-led order and local receipt trail", () => {
  let state = createGig(seeded(), { id: "gig", creatorId: "creator", title: "Logo system", category: "Design", description: "A private delivery commitment.", price: 25n, status: "open" });
  state = submitProposal(state, { id: "proposal", gigId: "gig", buyerId: "buyer", message: "I need this next week.", status: "pending" });
  state = acceptProposal(state, "proposal", "order");
  state = fundOrder(state, "order", "receipt-deposit");
  state = recordDelivery(state, "order", "0xdelivery");
  state = settleOrder(state, "order", "seller_claim", "receipt-claim");
  assert.equal(state.orders[0]?.status, "settled");
  assert.equal(state.receipts.length, 2);
  assert.deepEqual(reputationFor(state, "creator"), { completed: 1, refunded: 0, score: 100 });
});

test("marketplace rejects self proposals and invalid settlement ordering", () => {
  const state = createGig(seeded(), { id: "gig", creatorId: "creator", title: "Logo", category: "Design", description: "x", price: 1n, status: "open" });
  assert.throws(() => submitProposal(state, { id: "self", gigId: "gig", buyerId: "creator", message: "x", status: "pending" }), /SELF_PROPOSAL_FORBIDDEN/);
  assert.throws(() => settleOrder(state, "missing", "refund", "r"), /ORDER_NOT_SETTLEABLE/);
});

test("tier posts require a creator profile and retain their declared tier", () => {
  const state = appendFeedPost(seeded(), { id: "post", creatorId: "creator", tier: "patron", body: "Studio notes" });
  assert.equal(state.feed[0]?.tier, "patron");
});
