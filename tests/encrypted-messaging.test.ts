import assert from "node:assert/strict";
import test from "node:test";
import { createMessagingIdentity, decryptMessage, encryptMessage, validateEncryptedEnvelope } from "../src/lib/encrypted-messaging";

test("encrypted envelopes exclude plaintext, decrypt only for the recipient, and detect tampering", async () => {
  const creator = await createMessagingIdentity("creator");
  const member = await createMessagingIdentity("member");
  const envelope = await encryptMessage({ id: "message-1", threadCommitment: "thread-commitment", sender: creator, recipientPublicKey: member.publicKey, plaintext: "Private delivery discussion", createdAt: 1 });
  assert.equal(JSON.stringify(envelope).includes("Private delivery discussion"), false);
  assert.equal(await decryptMessage(member, envelope), "Private delivery discussion");
  await assert.rejects(() => decryptMessage(creator, envelope), /MESSAGE_NOT_FOR_IDENTITY/);
  await assert.rejects(() => validateEncryptedEnvelope({ ...envelope, ciphertext: `${envelope.ciphertext}x` }), /ENCRYPTED_ENVELOPE_TAMPERED/);
});
