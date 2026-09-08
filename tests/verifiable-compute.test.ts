import assert from "node:assert/strict";
import test from "node:test";
import {
  createComputePolicy,
  createComputeVerifier,
  getOysterBindingStatement,
  verifyZkSettlement,
  type GigstarkZkPublicSignals,
  type GigstarkZkResult,
} from "../src/lib/verifiable-compute";

const now = 1_900;
const policy = () =>
  createComputePolicy({
    id: "gigstark:compute:dispute:v1",
    audience: "gigstark:escrow",
    programCommitment: "program:gigstark-dispute-v1",
    computePolicyHash: "policy:freelance-dispute:v1",
    requiredScore: 80,
    zkVerifierAddress: "starknet:groth16-verifier",
    validFrom: 1_800,
    validUntil: 2_000,
  });

const result = (): GigstarkZkResult => ({
  policyId: "gigstark:compute:dispute:v1",
  audience: "gigstark:escrow",
  jobId: "escrow:42",
  inputCommitment: "input:escrow-state-and-evidence-root",
  evidenceCommitment: "evidence:private-bundle",
  resultCommitment: "result:buyer-wins",
  outcome: "buyer",
  expiresAt: 1_950,
});

const signals = (): GigstarkZkPublicSignals => ({
  inputCommitment: result().inputCommitment,
  policyId: result().policyId,
  programCommitment: policy().programCommitment,
  requiredScore: policy().requiredScore,
  evidenceCommitment: result().evidenceCommitment,
  resultCommitment: result().resultCommitment,
  outcome: result().outcome,
  expiresAt: result().expiresAt,
});

const verify = (
  verifier = createComputeVerifier(),
  zkResult = result(),
  publicSignals = signals(),
  proofAccepted = true,
) =>
  verifyZkSettlement(
    verifier,
    policy(),
    zkResult,
    publicSignals,
    proofAccepted,
    "escrow:42",
    "input:escrow-state-and-evidence-root",
    now,
  );

test("a valid ZK proof is the sole settlement authority and cannot replay", () => {
  const verifier = createComputeVerifier();
  assert.equal(verify(verifier), "buyer");
  assert.throws(() => verify(verifier), /COMPUTE_NULLIFIER_REPLAY/);
});

test("rejects a failed proof or substituted public signal", () => {
  assert.throws(
    () => verify(createComputeVerifier(), result(), signals(), false),
    /COMPUTE_BAD_ZK_PROOF/,
  );
  assert.throws(
    () => verify(createComputeVerifier(), result(), { ...signals(), outcome: "seller" }),
    /COMPUTE_ZK_BINDING/,
  );
});

test("rejects wrong audience, job, or committed input", () => {
  assert.throws(
    () => verify(createComputeVerifier(), { ...result(), audience: "another-contract" }),
    /COMPUTE_BINDING_MISMATCH/,
  );
  assert.throws(
    () =>
      verifyZkSettlement(
        createComputeVerifier(),
        policy(),
        result(),
        signals(),
        true,
        "escrow:43",
        result().inputCommitment,
        now,
      ),
    /COMPUTE_JOB_INPUT_MISMATCH/,
  );
});

test("Oyster receipt is optional and cannot alter settlement", () => {
  assert.equal(verify(), "buyer");
  assert.equal(
    verify(createComputeVerifier(), { ...result(), oysterReceiptCommitment: "sha256:receipt-a" }),
    "buyer",
  );
  assert.equal(
    verify(createComputeVerifier(), { ...result(), oysterReceiptCommitment: "sha256:receipt-b" }),
    "buyer",
  );
  assert.deepEqual(getOysterBindingStatement(result(), "SN_SEPOLIA", "0xcompute").slice(0, 3), [
    "GIG_OYSTER_BIND_V1",
    "SN_SEPOLIA",
    "0xcompute",
  ]);
});

test("rejects expired results and revoked policies", () => {
  assert.throws(
    () => verify(createComputeVerifier(), { ...result(), expiresAt: now }),
    /INVALID_COMPUTE_RESULT/,
  );
  assert.throws(
    () =>
      verifyZkSettlement(
        createComputeVerifier(),
        { ...policy(), active: false },
        result(),
        signals(),
        true,
        "escrow:42",
        result().inputCommitment,
        now,
      ),
    /COMPUTE_POLICY_INACTIVE/,
  );
});
