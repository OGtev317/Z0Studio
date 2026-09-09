import assert from "node:assert/strict";
import test from "node:test";
import { createPrivacyPaymentIntent } from "../src/lib/z0studio-starknet-privacy";

test("privacy payment intent normalizes room access payment fields", () => {
  const intent = createPrivacyPaymentIntent({
    creatorHandle: "@zero-studio",
    roomId: "Zero Studio Room",
    mode: "room-entry",
    amount: "9.25",
    recipient: "zero.stark",
  });
  assert.equal(intent.creatorHandle, "zero-studio");
  assert.equal(intent.roomId, "zero-studio-room");
  assert.equal(intent.recipient, "zero.stark");
  assert.equal(intent.requiredAction, "shield-first");
  assert.equal(intent.status, "local-review-only");
});

test("privacy payment intent supports direct private creator tips", () => {
  const intent = createPrivacyPaymentIntent({
    creatorHandle: "proof-cafe",
    roomId: "proof-cafe-room",
    mode: "creator-tip",
    amount: "1",
    recipient: "0x00123",
  });
  assert.equal(intent.recipient, "0x123");
  assert.equal(intent.requiredAction, "private-transfer");
});

test("privacy payment intent rejects private material and invalid amounts", () => {
  assert.throws(() => createPrivacyPaymentIntent({
    creatorHandle: "zero-studio",
    roomId: "zero-room",
    mode: "room-entry",
    amount: "0",
    recipient: "zero.stark",
  }), /PRIVACY_PAYMENT_AMOUNT_INVALID/);
  assert.throws(() => createPrivacyPaymentIntent({
    creatorHandle: "zero-studio",
    roomId: "secret witness room",
    mode: "room-entry",
    amount: "1",
    recipient: "zero.stark",
  }), /PRIVACY_PAYMENT_PRIVATE_MATERIAL/);
});
