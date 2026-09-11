import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRoomSetupChecklist,
  defaultRoomCustomization,
  normalizeRoomCustomization,
  roomCustomizationFromDatabaseRow,
  roomCustomizationToDatabaseValues,
} from "../src/lib/z0studio-room-customization";

test("room customization normalizes creator-facing settings with defaults", () => {
  assert.deepEqual(normalizeRoomCustomization({}), defaultRoomCustomization);
  assert.deepEqual(normalizeRoomCustomization({
    accentColor: " Magenta ",
    coverStyle: "Grid",
    welcomeNote: "  Welcome   builders  ",
    postingCadence: "  Daily drops  ",
    roomRules: "  Stay kind   and focused. ",
  }), {
    accentColor: "magenta",
    coverStyle: "grid",
    welcomeNote: "Welcome builders",
    postingCadence: "Daily drops",
    roomRules: "Stay kind and focused.",
  });
});

test("room customization rejects invalid choices and sensitive material", () => {
  assert.throws(() => normalizeRoomCustomization({ accentColor: "gold" }), /ROOM_ACCENT_INVALID/);
  assert.throws(() => normalizeRoomCustomization({ coverStyle: "noise" }), /ROOM_COVER_INVALID/);
  assert.throws(() => normalizeRoomCustomization({ welcomeNote: "my private key is 0x123" }), /ROOM_WELCOME_INVALID/);
  assert.throws(() => normalizeRoomCustomization({ roomRules: "share seed phrase here" }), /ROOM_RULES_INVALID/);
});

test("room customization converts database rows into API settings", () => {
  const customization = roomCustomizationFromDatabaseRow({
    accent_color: "violet",
    cover_style: "spotlight",
    welcome_note: "Open studio hours",
    posting_cadence: "Twice a week",
    room_rules: "Respect the creator.",
  });
  assert.deepEqual(roomCustomizationToDatabaseValues(customization), {
    accent_color: "violet",
    cover_style: "spotlight",
    welcome_note: "Open studio hours",
    posting_cadence: "Twice a week",
    room_rules: "Respect the creator.",
  });
});

test("room setup checklist marks a polished published room ready", () => {
  const setup = buildRoomSetupChecklist({
    name: "Build Room",
    focus: "Daily creator progress, notes, and community questions",
    entryLabel: "Join room",
    status: "published",
    customization: normalizeRoomCustomization({
      accentColor: "magenta",
      coverStyle: "grid",
      welcomeNote: "Welcome to the build room.",
      postingCadence: "Daily updates",
      roomRules: "Stay useful and respectful.",
    }),
  });
  assert.equal(setup.ready, true);
  assert.equal(setup.completedCount, setup.totalCount);
  assert.equal(setup.completionPercent, 100);
  assert.equal(setup.nextAction, "Share the room");
});

test("room setup checklist points creators to the next unfinished room step", () => {
  const setup = buildRoomSetupChecklist({
    name: "A Room",
    focus: "Short",
    entryLabel: "Go",
    status: "draft",
    customization: defaultRoomCustomization,
  });
  assert.equal(setup.ready, false);
  assert.equal(setup.completedCount, 1);
  assert.equal(setup.nextAction, "Describe the room");
  assert.deepEqual(setup.steps.filter((step) => !step.completed).map((step) => step.id), [
    "focus",
    "style",
    "welcome",
    "cadence",
    "rules",
    "entry",
    "publish",
  ]);
});
