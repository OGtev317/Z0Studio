export type ComputeOutcome = "buyer" | "seller";

export type GigstarkComputePolicy = {
  id: string;
  audience: string;
  programCommitment: string;
  computePolicyHash: string;
  requiredScore: number;
  zkVerifierAddress: string;
  validFrom: number;
  validUntil: number;
  active: boolean;
};

export type GigstarkZkResult = {
  policyId: string;
  audience: string;
  jobId: string;
  inputCommitment: string;
  evidenceCommitment: string;
  resultCommitment: string;
  outcome: ComputeOutcome;
  expiresAt: number;
  /** Optional raw-attestation bundle hash. It never authorizes settlement. */
  oysterReceiptCommitment?: string;
};

export type GigstarkZkPublicSignals = {
  inputCommitment: string;
  policyId: string;
  programCommitment: string;
  requiredScore: number;
  evidenceCommitment: string;
  resultCommitment: string;
  outcome: ComputeOutcome;
  expiresAt: number;
};

export type GigstarkComputeVerifier = {
  usedNullifiers: Set<string>;
};

export function createComputePolicy(
  input: Omit<GigstarkComputePolicy, "active">,
): GigstarkComputePolicy {
  if (
    !input.id ||
    !input.audience ||
    !input.programCommitment ||
    !input.computePolicyHash ||
    !input.zkVerifierAddress ||
    !Number.isInteger(input.requiredScore) ||
    input.requiredScore < 0 ||
    input.requiredScore > 100 ||
    input.validUntil <= input.validFrom
  ) {
    throw new Error("INVALID_COMPUTE_POLICY");
  }
  return { ...input, active: true };
}

export function createComputeVerifier(): GigstarkComputeVerifier {
  return { usedNullifiers: new Set() };
}

export function getResultNullifier(result: GigstarkZkResult): string {
  return [
    "GIG_ZK_NULLIFIER_V1",
    result.policyId,
    result.audience,
    result.jobId,
    result.inputCommitment,
    result.resultCommitment,
    result.outcome,
    result.expiresAt,
  ].join(":");
}

/**
 * Human-readable mirror of the fields hashed into Oyster attestation
 * `user_data` by Cairo. Production clients must compute the actual Poseidon
 * hash with the same field encoding as `GigstarkComputeVerifier`.
 */
export function getOysterBindingStatement(
  result: GigstarkZkResult,
  chainId: string,
  computeVerifierAddress: string,
): readonly (string | number)[] {
  return [
    "GIG_OYSTER_BIND_V1",
    chainId,
    computeVerifierAddress,
    result.policyId,
    result.audience,
    result.jobId,
    result.inputCommitment,
    result.evidenceCommitment,
    result.resultCommitment,
    result.outcome,
    result.expiresAt,
  ];
}

/**
 * Browser-state model for the Cairo checks. `proofAccepted` represents the
 * result returned by the onchain Groth16 verifier; this function does not
 * perform cryptographic verification itself.
 */
export function verifyZkSettlement(
  verifier: GigstarkComputeVerifier,
  policy: GigstarkComputePolicy,
  result: GigstarkZkResult,
  publicSignals: GigstarkZkPublicSignals,
  proofAccepted: boolean,
  expectedJobId: string,
  expectedInputCommitment: string,
  now: number,
): ComputeOutcome {
  if (!policy.active || now < policy.validFrom || now >= policy.validUntil) {
    throw new Error("COMPUTE_POLICY_INACTIVE");
  }
  if (result.policyId !== policy.id || result.audience !== policy.audience) {
    throw new Error("COMPUTE_BINDING_MISMATCH");
  }
  if (result.jobId !== expectedJobId || result.inputCommitment !== expectedInputCommitment) {
    throw new Error("COMPUTE_JOB_INPUT_MISMATCH");
  }
  if (
    !result.evidenceCommitment ||
    !result.resultCommitment ||
    (result.outcome !== "buyer" && result.outcome !== "seller") ||
    result.expiresAt <= now ||
    result.expiresAt > policy.validUntil
  ) {
    throw new Error("INVALID_COMPUTE_RESULT");
  }
  if (!proofAccepted) throw new Error("COMPUTE_BAD_ZK_PROOF");
  if (
    publicSignals.inputCommitment !== result.inputCommitment ||
    publicSignals.policyId !== result.policyId ||
    publicSignals.programCommitment !== policy.programCommitment ||
    publicSignals.requiredScore !== policy.requiredScore ||
    publicSignals.evidenceCommitment !== result.evidenceCommitment ||
    publicSignals.resultCommitment !== result.resultCommitment ||
    publicSignals.outcome !== result.outcome ||
    publicSignals.expiresAt !== result.expiresAt
  ) {
    throw new Error("COMPUTE_ZK_BINDING");
  }

  const nullifier = getResultNullifier(result);
  if (verifier.usedNullifiers.has(nullifier)) throw new Error("COMPUTE_NULLIFIER_REPLAY");
  verifier.usedNullifiers.add(nullifier);
  return result.outcome;
}
