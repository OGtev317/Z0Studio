import assert from "node:assert/strict";
import test from "node:test";
import { onRequestPatch as updateCreatorRoom } from "../functions/api/creator/rooms/[roomId]";
import { onRequestGet as listPublicRooms, onRequestPost as createRoom } from "../functions/api/rooms";
import type { D1DatabaseBinding, D1PreparedStatement } from "../functions/_lib/z0studio-server";
import { defaultRoomCustomization } from "../src/lib/z0studio-room-customization";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  handle: string;
  role: "member" | "creator";
  created_at: number;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
};

type StoredRoom = {
  id: string;
  owner_id: string;
  name: string;
  focus: string;
  template_id: string;
  entry_label: string;
  status: "draft" | "published" | "archived";
  accent_color: string;
  cover_style: string;
  welcome_note: string;
  posting_cadence: string;
  room_rules: string;
  created_at: number;
  updated_at: number;
};

const creator: UserRow = {
  id: "creator-1",
  email: "creator@example.com",
  display_name: "Creator One",
  handle: "creator-one",
  role: "creator",
  created_at: 1,
  password_hash: "hash",
  password_salt: "salt",
  password_iterations: 1,
};

function request(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: "z0studio_session=test-session",
      origin: new URL(url).origin,
    },
    body: JSON.stringify(body),
  });
}

function mockDb(seed: StoredRoom[] = []): D1DatabaseBinding & { rooms: StoredRoom[] } {
  const rooms = [...seed];
  return {
    rooms,
    prepare(query: string): D1PreparedStatement {
      let values: unknown[] = [];
      return {
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return this;
        },
        async all<T>() {
          if (query.includes("FROM rooms JOIN users")) {
            return {
              results: rooms
                .filter((room) => room.status === "published")
                .map((room) => ({ ...room, creator: creator.display_name, handle: creator.handle, members: 0 })) as T[],
            };
          }
          return { results: [] as T[] };
        },
        async first<T>() {
          if (query.includes("FROM sessions JOIN users")) return creator as T;
          if (query.includes("FROM rooms WHERE id = ?")) {
            return (rooms.find((room) => room.id === values[0]) ?? null) as T | null;
          }
          return null as T | null;
        },
        async run() {
          if (query.includes("INSERT INTO rooms")) {
            rooms.unshift({
              id: String(values[0]),
              owner_id: String(values[1]),
              name: String(values[2]),
              focus: String(values[3]),
              template_id: String(values[4]),
              entry_label: String(values[5]),
              status: "published",
              accent_color: String(values[6]),
              cover_style: String(values[7]),
              welcome_note: String(values[8]),
              posting_cadence: String(values[9]),
              room_rules: String(values[10]),
              created_at: Number(values[11]),
              updated_at: Number(values[12]),
            });
          }
          if (query.includes("UPDATE rooms SET")) {
            const room = rooms.find((candidate) => candidate.id === values[10]);
            assert.ok(room);
            room.name = String(values[0]);
            room.focus = String(values[1]);
            room.entry_label = String(values[2]);
            room.status = values[3] as StoredRoom["status"];
            room.accent_color = String(values[4]);
            room.cover_style = String(values[5]);
            room.welcome_note = String(values[6]);
            room.posting_cadence = String(values[7]);
            room.room_rules = String(values[8]);
            room.updated_at = Number(values[9]);
          }
          return {};
        },
      };
    },
  };
}

test("room creation persists customization and public listing returns it", async () => {
  const db = mockDb();
  const response = await createRoom({
    request: request("https://z0studio.example/api/rooms", {
      name: "Build Room",
      focus: "Daily creator progress",
      templateId: "paid-cohort",
      entryLabel: "Join room",
      customization: {
        accentColor: "magenta",
        coverStyle: "grid",
        welcomeNote: "  Welcome   builders  ",
        postingCadence: "Daily drops",
        roomRules: "Keep it useful.",
      },
    }),
    env: { Z0STUDIO_DB: db },
  });
  assert.equal(response.status, 201);
  const created = await response.json() as { room: { customization: unknown } };
  assert.deepEqual(created.room.customization, {
    accentColor: "magenta",
    coverStyle: "grid",
    welcomeNote: "Welcome builders",
    postingCadence: "Daily drops",
    roomRules: "Keep it useful.",
  });
  assert.equal(db.rooms[0].accent_color, "magenta");

  const listResponse = await listPublicRooms({ request: new Request("https://z0studio.example/api/rooms"), env: { Z0STUDIO_DB: db } });
  const listed = await listResponse.json() as { rooms: Array<{ customization: unknown }> };
  assert.deepEqual(listed.rooms[0].customization, created.room.customization);
});

test("creator room updates preserve existing customization fields when only one field changes", async () => {
  const db = mockDb([{
    id: "room-1",
    owner_id: creator.id,
    name: "Original Room",
    focus: "Original focus",
    template_id: "starter-room",
    entry_label: "Request access",
    status: "published",
    accent_color: "violet",
    cover_style: "spotlight",
    welcome_note: "Original welcome",
    posting_cadence: "Weekly",
    room_rules: "Be respectful.",
    created_at: 1,
    updated_at: 1,
  }]);
  const response = await updateCreatorRoom({
    request: request("https://z0studio.example/api/creator/rooms/room-1", {
      name: "Updated Room",
      focus: "Updated focus",
      entryLabel: "Ask to join",
      status: "draft",
      customization: { welcomeNote: "Fresh welcome" },
    }, "PATCH"),
    env: { Z0STUDIO_DB: db },
    params: { roomId: "room-1" },
  });
  assert.equal(response.status, 200);
  const payload = await response.json() as { room: { customization: typeof defaultRoomCustomization; status: string } };
  assert.deepEqual(payload.room.customization, {
    accentColor: "violet",
    coverStyle: "spotlight",
    welcomeNote: "Fresh welcome",
    postingCadence: "Weekly",
    roomRules: "Be respectful.",
  });
  assert.equal(payload.room.status, "draft");
  assert.equal(db.rooms[0].welcome_note, "Fresh welcome");
  assert.equal(db.rooms[0].accent_color, "violet");
});

test("creator room updates reject sensitive customization text before storage changes", async () => {
  const db = mockDb([{
    id: "room-2",
    owner_id: creator.id,
    name: "Safe Room",
    focus: "Safe focus",
    template_id: "starter-room",
    entry_label: "Request access",
    status: "published",
    accent_color: "cyan",
    cover_style: "outline",
    welcome_note: "Welcome",
    posting_cadence: "Weekly",
    room_rules: "Be kind.",
    created_at: 1,
    updated_at: 1,
  }]);
  const response = await updateCreatorRoom({
    request: request("https://z0studio.example/api/creator/rooms/room-2", {
      name: "Safe Room",
      focus: "Safe focus",
      entryLabel: "Request access",
      status: "published",
      customization: { roomRules: "paste private key here" },
    }, "PATCH"),
    env: { Z0STUDIO_DB: db },
    params: { roomId: "room-2" },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "ROOM_RULES_INVALID" });
  assert.equal(db.rooms[0].room_rules, "Be kind.");
});
