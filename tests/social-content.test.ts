import assert from "node:assert/strict";
import test from "node:test";
import { encryptedMessages } from "../src/lib/social-content";

test("inbox previews use creator-facing language and keep implementation details out of the UI", () => {
  assert.deepEqual(encryptedMessages.map((message) => message.status), ["New", "Room request", "Question"]);
  assert.equal(encryptedMessages.some((message) => /ciphertext|chain data|wallet history|memo plaintext/i.test(message.preview)), false);
});
