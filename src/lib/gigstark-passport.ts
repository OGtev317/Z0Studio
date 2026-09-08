export type GigstarkPassportPolicy = {
  id: string;
  audience: string;
  purpose: "creator-tier-access" | "escrow-role-authorization";
  credentialClass: "creator-membership" | "buyer-eligibility";
  validFrom: number;
  validUntil: number;
  active: boolean;
};

export type GigstarkPassportClaim = {
  policyId: string;
  audience: string;
  purpose: GigstarkPassportPolicy["purpose"];
  credentialClass: GigstarkPassportPolicy["credentialClass"];
  proofCommitment: string;
  disclosureCommitment: string;
  scopeNullifier: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type GigstarkPassportVerifier = { used: Set<string> };

export function createGigstarkPassportPolicy(input: Omit<GigstarkPassportPolicy, "active">): GigstarkPassportPolicy {
  if (!input.id || !input.audience || input.validUntil <= input.validFrom) throw new Error("INVALID_PASSPORT_POLICY");
  return { ...input, active: true };
}

export function createGigstarkPassportVerifier(): GigstarkPassportVerifier { return { used: new Set() }; }

/**
 * Validates policy binding and anti-replay only. It deliberately does not
 * verify a ZK proof or read a wallet: proofCommitment is opaque input from a
 * future reviewed verifier boundary.
 */
export function verifyGigstarkPassport(
  verifier: GigstarkPassportVerifier,
  policy: GigstarkPassportPolicy,
  claim: GigstarkPassportClaim,
  now: number,
): void {
  if (!policy.active || now < policy.validFrom || now >= policy.validUntil) throw new Error("PASSPORT_POLICY_INACTIVE");
  if (claim.policyId !== policy.id || claim.audience !== policy.audience || claim.purpose !== policy.purpose || claim.credentialClass !== policy.credentialClass) throw new Error("PASSPORT_BINDING_MISMATCH");
  if (!claim.proofCommitment || !claim.disclosureCommitment || !claim.scopeNullifier || !claim.nonce || claim.issuedAt > now || claim.expiresAt <= now || claim.expiresAt > policy.validUntil) throw new Error("INVALID_PASSPORT_CLAIM");
  const replayKey = `${policy.id}:${claim.scopeNullifier}`;
  if (verifier.used.has(replayKey)) throw new Error("PASSPORT_SCOPE_REPLAY");
  verifier.used.add(replayKey);
}
