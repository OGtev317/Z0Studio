import assert from "node:assert/strict";
import test from "node:test";
import { canEnterRoom, canUnlockDrop, type LockedDrop, type RoomPass } from "../src/lib/z0studio-rooms";

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
