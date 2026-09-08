import assert from "node:assert/strict";
import test from "node:test";
import {
  ZEEROSTREAM_DEMO_RECEIPTS,
  ZEEROSTREAM_DEMO_URL,
  ZEEROSTREAM_DEMO_VIDEO_URL,
  ZEEROSTREAM_MANIFEST_URL,
} from "../src/lib/hackathon-evidence";
import {
  assertPublicReceiptRoomRecord,
  buildCreatorReceiptRoom,
  createAccessDisclosurePass,
} from "../src/lib/private-creator-room";

test("creator receipt room mirrors the submitted evidence pack", () => {
  const room = buildCreatorReceiptRoom();
  assert.equal(room.demoUrl, ZEEROSTREAM_DEMO_URL);
  assert.equal(room.demoVideoUrl, ZEEROSTREAM_DEMO_VIDEO_URL);
  assert.equal(room.manifestUrl, ZEEROSTREAM_MANIFEST_URL);
  assert.deepEqual(room.cards.map((card) => card.hash), ZEEROSTREAM_DEMO_RECEIPTS.map((receipt) => receipt.hash));
  assert.equal(room.cards.every((card) => card.status === "verified-mainnet"), true);
  assert.equal(room.cards.every((card) => card.hiddenFields.includes("memo plaintext")), true);
});

test("access disclosure pass reveals only tier, audience, expiry, and receipt binding", async () => {
  const receiptHash = ZEEROSTREAM_DEMO_RECEIPTS[2].hash;
  const pass = await createAccessDisclosurePass({
    receiptHash,
    tier: "Studio",
    audience: "zero-studio-feed",
    issuedAt: 100,
    expiresAt: 700,
  });
  assert.equal(pass.tier, "Studio");
  assert.equal(pass.audience, "zero-studio-feed");
  assert.equal(pass.receiptHash, `0x${BigInt(receiptHash).toString(16)}`);
  assert.equal(pass.visibleFields.includes("tier"), true);
  assert.equal(pass.hiddenFields.includes("wallet history"), true);
  await assert.doesNotReject(() => Promise.resolve(assertPublicReceiptRoomRecord(pass)));
});

test("shield receipt privacy labels disclose public depositor and amount", () => {
  const { cards } = buildCreatorReceiptRoom();
  for (const card of cards.slice(0, 2)) {
    assert.ok(card.visibleFields.includes("depositor"));
    assert.ok(card.visibleFields.includes("deposit amount"));
    assert.ok(!card.hiddenFields.includes("amount"));
    assert.ok(!card.hiddenFields.includes("sender"));
  }
  assert.ok(cards[2].hiddenFields.includes("amount"));
});

test("receipt room rejects unknown receipts and private-material labels", async () => {
  await assert.rejects(
    () => createAccessDisclosurePass({
      receiptHash: "0x999",
      tier: "Studio",
      audience: "zero-studio-feed",
      issuedAt: 100,
      expiresAt: 700,
    }),
    /UNKNOWN_RECEIPT/,
  );
  await assert.rejects(
    () => createAccessDisclosurePass({
      receiptHash: ZEEROSTREAM_DEMO_RECEIPTS[0].hash,
      tier: "Studio",
      audience: "viewing_key:0x123",
      issuedAt: 100,
      expiresAt: 700,
    }),
    /PRIVATE_MATERIAL/,
  );
});
