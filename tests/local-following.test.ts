import assert from "node:assert/strict";
import test from "node:test";
import { parseLocalFollowing, toggleLocalFollowing } from "../src/lib/local-following";

test("local following restores only valid, unique creator handles", () => {
  assert.deepEqual(parseLocalFollowing(JSON.stringify([
    "zero-studio", "proof-cafe", "zero-studio", "bad handle", 7,
  ])), ["zero-studio", "proof-cafe"]);
  assert.deepEqual(parseLocalFollowing("not-json"), []);
});

test("local following toggles one valid creator without external state", () => {
  assert.deepEqual(toggleLocalFollowing([], "zero-studio"), ["zero-studio"]);
  assert.deepEqual(toggleLocalFollowing(["zero-studio", "proof-cafe"], "zero-studio"), ["proof-cafe"]);
  assert.throws(() => toggleLocalFollowing([], "not a handle"), /LOCAL_FOLLOW_HANDLE_INVALID/);
});
