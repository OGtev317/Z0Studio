import assert from "node:assert/strict";
import test from "node:test";
import { createCreatorRoomDraftPreview } from "../src/lib/creator-room-draft";
import { creatorRoomTemplates } from "../src/lib/z0studio-rooms";

const paidCohort = creatorRoomTemplates.find((template) => template.id === "paid-cohort");
if (!paidCohort) throw new Error("MISSING_PAID_COHORT_TEMPLATE");

test("creator room draft preview is normalized and inherits the selected template", () => {
  assert.deepEqual(createCreatorRoomDraftPreview({
    template: paidCohort,
    roomName: "  Build   Circle  ",
    communityFocus: " Weekly notes and practical feedback ",
  }), {
    templateId: "paid-cohort",
    templateName: "Paid cohort room",
    roomName: "Build Circle",
    communityFocus: "Weekly notes and practical feedback",
    accessTier: "member",
    entryPrice: "$19/month",
  });
});

test("creator room draft preview rejects invalid or sensitive creator input", () => {
  assert.throws(() => createCreatorRoomDraftPreview({
    template: paidCohort,
    roomName: "x",
    communityFocus: "Weekly notes",
  }), /ROOM_DRAFT_NAME_INVALID/);
  assert.throws(() => createCreatorRoomDraftPreview({
    template: paidCohort,
    roomName: "Build Circle",
    communityFocus: "private key: hidden",
  }), /ROOM_DRAFT_SENSITIVE_MATERIAL_REJECTED/);
});
