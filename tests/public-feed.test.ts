import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicFeedPost,
  parsePublicFeedResponse,
  parsePublicFeedHistory,
  updatePublicFeedHistory,
} from "../src/lib/public-feed";

test("public feed accepts only normalized public posts", () => {
  const post = createPublicFeedPost({
    author: " Zero Studio ",
    handle: "@Zero-Studio",
    title: " New drop ",
    body: " Public preview for paid subscribers. ",
    createdAt: 100,
  });
  assert.deepEqual(post, {
    author: "Zero Studio",
    handle: "zero-studio",
    title: "New drop",
    body: "Public preview for paid subscribers.",
    createdAt: 100,
    visibility: "Public",
    source: "local",
    status: "published",
  });
});

test("public feed rejects private material and oversized bodies", () => {
  assert.throws(
    () => createPublicFeedPost({
      author: "Zero Studio",
      handle: "zero-studio",
      body: "viewing_key: 0x123",
      createdAt: 100,
    }),
    /PRIVATE_MATERIAL/,
  );
  assert.throws(
    () => createPublicFeedPost({
      author: "Zero Studio",
      handle: "zero-studio",
      body: "x".repeat(421),
      createdAt: 100,
    }),
    /TOO_LONG/,
  );
});

test("public feed history drops malformed records and keeps latest posts first", () => {
  const first = createPublicFeedPost({ author: "A", handle: "a", body: "hello", createdAt: 100 });
  const second = createPublicFeedPost({ author: "B", handle: "b", body: "world", createdAt: 200 });
  const history = updatePublicFeedHistory([first], second);
  assert.deepEqual(history.map((post) => post.handle), ["b", "a"]);
  const parsed = parsePublicFeedHistory(JSON.stringify([...history, { author: "", handle: "bad", body: "" }]));
  assert.deepEqual(parsed.map((post) => post.handle), ["b", "a"]);
});

test("public feed response parser drops malformed server posts", () => {
  const parsed = parsePublicFeedResponse({
    mode: "shared",
    posts: [
      { author: "Zero Studio", handle: "zero-studio", title: "Update", body: "Public only", createdAt: 100 },
      { author: "Bad", handle: "bad", body: "seed: phrase", createdAt: 101 },
    ],
  });
  assert.equal(parsed.mode, "shared");
  assert.deepEqual(parsed.posts.map((post) => post.handle), ["zero-studio"]);
});
