import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPaymentMemoReceiptIsPublic,
  bindPaymentMemoReceipt,
  createMessagingIdentity,
  createPaymentMemoContact,
  decryptPaymentMemo,
  encryptPaymentMemo,
  parsePaymentMemoReceipt,
  updatePaymentMemoReceipts,
  validatePaymentMemoReceipt,
} from "../src/lib/private-messaging";

test("payment memo decrypts only for the recipient and stores no plaintext", async () => {
  const client = await createMessagingIdentity("client");
  const creator = await createMessagingIdentity("creator");
  const plaintext = "Thanks for the private coaching session";
  const pending = await encryptPaymentMemo({
    sender: client,
    recipient: createPaymentMemoContact(creator),
    plaintext,
    paymentCommitment: "payment-fields",
    createdAt: 1,
  });
  const receipt = await bindPaymentMemoReceipt({ pending, paymentHash: "0xabc" });

  assert.equal(JSON.stringify(receipt).includes(plaintext), false);
  assert.equal(await decryptPaymentMemo(creator, receipt), plaintext);
  await assert.rejects(() => decryptPaymentMemo(client, receipt), /MESSAGE_NOT_FOR_IDENTITY/);
  await assert.doesNotReject(() => assertPaymentMemoReceiptIsPublic(receipt, plaintext));
});

test("payment memo detects tampering and replayed nullifiers", async () => {
  const client = await createMessagingIdentity("client");
  const creator = await createMessagingIdentity("creator");
  const pending = await encryptPaymentMemo({
    sender: client,
    recipient: createPaymentMemoContact(creator),
    plaintext: "Private memo",
    paymentCommitment: "payment-fields",
    createdAt: 1,
  });
  const receipt = await bindPaymentMemoReceipt({ pending, paymentHash: "0x123" });
  await assert.rejects(
    () => validatePaymentMemoReceipt({ ...receipt, paymentHash: "0x124" }),
    /PAYMENT_MEMO_TAMPERED/,
  );
  assert.throws(
    () => updatePaymentMemoReceipts([receipt], { ...receipt, paymentHash: "0x125" }),
    /PAYMENT_MEMO_REPLAYED/,
  );
});

test("payment memo import validates receipt shape and rejects private material", async () => {
  const client = await createMessagingIdentity("client");
  const creator = await createMessagingIdentity("creator");
  const pending = await encryptPaymentMemo({
    sender: client,
    recipient: createPaymentMemoContact(creator),
    plaintext: "Settlement note",
    paymentCommitment: "payment-fields",
    createdAt: 1,
  });
  const receipt = await bindPaymentMemoReceipt({ pending, paymentHash: "0x456" });
  assert.equal((await parsePaymentMemoReceipt(JSON.stringify(receipt))).paymentHash, "0x456");
  await assert.rejects(
    () => encryptPaymentMemo({
      sender: client,
      recipient: createPaymentMemoContact(creator),
      plaintext: "viewing_key: 0x123",
      paymentCommitment: "payment-fields",
    }),
    /PAYMENT_MEMO_PRIVATE_MATERIAL/,
  );
});
