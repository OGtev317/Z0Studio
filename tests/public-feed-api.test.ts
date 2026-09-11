import assert from "node:assert/strict";
import test from "node:test";
import {
  onRequestGet,
  onRequestPost,
  type D1DatabaseBinding,
  type D1PreparedStatement,
} from "../functions/api/feed";

type Row = {
  author: string;
  handle: string;
  title: string;
  body: string;
  created_at: number;
};

function mockDb(seed: Row[] = []): D1DatabaseBinding & { rows: Row[] } {
  const rows = [...seed];
  const db = {
    rows,
    prepare(query: string): D1PreparedStatement {
      let values: unknown[] = [];
      return {
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return this;
        },
        async all<T>() {
          assert.match(query, /SELECT/);
          if (query.includes("WHERE handle")) {
            const handle = String(values[0]);
            const windowStart = Number(values[1]);
            return {
              results: rows
                .filter((row) => row.handle === handle && row.created_at >= windowStart)
                .sort((a, b) => b.created_at - a.created_at)
                .slice(0, 5) as T[],
            };
          }
          return { results: rows.slice().sort((a, b) => b.created_at - a.created_at) as T[] };
        },
        async first<T>() {
          return null as T | null;
        },
        async run() {
          assert.match(query, /INSERT/);
          rows.push({
            author: String(values[0]),
            handle: String(values[1]),
            title: String(values[2]),
            body: String(values[3]),
            created_at: Number(values[4]),
          });
          return {};
        },
      };
    },
  };
  return db;
}

test("feed API reports local fallback when D1 is not configured", async () => {
  const response = await onRequestGet({ request: new Request("https://example.com/api/feed"), env: {} });
  assert.equal(response.status, 200);
  const fallback = await response.json() as { posts: Array<{ source: string }>; mode: string };
  assert.equal(fallback.mode, "local-fallback");
  assert.equal(fallback.posts.length >= 3, true);
  assert.equal(fallback.posts.every((post) => post.source === "seed"), true);
  const postResponse = await onRequestPost({
    request: new Request("https://example.com/api/feed", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify({ author: "Zero Studio", handle: "zero-studio", body: "Public update", createdAt: 100 }),
    }),
    env: {},
  });
  assert.equal(postResponse.status, 503);
});

test("feed API requires a signed-in account before it accepts a public post", async () => {
  const db = mockDb();
  const response = await onRequestPost({
    request: new Request("https://example.com/api/feed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ author: "Zero Studio", handle: "zero-studio", title: "Drop", body: "Public update", createdAt: 100 }),
    }),
    env: { Z0STUDIO_DB: db },
  });
  assert.equal(response.status, 403);
  assert.equal(db.rows.length, 0);
  const getResponse = await onRequestGet({ request: new Request("https://example.com/api/feed"), env: { Z0STUDIO_DB: db } });
  const payload = await getResponse.json() as { posts: Array<{ title: string }>; mode: string };
  assert.equal(payload.mode, "shared");
  assert.equal(payload.posts.length, 0);
});

test("feed API rejects a cross-site write before it reaches storage", async () => {
  const db = mockDb();
  const response = await onRequestPost({
    request: new Request("https://example.com/api/feed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ author: "Zero Studio", handle: "zero-studio", body: "private_key=0x123", createdAt: 100 }),
    }),
    env: { Z0STUDIO_DB: db },
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "ORIGIN_REQUIRED" });
  assert.equal(db.rows.length, 0);
});

test("feed API leaves existing records untouched without an authenticated session", async () => {
  const now = Date.now();
  const db = mockDb(Array.from({ length: 5 }, (_, index) => ({
    author: "Zero Studio",
    handle: "zero-studio",
    title: `Post ${index}`,
    body: "Public update",
    created_at: now - index,
  })));
  const response = await onRequestPost({
    request: new Request("https://example.com/api/feed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ author: "Zero Studio", handle: "zero-studio", body: "Public update", createdAt: 2000 }),
    }),
    env: { Z0STUDIO_DB: db },
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "ORIGIN_REQUIRED" });
  assert.equal(db.rows.length, 5);
});
