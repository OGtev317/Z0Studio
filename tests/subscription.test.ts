import assert from "node:assert/strict";
import test from "node:test";
import { cancel, claimCreatorPeriod, expire, MAX_PREPAID_PERIODS, prepay, startSubscription } from "../src/lib/subscription";

const active = () => startSubscription({ id: "s-1", creatorCommitment: "creator", memberCommitment: "member", periodEndsAt: 100 });

test("one period starts active and allows one private creator claim", () => {
  const claimed = claimCreatorPeriod(active());
  assert.equal(claimed.creatorClaimedPeriods, 1);
  assert.throws(() => claimCreatorPeriod(claimed), /NO_CLAIMABLE_PERIOD/);
});

test("prepayment is bounded and cancellation halts additions", () => {
  const capped = prepay(active(), MAX_PREPAID_PERIODS - 1);
  assert.equal(capped.prepaidPeriods, MAX_PREPAID_PERIODS);
  assert.throws(() => prepay(capped, 1), /PREPAY_BOUND_EXCEEDED/);
  assert.throws(() => prepay(cancel(active()), 1), /SUBSCRIPTION_NOT_ACTIVE/);
});

test("subscription does not expire before the period end", () => {
  assert.throws(() => expire(active(), 99), /PERIOD_NOT_EXPIRED/);
  assert.equal(expire(active(), 100).state, "expired");
});
