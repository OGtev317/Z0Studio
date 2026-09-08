import test from "node:test";
import assert from "node:assert/strict";
import {
  assertZSocialGraphDemoSafe,
  blockedTargets,
  decideZSocialAccess,
  deliveredTargets,
  zSocialGraphEvents,
  zSocialGraphSnapshot,
} from "../src/lib/z-social-graph-demo";

test("z-social graph demo keeps the ZeeroAgent layer static and non-public", () => {
  assert.equal(zSocialGraphSnapshot.mode, "static-demo");
  assert.equal(zSocialGraphSnapshot.publicSocialNetworkVerified, false);
  assert.equal(assertZSocialGraphDemoSafe(), true);
});

test("z-social graph demo covers request, acceptance, block, permission, and delivery", () => {
  assert.deepEqual(zSocialGraphEvents.map((event) => event.kind), [
    "follow-request",
    "follow-accept",
    "follow-block",
    "permission-edge",
    "feed-delivery",
  ]);
});

test("z-social graph demo never delivers a feed item to a blocked viewer", () => {
  const delivered = new Set(deliveredTargets());
  assert.equal(blockedTargets().some((viewer) => delivered.has(viewer)), false);
});

test("z-social graph demo excludes private material from the visible product layer", () => {
  assert.deepEqual(zSocialGraphSnapshot.hiddenFields, [
    "wallet address",
    "wallet history",
    "private notes",
    "memo plaintext",
    "proof witness",
    "raw graph signatures",
  ]);
});

test("z-social graph access decisions allow accepted viewers and block denied viewers", () => {
  assert.equal(decideZSocialAccess("subscriber-8f2").status, "allowed");
  assert.equal(decideZSocialAccess("subscriber-c70").status, "blocked");
  assert.equal(decideZSocialAccess("subscriber-new").status, "review");
});
