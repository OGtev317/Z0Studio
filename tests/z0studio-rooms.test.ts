import assert from "node:assert/strict";
import test from "node:test";
import {
  blockedRoomTemplateLiveActions,
  canEnterRoom,
  canUnlockDrop,
  creatorRoomTemplates,
  findRoomForCreator,
  templateAllowsTier,
  templateRequiresSeparateDropReceipt,
  type LockedDrop,
  type RoomPass,
} from "../src/lib/z0studio-rooms";

const now = 1788910000000;

const memberPass: RoomPass = {
  roomId: "room-a",
  viewerId: "viewer-1",
  tier: "member",
  paidDropIds: ["drop-paid"],
  expiresAt: now + 60_000,
};

test("room access requires matching unexpired member or studio pass", () => {
  assert.equal(canEnterRoom(memberPass, "room-a", now), true);
  assert.equal(canEnterRoom(memberPass, "room-b", now), false);
  assert.equal(canEnterRoom({ ...memberPass, tier: "visitor" }, "room-a", now), false);
  assert.equal(canEnterRoom({ ...memberPass, expiresAt: now }, "room-a", now), false);
});

test("room members can view room posts but paid drops require a separate unlock", () => {
  const memberDrop: LockedDrop = { id: "drop-room", title: "Room update", price: "included", access: "member" };
  const paidDrop: LockedDrop = { id: "drop-paid", title: "Paid file", price: "$4", access: "paid-drop" };
  const otherPaidDrop: LockedDrop = { id: "drop-other", title: "Other file", price: "$9", access: "paid-drop" };

  assert.equal(canUnlockDrop(memberPass, "room-a", memberDrop, now), true);
  assert.equal(canUnlockDrop(memberPass, "room-a", paidDrop, now), true);
  assert.equal(canUnlockDrop(memberPass, "room-a", otherPaidDrop, now), false);
});

test("creator room templates bind receipt policy to room and drop access", () => {
  const starter = creatorRoomTemplates.find((template) => template.id === "starter-room");
  const paid = creatorRoomTemplates.find((template) => template.id === "paid-cohort");
  const studio = creatorRoomTemplates.find((template) => template.id === "studio-drop-room");

  assert.ok(starter);
  assert.ok(paid);
  assert.ok(studio);
  assert.equal(starter.roomPolicy.requiresReceipt, true);
  assert.equal(starter.receiptPolicyId, "preview-pass");
  assert.equal(templateAllowsTier(starter, "visitor"), true);
  assert.equal(templateAllowsTier(paid, "visitor"), false);
  assert.equal(templateAllowsTier(paid, "studio"), true);
  assert.equal(templateAllowsTier(studio, "member"), false);
  assert.equal(templateAllowsTier(studio, "studio"), true);
  assert.equal(templateRequiresSeparateDropReceipt(paid), true);
  assert.equal(templateRequiresSeparateDropReceipt(studio), true);
});

test("creator room templates remain local and block live checkout actions", () => {
  for (const template of creatorRoomTemplates) {
    assert.equal(template.blockedLiveActions, blockedRoomTemplateLiveActions);
    assert.ok(template.blockedLiveActions.includes("wallet-signing"));
    assert.ok(template.blockedLiveActions.includes("strk20-transaction"));
    assert.ok(template.blockedLiveActions.includes("database-write"));
    assert.ok(template.blockedLiveActions.includes("cloudflare-deployment"));
  }
});

test("every listed creator can be routed directly to a room", () => {
  assert.equal(findRoomForCreator("zero-studio")?.id, "zero-studio-room");
  assert.equal(findRoomForCreator("proof-cafe")?.id, "proof-cafe-room");
  assert.equal(findRoomForCreator("night-mode")?.id, "night-mode-room");
  assert.equal(findRoomForCreator("unknown"), undefined);
});
