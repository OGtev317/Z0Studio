import assert from "node:assert/strict";
import test from "node:test";
import { createGigstarkPassportPolicy, createGigstarkPassportVerifier, verifyGigstarkPassport } from "../src/lib/gigstark-passport";

const now = 1_900;
const policy = () => createGigstarkPassportPolicy({ id: "gigstark:passport:studio:v1", audience: "gigstark:studio", purpose: "creator-tier-access", credentialClass: "creator-membership", validFrom: 1_800, validUntil: 2_000 });
const claim = () => ({ policyId: "gigstark:passport:studio:v1", audience: "gigstark:studio", purpose: "creator-tier-access" as const, credentialClass: "creator-membership" as const, proofCommitment: "proof:opaque", disclosureCommitment: "tier:studio", scopeNullifier: "scope:once", issuedAt: 1_890, expiresAt: 1_950, nonce: "claim:1" });

test("accepts a minimal bound Passport claim once", () => {
  const verifier = createGigstarkPassportVerifier();
  verifyGigstarkPassport(verifier, policy(), claim(), now);
  assert.throws(() => verifyGigstarkPassport(verifier, policy(), claim(), now), /PASSPORT_SCOPE_REPLAY/);
});

test("rejects wrong audience, purpose, and expiry", () => {
  assert.throws(() => verifyGigstarkPassport(createGigstarkPassportVerifier(), policy(), { ...claim(), audience: "another-app" }, now), /PASSPORT_BINDING_MISMATCH/);
  assert.throws(() => verifyGigstarkPassport(createGigstarkPassportVerifier(), policy(), { ...claim(), purpose: "escrow-role-authorization" }, now), /PASSPORT_BINDING_MISMATCH/);
  assert.throws(() => verifyGigstarkPassport(createGigstarkPassportVerifier(), policy(), { ...claim(), expiresAt: now }, now), /INVALID_PASSPORT_CLAIM/);
});
