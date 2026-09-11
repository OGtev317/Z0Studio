import assert from "node:assert/strict";
import test from "node:test";
import {
  getZ0CMigrationMechanismRecommendation,
  getZ0CRepresentationContractDraftReadiness,
  validateZ0CMigrationReadinessReview,
  z0cMigrationReadinessReviewTemplate,
  z0cMigrationReviewFacts,
  z0cMigrationRouteSummaries,
  type Z0CMigrationReadinessReview,
} from "../src/lib/z0c-migration-review";
import { z0cTokenomicsDecisionTemplate } from "../src/lib/z0c-tokenomics";

function reviewedBurnAndMint(): Z0CMigrationReadinessReview {
  return {
    version: "z0c-migration-readiness-review-v1",
    tokenomicsDecision: {
      ...z0cTokenomicsDecisionTemplate,
      canonicalAsset: "zeero-native",
      supplyPolicy: "fixed",
      issuanceAuthority: "zeero-protocol-earned-issuance",
      treasuryCustody: "no-premine-no-reserve",
      migrationPolicy: "burn-and-mint",
      starknetNetwork: "sepolia",
      allocationPolicyReference: "docs/Z0C_ALLOCATION_POLICY.md",
      auditPlanReference: "docs/Z0C_AUDIT_PLAN.md",
    },
    migrationMechanism: {
      migrationPolicy: "burn-and-mint",
      targetNetwork: "sepolia",
      supplyPreservationReview: "reviewed",
      l1BurnProofReview: "reviewed",
      lockCustodyReview: "not-reviewed",
      redemptionFailureReview: "reviewed",
    },
    strk20Compatibility: {
      freshnessStatus: "current-at-review",
      poolCompatibility: "reviewed-compatible",
      walletApiCompatibility: "reviewed-compatible",
      privateTransferCompatibility: "reviewed-compatible",
      disclosureModelReviewed: "reviewed",
      screeningModelReviewed: "reviewed",
    },
    contractControls: {
      standard: "ERC-20",
      decimals: 18,
      independentSupply: false,
      mintAuthority: "reviewed-no-independent-issuance",
      burnAuthority: "reviewed-no-independent-issuance",
      pauseAuthority: "reviewed-no-independent-issuance",
      upgradeAuthority: "reviewed-no-independent-issuance",
    },
    auditPlanReference: "docs/Z0C_AUDIT_PLAN.md",
    sourceNotes: [
      "Reviewed source pins, pool compatibility, Wallet API capability, and migration controls are required before Cairo drafting.",
    ],
  };
}

test("Z0C migration review template blocks Cairo contract drafting", () => {
  const readiness = getZ0CRepresentationContractDraftReadiness(z0cMigrationReadinessReviewTemplate);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.implementationStatus, "not-started");
  assert.ok(readiness.blockers.includes("Z0C_MIGRATION_POLICY_NOT_SELECTED"));
  assert.ok(readiness.blockers.includes("Z0C_STARKNET_NETWORK_NOT_SELECTED"));
  assert.ok(readiness.blockers.includes("Z0C_STRK20_FRESHNESS_NOT_CURRENT"));
  assert.ok(readiness.blockers.includes("Z0C_STRK20_POOL_COMPATIBILITY_NOT_VERIFIED"));
  assert.ok(readiness.blockedActions.includes("checkout-activation"));
});

test("burn-and-mint is the default recommendation while no migration policy is selected", () => {
  const recommendation = getZ0CMigrationMechanismRecommendation(z0cMigrationReadinessReviewTemplate);
  assert.equal(recommendation?.policy, "burn-and-mint");
  assert.equal(z0cMigrationRouteSummaries.length, 2);
  assert.equal(z0cMigrationReviewFacts.currentTemplateReady, false);
  assert.equal(z0cMigrationReviewFacts.z0cUnitsPerZeeroL1AtomicUnit, 10_000_000_000n);
});

test("a fully reviewed burn-and-mint plan can unlock only local Cairo drafting", () => {
  const readiness = getZ0CRepresentationContractDraftReadiness(reviewedBurnAndMint());
  assert.equal(readiness.ready, true);
  assert.equal(readiness.implementationStatus, "local-draft-ready");
  assert.equal(readiness.allowedNextStep, "draft-local-cairo-representation-contract");
  assert.deepEqual(readiness.blockers, []);
  assert.ok(readiness.blockedActions.includes("contract-deployment"));
  assert.ok(readiness.blockedActions.includes("strk20-transaction"));
});

test("STRK20 compatibility remains blocked when freshness or wallet evidence is stale", () => {
  const blockers = validateZ0CMigrationReadinessReview({
    ...reviewedBurnAndMint(),
    strk20Compatibility: {
      ...reviewedBurnAndMint().strk20Compatibility,
      freshnessStatus: "drift-observed",
      walletApiCompatibility: "not-reviewed",
    },
  });
  assert.ok(blockers.includes("Z0C_STRK20_FRESHNESS_NOT_CURRENT"));
  assert.ok(blockers.includes("Z0C_STRK20_WALLET_API_NOT_VERIFIED"));
});

test("migration policy and network must match the tokenomics decision", () => {
  const blockers = validateZ0CMigrationReadinessReview({
    ...reviewedBurnAndMint(),
    migrationMechanism: {
      ...reviewedBurnAndMint().migrationMechanism,
      migrationPolicy: "lock-and-mint",
      targetNetwork: "mainnet",
    },
  });
  assert.ok(blockers.includes("Z0C_MIGRATION_POLICY_DECISION_MISMATCH"));
  assert.ok(blockers.includes("Z0C_STARKNET_NETWORK_DECISION_MISMATCH"));
});

test("lock-and-mint cannot pass without reviewed custody controls", () => {
  const burn = reviewedBurnAndMint();
  const blockers = validateZ0CMigrationReadinessReview({
    ...burn,
    tokenomicsDecision: {
      ...burn.tokenomicsDecision,
      migrationPolicy: "lock-and-mint",
    },
    migrationMechanism: {
      ...burn.migrationMechanism,
      migrationPolicy: "lock-and-mint",
      l1BurnProofReview: "not-reviewed",
      lockCustodyReview: "not-reviewed",
    },
  });
  assert.ok(blockers.includes("Z0C_LOCK_CUSTODY_NOT_REVIEWED"));
  assert.ok(!blockers.includes("Z0C_L1_BURN_PROOF_NOT_REVIEWED"));
});

test("migration review notes reject sensitive material", () => {
  const blockers = validateZ0CMigrationReadinessReview({
    ...reviewedBurnAndMint(),
    sourceNotes: ["operator private_key should never be stored here"],
  });
  assert.ok(blockers.includes("Z0C_SOURCE_NOTES_CONTAIN_SENSITIVE_MATERIAL"));
});
