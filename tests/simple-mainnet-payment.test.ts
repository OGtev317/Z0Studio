import assert from "node:assert/strict";
import test from "node:test";
import { STRK20_MAINNET_REVIEW_TARGET } from "../src/lib/strk20-wallet";
import { buildSimplePaymentActions, formatStrkAmount, isFirstShieldRegistrationRequired, parseStrkAmount, parseTransactionHistory, paymentPreparationErrorMessage, receiptQualifiesForSubmission, receiptTouchesPool, updateTransactionHistory } from "../src/lib/simple-mainnet-payment";

test("parses exact STRK amounts without floating point", () => {
  assert.equal(parseStrkAmount("1"), "0xde0b6b3a7640000");
  assert.equal(parseStrkAmount("0.000000000000000001"), "0x1");
  assert.equal(formatStrkAmount("0x53444835ec580000"), "6");
  assert.throws(() => parseStrkAmount("0"), /INVALID_STRK_AMOUNT/);
  assert.throws(() => parseStrkAmount("1.0000000000000000001"), /INVALID_STRK_AMOUNT/);
});

test("builds only the three pool-native MVP actions", () => {
  assert.equal(buildSimplePaymentActions("shield", "2")[0]?.type, "deposit");
  assert.deepEqual(buildSimplePaymentActions("pay", "2", "0x123")[0], {
    type: "transfer", token: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d", amount: "0x1bc16d674ec80000", recipient: "0x123",
  });
  assert.equal(buildSimplePaymentActions("withdraw", "2", "0x123")[0]?.type, "withdraw");
  assert.throws(() => buildSimplePaymentActions("pay", "1"), /RECIPIENT_REQUIRED/);
});

test("only recognizes the wallet's exact first-shield registration signal", () => {
  assert.equal(isFirstShieldRegistrationRequired(new Error("NOT_REGISTERED")), true);
  assert.equal(isFirstShieldRegistrationRequired({ message: "NOT_REGISTERED" }), true);
  assert.equal(isFirstShieldRegistrationRequired(new Error("An error occurred (NOT_REGISTERED)")), true);
  assert.equal(isFirstShieldRegistrationRequired(new Error("NOT_REGISTERED_EXTRA")), false);
  assert.equal(isFirstShieldRegistrationRequired("NOT_REGISTERED"), false);
});

test("turns preparation codes into actionable, privacy-safe messages", () => {
  assert.match(paymentPreparationErrorMessage(new Error("INVALID_STRK_AMOUNT")), /greater than zero/);
  assert.match(paymentPreparationErrorMessage(new Error("STARK_NAME_NOT_FOUND")), /did not resolve/);
  assert.match(paymentPreparationErrorMessage(new Error("unexpected")), /could not prepare/);
});

test("qualifying receipt must succeed and contain a pool-originated event", () => {
  const pool = STRK20_MAINNET_REVIEW_TARGET.address;
  assert.equal(receiptTouchesPool({ execution_status: "SUCCEEDED", events: [{ from_address: pool }] }, pool), true);
  assert.equal(receiptTouchesPool({ execution_status: "REVERTED", events: [{ from_address: pool }] }, pool), false);
  assert.equal(receiptTouchesPool({ execution_status: "SUCCEEDED", events: [{ from_address: "0x123" }] }, pool), false);
});

test("submission receipt must also be accepted", () => {
  const pool = STRK20_MAINNET_REVIEW_TARGET.address;
  assert.equal(receiptQualifiesForSubmission({ execution_status: "SUCCEEDED", finality_status: "ACCEPTED_ON_L2", events: [{ from_address: pool }] }, pool), true);
  assert.equal(receiptQualifiesForSubmission({ execution_status: "SUCCEEDED", finality_status: "RECEIVED", events: [{ from_address: pool }] }, pool), false);
});

test("transaction recovery normalizes, deduplicates, and rejects malformed storage", () => {
  assert.deepEqual(updateTransactionHistory(["0x01", "0x2"], "0x1"), ["0x1", "0x2"]);
  assert.deepEqual(parseTransactionHistory('["0x1","bad",3,"0x02"]'), ["0x1", "0x2"]);
  assert.deepEqual(parseTransactionHistory("not json"), []);
  assert.throws(() => updateTransactionHistory([], "0x0"), /INVALID_TRANSACTION_HASH/);
});
