export type TierPolicy = {
  id: string;
  audience: string;
  tier: string;
  validFrom: number;
  validUntil: number;
  requiresNullifier: boolean;
  active: boolean;
};

export type TierProofReceipt = {
  policyId: string;
  audience: string;
  tier: string;
  proofDigest: string;
  disclosureDigest: string;
  nullifier: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type TierVerifier = { consumedNullifiers: Set<string>; acceptedReceipts: Set<string> };

export function createTierPolicy(input: Omit<TierPolicy, "active">): TierPolicy {
  if (!input.id || !input.audience || !input.tier || input.validUntil <= input.validFrom) throw new Error("INVALID_TIER_POLICY");
  return { ...input, active: true };
}

export function createTierVerifier(): TierVerifier { return { consumedNullifiers: new Set(), acceptedReceipts: new Set() }; }

export function verifyTierProof(verifier: TierVerifier, policy: TierPolicy, receipt: TierProofReceipt, now: number): void {
  if (!policy.active || now < policy.validFrom || now >= policy.validUntil) throw new Error("TIER_POLICY_INACTIVE");
  if (receipt.policyId !== policy.id || receipt.audience !== policy.audience || receipt.tier !== policy.tier) throw new Error("TIER_BINDING_MISMATCH");
  if (!receipt.proofDigest || !receipt.disclosureDigest || !receipt.nonce || receipt.issuedAt > now || receipt.expiresAt <= now || receipt.expiresAt > policy.validUntil) throw new Error("INVALID_TIER_RECEIPT");
  const receiptKey = `${receipt.policyId}:${receipt.proofDigest}:${receipt.nonce}`;
  if (verifier.acceptedReceipts.has(receiptKey)) throw new Error("TIER_RECEIPT_REPLAY");
  if (policy.requiresNullifier) {
    if (!receipt.nullifier) throw new Error("TIER_NULLIFIER_REQUIRED");
    const nullifierKey = `${policy.id}:${receipt.nullifier}`;
    if (verifier.consumedNullifiers.has(nullifierKey)) throw new Error("TIER_NULLIFIER_REPLAY");
    verifier.consumedNullifiers.add(nullifierKey);
  }
  verifier.acceptedReceipts.add(receiptKey);
}
