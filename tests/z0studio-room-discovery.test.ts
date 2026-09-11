import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverRooms,
  type DiscoverableRoom,
} from "../src/lib/z0studio-room-discovery";

const now = 1790000000000;

const rooms: DiscoverableRoom[] = [
  {
    id: "proof-room",
    name: "Proof Cafe",
    creator: "Proof Cafe",
    handle: "proof-cafe",
    focus: "Research notes and weekly supporter conversations",
    members: 208,
    templateId: "paid-cohort",
    createdAt: now - 1000 * 60 * 60 * 24 * 40,
    updatedAt: now - 1000 * 60 * 60 * 4,
    customization: {
      welcomeNote: "Weekly notes for serious builders",
      postingCadence: "Weekly",
      roomRules: "Keep research useful.",
    },
  },
  {
    id: "studio-drop",
    name: "Night Mode Labs",
    creator: "Night Mode Labs",
    handle: "night-mode",
    focus: "Drop room for launch files and archives",
    members: 61,
    templateId: "studio-drop-room",
    createdAt: now - 1000 * 60 * 60 * 24 * 2,
    updatedAt: now - 1000 * 60 * 60 * 24,
    lockedDrops: [{ title: "Premium launch file", price: "$15", access: "paid-drop" }],
  },
  {
    id: "starter",
    name: "Zero Studio Preview",
    creator: "Zero Studio",
    handle: "zero-studio",
    focus: "Public preview room for new members",
    members: 0,
    templateId: "starter-room",
    createdAt: now - 1000 * 60 * 60,
    updatedAt: now - 1000 * 60 * 60,
  },
];

function sortedRoomIds(result: ReturnType<typeof discoverRooms<DiscoverableRoom>>): string[] {
  return result.rooms.map((room) => room.id).sort();
}

test("room discovery searches names, handles, focus, and customization text", () => {
  assert.deepEqual(discoverRooms(rooms, { query: "weekly notes", now }).rooms.map((room) => room.id), ["proof-room"]);
  assert.deepEqual(discoverRooms(rooms, { query: "night mode", now }).rooms.map((room) => room.id), ["studio-drop"]);
  assert.deepEqual(discoverRooms(rooms, { query: "public preview", now }).rooms.map((room) => room.id), ["starter"]);
});

test("room discovery filters following, new, preview, member, and drop rooms", () => {
  assert.deepEqual(sortedRoomIds(discoverRooms(rooms, { filter: "following", followingHandles: ["zero-studio"], now })), ["starter"]);
  assert.deepEqual(sortedRoomIds(discoverRooms(rooms, { filter: "new", now })), ["starter", "studio-drop"]);
  assert.deepEqual(sortedRoomIds(discoverRooms(rooms, { filter: "free-preview", now })), ["starter"]);
  assert.deepEqual(sortedRoomIds(discoverRooms(rooms, { filter: "member-rooms", now })), ["proof-room", "starter"]);
  assert.deepEqual(sortedRoomIds(discoverRooms(rooms, { filter: "drop-rooms", now })), ["studio-drop"]);
});

test("room discovery sorts without mutating the original room list", () => {
  assert.deepEqual(discoverRooms(rooms, { sort: "most-members", now }).rooms.map((room) => room.id), ["proof-room", "studio-drop", "starter"]);
  assert.deepEqual(discoverRooms(rooms, { sort: "creator", now }).rooms.map((room) => room.id), ["studio-drop", "proof-room", "starter"]);
  assert.deepEqual(rooms.map((room) => room.id), ["proof-room", "studio-drop", "starter"]);
});

test("room discovery explains empty states for searches and followed creators", () => {
  assert.equal(discoverRooms(rooms, { query: "does not exist", now }).emptyReason, "No rooms match that search.");
  assert.equal(discoverRooms(rooms, { filter: "following", followingHandles: [], now }).emptyReason, "Follow creators to fill this view.");
});
