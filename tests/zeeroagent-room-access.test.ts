import assert from "node:assert/strict";
import test from "node:test";
import { evaluateZ0StudioRoomAccess } from "../src/lib/zeeroagent-room-access";
import { demoRoomPass, z0StudioRooms, type RoomPass } from "../src/lib/z0studio-rooms";

const now = 1788910000000;
const zeroStudioRoom = z0StudioRooms.find((room) => room.id === "zero-studio-room");

if (!zeroStudioRoom) throw new Error("ZERO_STUDIO_ROOM_MISSING");

test("ZeeroAgent room adapter allows an accepted viewer with a room-bound pass", () => {
  const decision = evaluateZ0StudioRoomAccess({
    viewerId: "subscriber-8f2",
    room: zeroStudioRoom,
    pass: { ...demoRoomPass, expiresAt: now + 60_000 },
    drop: zeroStudioRoom.lockedDrops[0],
    now,
  });
  assert.equal(decision.status, "available");
  assert.equal(decision.canViewRoom, true);
  assert.equal(decision.canViewDrop, true);
  assert.equal(decision.mode, "local-policy-adapter");
});

test("ZeeroAgent room adapter blocks before evaluating an otherwise eligible pass", () => {
  const blockedPass: RoomPass = {
    ...demoRoomPass,
    viewerId: "subscriber-c70",
    expiresAt: now + 60_000,
  };
  const decision = evaluateZ0StudioRoomAccess({
    viewerId: "subscriber-c70",
    room: zeroStudioRoom,
    pass: blockedPass,
    now,
  });
  assert.equal(decision.status, "unavailable");
  assert.equal(decision.canViewRoom, false);
});

test("ZeeroAgent room adapter fails closed for a pass not bound to the current viewer", () => {
  const decision = evaluateZ0StudioRoomAccess({
    viewerId: "subscriber-8f2",
    room: zeroStudioRoom,
    pass: { ...demoRoomPass, viewerId: "subscriber-other", expiresAt: now + 60_000 },
    now,
  });
  assert.equal(decision.status, "join-required");
  assert.equal(decision.canViewRoom, false);
});

test("ZeeroAgent room adapter requires review for an unrecognized relationship", () => {
  const decision = evaluateZ0StudioRoomAccess({
    viewerId: "subscriber-new",
    room: zeroStudioRoom,
    now,
  });
  assert.equal(decision.status, "review-required");
  assert.equal(decision.canViewRoom, false);
});
