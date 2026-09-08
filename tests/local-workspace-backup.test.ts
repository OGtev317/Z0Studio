import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_MARKETPLACE, createGig, upsertProfile } from "../src/lib/marketplace";
import { createLocalWorkspaceBackup, parseLocalWorkspaceBackup } from "../src/lib/local-workspace-backup";
import { startSubscription } from "../src/lib/subscription";

test("local workspace backup round-trips public product records without bigint loss", () => {
  let marketplace = upsertProfile(EMPTY_MARKETPLACE, { id: "creator", handle: "mira", displayName: "Mira", role: "creator" });
  marketplace = createGig(marketplace, { id: "gig", creatorId: "creator", title: "Design", category: "Design", description: "x", price: 999999999999999999999n, status: "open" });
  const subscriptions = [startSubscription({ id: "sub", creatorCommitment: "creator", memberCommitment: "member", periodEndsAt: 100 })];
  const restored = parseLocalWorkspaceBackup(JSON.stringify(createLocalWorkspaceBackup(marketplace, subscriptions)));
  assert.equal(restored.marketplace.gigs[0]?.price, 999999999999999999999n);
  assert.equal(restored.subscriptions[0]?.prepaidPeriods, 1);
});

test("local workspace backup fails closed for unknown versions and malformed amounts", () => {
  assert.throws(() => parseLocalWorkspaceBackup(JSON.stringify({ version: 2, marketplace: {}, subscriptions: [] })), /UNSUPPORTED_LOCAL_BACKUP_VERSION/);
  assert.throws(() => parseLocalWorkspaceBackup(JSON.stringify({ version: 1, marketplace: { profiles: [], gigs: [{ price: "0" }], proposals: [], orders: [], receipts: [], feed: [] }, subscriptions: [] })), /INVALID_MARKETPLACE_BACKUP/);
});
