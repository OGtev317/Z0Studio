import assert from "node:assert/strict";
import test from "node:test";
import { onRequestPost as registerAccount } from "../functions/api/auth/register";
import {
  allowFixedWindowRequest,
  cleanDisplayName,
  cleanEmail,
  cleanHandle,
  cleanPassword,
  createPasswordRecord,
  requireSameOrigin,
  verifyPassword,
} from "../functions/_lib/z0studio-server";

test("account fields normalize only valid public identity values", () => {
  assert.equal(cleanEmail("  Creator@Example.com "), "creator@example.com");
  assert.equal(cleanHandle("Build-Club"), "build-club");
  assert.equal(cleanDisplayName("  Build   Club  "), "Build Club");
  assert.throws(() => cleanHandle("not valid"), /HANDLE_INVALID/);
  assert.throws(() => cleanPassword("short"), /PASSWORD_INVALID/);
});

test("password records verify the correct password without retaining it", async () => {
  const password = "a long test password";
  const record = await createPasswordRecord(password);
  assert.equal(await verifyPassword(password, { password_hash: record.hash, password_salt: record.salt, password_iterations: record.iterations }), true);
  assert.equal(await verifyPassword("a different test password", { password_hash: record.hash, password_salt: record.salt, password_iterations: record.iterations }), false);
  assert.notEqual(record.hash.includes(password), true);
});

test("writes require a same-origin browser request", () => {
  assert.doesNotThrow(() => requireSameOrigin(new Request("https://z0studio.example/api", { headers: { origin: "https://z0studio.example" } })));
  assert.throws(() => requireSameOrigin(new Request("https://z0studio.example/api", { headers: { origin: "https://other.example" } })), /ORIGIN_REQUIRED/);
});

test("registration fails closed when the production database binding is absent", async () => {
  const response = await registerAccount({
    request: new Request("https://z0studio.example/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://z0studio.example" },
      body: JSON.stringify({ displayName: "Creator", handle: "creator", email: "creator@example.com", password: "a long test password" }),
    }),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "SERVICE_UNAVAILABLE" });
});

test("fixed-window account rate limiting fails closed after its limit", async () => {
  let count = 0;
  const db = {
    prepare() {
      return {
        bind() { return this; },
        async all<T>() { return { results: [] as T[] }; },
        async first<T>() { count += 1; return { count } as T; },
        async run() { return {}; },
      };
    },
  };
  assert.equal(await allowFixedWindowRequest(db, "test", "client", 2, 60_000, 1_000), true);
  assert.equal(await allowFixedWindowRequest(db, "test", "client", 2, 60_000, 1_000), true);
  assert.equal(await allowFixedWindowRequest(db, "test", "client", 2, 60_000, 1_000), false);
});
