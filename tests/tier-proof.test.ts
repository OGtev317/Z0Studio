import assert from "node:assert/strict";
import test from "node:test";
import { createTierPolicy, createTierVerifier, verifyTierProof } from "../src/lib/tier-proof";

const now = 1000;
const policy = () => createTierPolicy({ id: "p", audience: "gigstark-feed", tier: "studio", validFrom: 900, validUntil: 1100, requiresNullifier: true });
const receipt = () => ({ policyId: "p", audience: "gigstark-feed", tier: "studio", proofDigest: "proof", disclosureDigest: "tier", nullifier: "nullifier", issuedAt: 999, expiresAt: 1050, nonce: "n-1" });

test("accepts a current audience-bound tier proof once", () => {
  const verifier = createTierVerifier();
  verifyTierProof(verifier, policy(), receipt(), now);
  assert.throws(() => verifyTierProof(verifier, policy(), receipt(), now), /TIER_RECEIPT_REPLAY/);
});

test("rejects a proof for another audience and a reused scoped nullifier", () => {
  const verifier = createTierVerifier();
  assert.throws(() => verifyTierProof(verifier, policy(), { ...receipt(), audience: "other" }, now), /TIER_BINDING_MISMATCH/);
  verifyTierProof(verifier, policy(), receipt(), now);
  assert.throws(() => verifyTierProof(verifier, policy(), { ...receipt(), proofDigest: "new-proof", nonce: "n-2" }, now), /TIER_NULLIFIER_REPLAY/);
});

test("rejects expired receipts and expired policies", () => {
  assert.throws(() => verifyTierProof(createTierVerifier(), policy(), { ...receipt(), expiresAt: now }, now), /INVALID_TIER_RECEIPT/);
  assert.throws(() => verifyTierProof(createTierVerifier(), createTierPolicy({ ...policy(), validUntil: now }), receipt(), now), /TIER_POLICY_INACTIVE/);
});
