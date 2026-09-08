import assert from "node:assert/strict";
import test from "node:test";
import {
  MAINNET_DEPLOYMENT_INPUT_FORMAT,
  assertNoPrivateMaterial,
  reviewMainnetDeploymentInputs,
  type MainnetDeploymentInputs,
  type MainnetReleaseManifestSummary,
} from "../src/lib/mainnet-deployment-readiness";
import {
  STRK20_MAINNET_POOL,
  STRK20_MAINNET_V2_CLASS_HASH,
} from "../src/lib/strk20-mainnet";

const manifestSha256 = "a".repeat(64);
const contractSourceCommit = "b".repeat(40);
const manifest = (): MainnetReleaseManifestSummary => ({
  sha256: manifestSha256,
  status: "NO_BROADCAST_REVIEW_CANDIDATE",
  network: { chainId: "SN_MAIN" },
  source: { commit: contractSourceCommit },
  externalBindings: {
    privacyPool: {
      address: STRK20_MAINNET_POOL,
      classHash: STRK20_MAINNET_V2_CLASS_HASH,
      reviewedClassAllowlisted: true,
    },
  },
  releaseGates: {
    independentCairoReview: "required",
    constructorArguments: "unset_and_unreviewed",
    declaration: "not_authorized",
    deployment: "not_authorized",
  },
});

const completeInput = (): MainnetDeploymentInputs => ({
  format: MAINNET_DEPLOYMENT_INPUT_FORMAT,
  network: {
    chainId: "SN_MAIN",
    privacyPool: STRK20_MAINNET_POOL,
    privacyPoolClassHash: STRK20_MAINNET_V2_CLASS_HASH,
  },
  release: {
    manifestSha256,
    independentReview: {
      url: "https://example.test/review",
      reviewer: "independent-reviewer",
      reviewedCommit: contractSourceCommit,
      decision: "approved",
      unresolvedCritical: 0,
      unresolvedHigh: 0,
    },
  },
  governance: {
    adminAddress: "0x111",
    adminClassHash: "0x222",
    controlType: "multisig",
    threshold: 2,
    signerSetReviewed: true,
    emergencyPolicyReviewed: true,
  },
  productionProof: {
    verifierClassHash: "0x333",
    verifierCompiledClassHash: "0x444",
    circuitSha256: "c".repeat(64),
    verificationKeySha256: "d".repeat(64),
    ceremonyReviewUrl: "https://example.test/ceremony",
  },
  attestor: {
    publicKey: "0x555",
    rotationPolicyReviewed: true,
    compromisePolicyReviewed: true,
  },
  deployer: {
    accountAddress: "0x666",
    accountClassHash: "0x777",
    maximumTotalFeeFri: "1000000000000000000",
  },
});

test("accepts only a complete public no-broadcast review package", () => {
  assert.deepEqual(reviewMainnetDeploymentInputs(completeInput(), manifest()), []);
});

test("reports every unresolved release role in the draft template", () => {
  const input = completeInput();
  input.release.independentReview.decision = null;
  input.governance.adminAddress = null;
  input.governance.signerSetReviewed = false;
  input.productionProof.verifierClassHash = null;
  input.attestor.publicKey = null;
  input.deployer.accountAddress = null;
  const blockers = reviewMainnetDeploymentInputs(input, manifest());
  assert(blockers.includes("INDEPENDENT_REVIEW_PENDING"));
  assert(blockers.includes("GOVERNANCE_ADMIN_UNSET"));
  assert(blockers.includes("GOVERNANCE_SIGNERS_UNREVIEWED"));
  assert(blockers.includes("PRODUCTION_VERIFIER_CLASS_UNSET"));
  assert(blockers.includes("ATTESTOR_PUBLIC_KEY_UNSET"));
  assert(blockers.includes("DEPLOYER_ACCOUNT_UNSET"));
});

test("rejects wrong Mainnet bindings and a changed manifest", () => {
  const input = completeInput();
  input.network.privacyPool = "0x123";
  input.network.privacyPoolClassHash = "0x456";
  input.release.manifestSha256 = "f".repeat(64);
  const blockers = reviewMainnetDeploymentInputs(input, manifest());
  assert(blockers.includes("PRIVACY_POOL_MISMATCH"));
  assert(blockers.includes("PRIVACY_POOL_CLASS_MISMATCH"));
  assert(blockers.includes("MANIFEST_SHA256_MISMATCH"));
});

test("binds independent approval to the exact compiled contract source commit", () => {
  const input = completeInput();
  input.release.independentReview.reviewedCommit = "e".repeat(40);
  assert(
    reviewMainnetDeploymentInputs(input, manifest()).includes(
      "INDEPENDENT_REVIEW_COMMIT_MISMATCH",
    ),
  );
});

test("rejects private, viewing, and witness material by field name", () => {
  assert.throws(
    () => assertNoPrivateMaterial({ governance: { privateKey: "0x123" } }),
    /PRIVATE_MATERIAL_FIELD_FORBIDDEN/,
  );
  assert.throws(
    () => assertNoPrivateMaterial({ signerPrivateKeyHex: "0x123" }),
    /PRIVATE_MATERIAL_FIELD_FORBIDDEN/,
  );
  assert.throws(
    () => assertNoPrivateMaterial({ wallet: { viewing_key: "0x123" } }),
    /PRIVATE_MATERIAL_FIELD_FORBIDDEN/,
  );
  assert.throws(
    () => assertNoPrivateMaterial({ proof: { witness: [1, 2, 3] } }),
    /PRIVATE_MATERIAL_FIELD_FORBIDDEN/,
  );
});
