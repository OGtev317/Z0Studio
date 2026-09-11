import assert from "node:assert/strict";
import test from "node:test";
import { buildRoomShareTarget } from "../src/lib/z0studio-room-sharing";

test("room sharing builds stable room and creator links from ids and handles", () => {
  const target = buildRoomShareTarget({
    roomId: "room-abc-123",
    handle: "Creator-One",
    roomName: "Build Room",
    creatorName: "Creator One",
  });
  assert.equal(target.roomHref, "/rooms#room-abc-123");
  assert.equal(target.profileHref, "/profiles#creator-one");
  assert.equal(target.roomUrl, target.roomHref);
  assert.equal(target.profileUrl, target.profileHref);
  assert.equal(target.title, "Build Room on Z0Studio");
  assert.equal(target.copyText, "Join Build Room by Creator One on Z0Studio. /rooms#room-abc-123");
});

test("room sharing can produce absolute share urls from the current origin", () => {
  const target = buildRoomShareTarget({
    roomId: "zero-studio-room",
    handle: "zero-studio",
    roomName: "Zero Studio Room",
    creatorName: "Zero Studio",
    origin: "https://z0studio.example/pro?ignored=true",
  });
  assert.equal(target.roomUrl, "https://z0studio.example/rooms#zero-studio-room");
  assert.equal(target.profileUrl, "https://z0studio.example/profiles#zero-studio");
});

test("room sharing rejects malformed anchors and private material", () => {
  assert.throws(() => buildRoomShareTarget({
    roomId: "../room",
    handle: "zero-studio",
    roomName: "Zero Studio Room",
    creatorName: "Zero Studio",
  }), /ROOM_SHARE_ID_INVALID/);
  assert.throws(() => buildRoomShareTarget({
    roomId: "room-1",
    handle: "not valid",
    roomName: "Zero Studio Room",
    creatorName: "Zero Studio",
  }), /ROOM_SHARE_HANDLE_INVALID/);
  assert.throws(() => buildRoomShareTarget({
    roomId: "room-1",
    handle: "zero-studio",
    roomName: "private key room",
    creatorName: "Zero Studio",
  }), /ROOM_SHARE_NAME_INVALID/);
});
