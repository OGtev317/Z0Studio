import assert from "node:assert/strict";
import test from "node:test";
import { buildMemberRoomReadinessPanel } from "../src/lib/z0studio-room-readiness";
import { z0StudioRooms } from "../src/lib/z0studio-rooms";

const room = z0StudioRooms[0];

test("member room readiness explains room contents and owner", () => {
  const panel = buildMemberRoomReadinessPanel({ room, memberState: "none", accessStatus: "join-required" });
  assert.equal(panel.roomTitle, "Zero Studio");
  assert.equal(panel.ownerLabel, "Zero Studio @zero-studio");
  assert.deepEqual(panel.contains, ["Studio member feed", "Creator updates", "Member extras", "Locked drops"]);
  assert.equal(panel.accessLabel, "Membership needed");
  assert.equal(panel.canRequestAccess, true);
  assert.match(panel.nextAction, /Request access/);
});

test("member room readiness distinguishes pending and active access", () => {
  const pending = buildMemberRoomReadinessPanel({ room, memberState: "pending" });
  const active = buildMemberRoomReadinessPanel({ room, memberState: "active" });
  assert.equal(pending.accessLabel, "Request pending");
  assert.equal(pending.canEnter, false);
  assert.equal(pending.canRequestAccess, false);
  assert.equal(active.accessLabel, "Ready to enter");
  assert.equal(active.canEnter, true);
  assert.equal(active.nextAction, "Open the room to read member posts and replies.");
});

test("member room readiness keeps blocked and owner states explicit", () => {
  const blocked = buildMemberRoomReadinessPanel({ room, memberState: "blocked", accessStatus: "unavailable" });
  const owned = buildMemberRoomReadinessPanel({ room, ownsRoom: true });
  assert.equal(blocked.accessLabel, "Access unavailable");
  assert.equal(blocked.canRequestAccess, false);
  assert.equal(owned.accessLabel, "Creator access");
  assert.equal(owned.canEnter, true);
  assert.equal(owned.canRequestAccess, false);
});
