import assert from "node:assert/strict";
import test from "node:test";
import { onRequest, onRequestGet } from "../functions/api/zeeroagent";

test("ZeeroAgent API returns a live read-only accepted access decision", async () => {
  const response = await onRequestGet({
    request: new Request("https://example.com/api/zeeroagent?viewer=subscriber-8f2"),
  });
  assert.equal(response.status, 200);
  const payload = await response.json() as {
    service: string;
    status: string;
    decision: { status: string };
    boundaries: string[];
  };
  assert.equal(payload.service, "zeeroagent-access-brain");
  assert.equal(payload.status, "live-read-only");
  assert.equal(payload.decision.status, "allowed");
  assert.equal(payload.boundaries.includes("no wallet connection"), true);
  assert.equal(payload.boundaries.includes("no signing"), true);
});

test("ZeeroAgent demo cannot be mistaken for authenticated protected access", async () => {
  const response = await onRequest({ request: new Request("https://example.com/api/zeeroagent") });
  const payload = await response.json() as Record<string, unknown>;
  assert.equal(payload.mode, "synthetic-demo");
  assert.equal(payload.grantsProtectedAccess, false);
  assert.equal(payload.receiptOwnershipVerified, false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("ZeeroAgent rejects mutation methods and malformed viewer input", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await onRequest({ request: new Request("https://example.com/api/zeeroagent", { method }) });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
  }
  for (const viewer of ["", "a".repeat(65), "private material"]){
    const response = await onRequestGet({ request: new Request(`https://example.com/api/zeeroagent?viewer=${encodeURIComponent(viewer)}`) });
    assert.equal(response.status, 400);
  }
});

test("ZeeroAgent API blocks denied viewers without publishing private fields", async () => {
  const response = await onRequestGet({
    request: new Request("https://example.com/api/zeeroagent?viewer=subscriber-c70"),
  });
  assert.equal(response.status, 200);
  const payload = await response.json() as {
    decision: { status: string; hiddenFields: string[]; visibleFields: string[] };
  };
  assert.equal(payload.decision.status, "blocked");
  assert.equal(payload.decision.hiddenFields.includes("raw graph signatures"), true);
  assert.equal(payload.decision.visibleFields.includes("wallet address"), false);
});
