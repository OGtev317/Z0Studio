import assert from "node:assert/strict";
import test from "node:test";
import { filterCreatorFeedItems } from "../src/lib/feed-scope";
import { z0StudioRooms } from "../src/lib/z0studio-rooms";

const posts = [
  { handle: "zero-studio", title: "Studio notes" },
  { handle: "proof-cafe", title: "Research update" },
];

test("for-you feed scope retains the complete creator feed", () => {
  assert.deepEqual(filterCreatorFeedItems(posts, "for-you", ["proof-cafe"]), posts);
});

test("following feed scope includes only followed creators", () => {
  assert.deepEqual(filterCreatorFeedItems(posts, "following", ["proof-cafe"]), [posts[1]]);
  assert.deepEqual(filterCreatorFeedItems(posts, "following", []), []);
});

test("following scope filters creator rooms using the same browser-local handles", () => {
  assert.deepEqual(
    filterCreatorFeedItems(z0StudioRooms, "following", ["night-mode"]),
    [z0StudioRooms[2]],
  );
});
