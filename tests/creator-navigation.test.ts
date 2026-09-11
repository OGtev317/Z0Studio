import assert from "node:assert/strict";
import test from "node:test";
import { creatorProfileHref } from "../src/lib/creator-navigation";

test("creator navigation opens known profile anchors and safely falls back", () => {
  assert.equal(creatorProfileHref("zero-studio"), "/profiles#zero-studio");
  assert.equal(creatorProfileHref("proof-cafe"), "/profiles#proof-cafe");
  assert.equal(creatorProfileHref("unknown"), "/profiles");
});
