import assert from "node:assert/strict";
import test from "node:test";
import { getZ0StudioThirdwebStatus, sanitizeCheckoutIntent } from "../src/lib/z0studio-thirdweb";

test("thirdweb status fails closed without reviewed public configuration", () => {
  const status = getZ0StudioThirdwebStatus({});
  assert.equal(status.live, false);
  assert.equal(status.canRenderLogin, false);
  assert.equal(status.canRenderCheckout, false);
  assert.equal(status.canReferenceZpro, false);
  assert.equal(status.lanes.every((lane) => lane.enabled === false), true);
});

test("thirdweb status distinguishes login, checkout, and app-credit readiness", () => {
  const status = getZ0StudioThirdwebStatus({
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: "client_id_1234567890",
    NEXT_PUBLIC_Z0STUDIO_PRO_CHECKOUT_ID: "z0studio:pro:checkout",
    NEXT_PUBLIC_Z0STUDIO_ZPRO_TOKEN_ADDRESS: "0x1111111111111111111111111111111111111111",
  });
  assert.equal(status.live, false);
  assert.equal(status.canRenderLogin, true);
  assert.equal(status.canRenderCheckout, true);
  assert.equal(status.canReferenceZpro, true);
  assert.equal(status.lanes.find((lane) => lane.id === "studioCheckout")?.enabled, false);
});

test("checkout intent stores product intent and rejects private material", () => {
  const intent = sanitizeCheckoutIntent({
    creatorName: "Zero Studio",
    handle: "@zero-studio",
    plan: "pro",
    roomName: "Private build room",
    email: "CREATOR@EXAMPLE.COM",
  });
  assert.equal(intent.handle, "zero-studio");
  assert.equal(intent.email, "creator@example.com");
  assert.equal(intent.status, "local-intent-only");
  assert.throws(() => sanitizeCheckoutIntent({
    creatorName: "seed phrase",
    handle: "zero",
    plan: "pro",
    roomName: "room",
  }), /CHECKOUT_INTENT_PRIVATE_MATERIAL/);
});
