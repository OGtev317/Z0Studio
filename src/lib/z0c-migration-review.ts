import {
  Z0C_DECIMALS,
  Z0C_UNITS_PER_ZEERO_L1_ATOMIC_UNIT,
  ZEERO_L1_DECIMALS,
  ZEERO_L1_HARD_CAP_ATOMIC_UNITS,
  z0cAssetSpec,
} from "./z0c-token";
import {
  type Z0CMigrationPolicy,
  type Z0CStarknetNetwork,
  type Z0CTokenomicsDecision,
  validateZ0CTokenomicsDecision,
  z0cInheritedL1TokenomicsDecision,
} from "./z0c-tokenomics";

export type Z0CReviewStatus = "not-reviewed" | "reviewed";
export type Z0CStrk20FreshnessStatus = "not-run" | "drift-observed" | "current-at-review";
export type Z0CCompatibilityStatus = "not-reviewed" | "reviewed-compatible" | "reviewed-incompatible";
export type Z0CAuthorityStatus = "not-reviewed" | "reviewed-no-independent-issuance";
export type Z0CImplementationStatus = "not-started" | "local-draft-ready";

export type Z0CStrk20CompatibilityEvidence = {
  freshnessStatus: Z0CStrk20FreshnessStatus;
  poolCompatibility: Z0CCompatibilityStatus;
  walletApiCompatibility: Z0CCompatibilityStatus;
  privateTransferCompatibility: Z0CCompatibilityStatus;
  disclosureModelReviewed: Z0CReviewStatus;
  screeningModelReviewed: Z0CReviewStatus;
};

export type Z0CMigrationMechanismEvidence = {
  migrationPolicy: Z0CMigrationPolicy;
  targetNetwork: Z0CStarknetNetwork;
  supplyPreservationReview: Z0CReviewStatus;
  l1BurnProofReview: Z0CReviewStatus;
  lockCustodyReview: Z0CReviewStatus;
  redemptionFailureReview: Z0CReviewStatus;
};

export type Z0CContractControlEvidence = {
  standard: "ERC-20";
  decimals: typeof Z0C_DECIMALS;
  independentSupply: false;
  mintAuthority: Z0CAuthorityStatus;
  burnAuthority: Z0CAuthorityStatus;
  pauseAuthority: Z0CAuthorityStatus;
  upgradeAuthority: Z0CAuthorityStatus;
};

export type Z0CMigrationReadinessReview = {
  version: "z0c-migration-readiness-review-v1";
  tokenomicsDecision: Z0CTokenomicsDecision;
  migrationMechanism: Z0CMigrationMechanismEvidence;
  strk20Compatibility: Z0CStrk20CompatibilityEvidence;
  contractControls: Z0CContractControlEvidence;
  auditPlanReference: string | null;
  sourceNotes: readonly string[];
};

export type Z0CMigrationRouteSummary = {
  policy: Exclude<Z0CMigrationPolicy, "not-selected">;
  fit: string;
  primaryRisk: string;
  requiredEvidence: readonly string[];
};

export const z0cMigrationRouteSummaries: readonly Z0CMigrationRouteSummary[] = [
  {
    policy: "burn-and-mint",
    fit: "cleanest supply boundary because one representation must be destroyed before the next one exists",
    primaryRisk: "requires a reviewed Zeero L1 burn proof or finality signal before Starknet minting",
    requiredEvidence: [
      "reviewed Zeero L1 burn event or exit-proof format",
      "exact replay domain for one-time migration",
      "mint cap bound to the burned L1 atomic units",
      "redemption failure and rollback policy",
    ],
  },
  {
    policy: "lock-and-mint",
    fit: "useful only if users need reversible representation between Zeero L1 and Starknet",
    primaryRisk: "introduces custody and bridge-control risk that conflicts with no independent Z0C issuance unless tightly constrained",
    requiredEvidence: [
      "audited lock custody mechanism",
      "withdrawal and unlock authorization rules",
      "proof that locked units equal outstanding Z0C units",
      "operator compromise and pause recovery plan",
    ],
  },
] as const;

export const z0cMigrationReadinessReviewTemplate: Z0CMigrationReadinessReview = {
  version: "z0c-migration-readiness-review-v1",
  tokenomicsDecision: z0cInheritedL1TokenomicsDecision,
  migrationMechanism: {
    migrationPolicy: "not-selected",
    targetNetwork: "not-selected",
    supplyPreservationReview: "not-reviewed",
    l1BurnProofReview: "not-reviewed",
    lockCustodyReview: "not-reviewed",
    redemptionFailureReview: "not-reviewed",
  },
  strk20Compatibility: {
    freshnessStatus: "drift-observed",
    poolCompatibility: "not-reviewed",
    walletApiCompatibility: "not-reviewed",
    privateTransferCompatibility: "not-reviewed",
    disclosureModelReviewed: "not-reviewed",
    screeningModelReviewed: "not-reviewed",
  },
  contractControls: {
    standard: "ERC-20",
    decimals: Z0C_DECIMALS,
    independentSupply: false,
    mintAuthority: "not-reviewed",
    burnAuthority: "not-reviewed",
    pauseAuthority: "not-reviewed",
    upgradeAuthority: "not-reviewed",
  },
  auditPlanReference: null,
  sourceNotes: [
    "STRK20 freshness check reported version and page drift on 2026-09-10; re-read primary sources before changing pins or wallet/API status.",
    "Z0C remains a non-canonical Starknet representation of the local ZEERO monetary envelope.",
    "Wallet-held signing keys, viewing keys, private notes, and proof material stay out of Z0Studio.",
  ],
} as const;

export function getZ0CMigrationMechanismRecommendation(review: Z0CMigrationReadinessReview): Z0CMigrationRouteSummary | null {
  if (review.migrationMechanism.migrationPolicy === "not-selected") return z0cMigrationRouteSummaries[0];
  return z0cMigrationRouteSummaries.find((route) => route.policy === review.migrationMechanism.migrationPolicy) ?? null;
}

export function validateZ0CMigrationReadinessReview(review: Z0CMigrationReadinessReview): readonly string[] {
  const blockers = new Set<string>(validateZ0CTokenomicsDecision(review.tokenomicsDecision));

  if (review.version !== "z0c-migration-readiness-review-v1") blockers.add("Z0C_MIGRATION_REVIEW_VERSION_INVALID");
  if (review.tokenomicsDecision.canonicalAsset !== "zeero-native") blockers.add("Z0C_CANONICAL_ASSET_MUST_REMAIN_ZEERO_NATIVE");
  if (review.tokenomicsDecision.supplyPolicy !== "fixed") blockers.add("Z0C_SUPPLY_POLICY_MUST_REMAIN_FIXED");
  if (review.tokenomicsDecision.treasuryCustody !== "no-premine-no-reserve") blockers.add("Z0C_TREASURY_POLICY_MUST_REMAIN_FAIR_LAUNCH");

  const mechanism = review.migrationMechanism;
  if (mechanism.migrationPolicy === "not-selected") blockers.add("Z0C_MIGRATION_POLICY_NOT_SELECTED");
  if (mechanism.targetNetwork === "not-selected") blockers.add("Z0C_STARKNET_NETWORK_NOT_SELECTED");
  if (mechanism.migrationPolicy !== review.tokenomicsDecision.migrationPolicy) blockers.add("Z0C_MIGRATION_POLICY_DECISION_MISMATCH");
  if (mechanism.targetNetwork !== review.tokenomicsDecision.starknetNetwork) blockers.add("Z0C_STARKNET_NETWORK_DECISION_MISMATCH");
  if (mechanism.supplyPreservationReview !== "reviewed") blockers.add("Z0C_SUPPLY_PRESERVATION_NOT_REVIEWED");
  if (mechanism.redemptionFailureReview !== "reviewed") blockers.add("Z0C_REDEMPTION_FAILURE_NOT_REVIEWED");
  if (mechanism.migrationPolicy === "burn-and-mint" && mechanism.l1BurnProofReview !== "reviewed") {
    blockers.add("Z0C_L1_BURN_PROOF_NOT_REVIEWED");
  }
  if (mechanism.migrationPolicy === "lock-and-mint" && mechanism.lockCustodyReview !== "reviewed") {
    blockers.add("Z0C_LOCK_CUSTODY_NOT_REVIEWED");
  }

  const strk20 = review.strk20Compatibility;
  if (strk20.freshnessStatus !== "current-at-review") blockers.add("Z0C_STRK20_FRESHNESS_NOT_CURRENT");
  if (strk20.poolCompatibility !== "reviewed-compatible") blockers.add("Z0C_STRK20_POOL_COMPATIBILITY_NOT_VERIFIED");
  if (strk20.walletApiCompatibility !== "reviewed-compatible") blockers.add("Z0C_STRK20_WALLET_API_NOT_VERIFIED");
  if (strk20.privateTransferCompatibility !== "reviewed-compatible") blockers.add("Z0C_STRK20_PRIVATE_TRANSFER_NOT_VERIFIED");
  if (strk20.disclosureModelReviewed !== "reviewed") blockers.add("Z0C_STRK20_DISCLOSURE_MODEL_NOT_REVIEWED");
  if (strk20.screeningModelReviewed !== "reviewed") blockers.add("Z0C_STRK20_SCREENING_MODEL_NOT_REVIEWED");

  const controls = review.contractControls;
  if (controls.standard !== "ERC-20") blockers.add("Z0C_CONTRACT_STANDARD_NOT_ERC20");
  if (controls.decimals !== Z0C_DECIMALS) blockers.add("Z0C_CONTRACT_DECIMALS_MISMATCH");
  if (controls.independentSupply !== false) blockers.add("Z0C_INDEPENDENT_SUPPLY_NOT_ALLOWED");
  for (const [key, value] of Object.entries({
    mintAuthority: controls.mintAuthority,
    burnAuthority: controls.burnAuthority,
    pauseAuthority: controls.pauseAuthority,
    upgradeAuthority: controls.upgradeAuthority,
  })) {
    if (value !== "reviewed-no-independent-issuance") blockers.add(`Z0C_${key.replace(/Authority$/, "").toUpperCase()}_AUTHORITY_NOT_REVIEWED`);
  }

  if (!isDocumentReference(review.auditPlanReference)) blockers.add("Z0C_AUDIT_PLAN_NOT_REVIEWED");
  if (!Array.isArray(review.sourceNotes) || review.sourceNotes.length === 0) blockers.add("Z0C_SOURCE_NOTES_REQUIRED");
  if (review.sourceNotes.some(containsSensitiveMaterial)) blockers.add("Z0C_SOURCE_NOTES_CONTAIN_SENSITIVE_MATERIAL");

  return [...blockers];
}

export function getZ0CRepresentationContractDraftReadiness(review: Z0CMigrationReadinessReview) {
  const blockers = validateZ0CMigrationReadinessReview(review);
  return {
    ready: blockers.length === 0,
    implementationStatus: blockers.length === 0 ? "local-draft-ready" : "not-started" as Z0CImplementationStatus,
    blockers,
    allowedNextStep: blockers.length === 0
      ? "draft-local-cairo-representation-contract"
      : "complete-migration-network-strk20-and-audit-review-before-cairo-drafting",
    blockedActions: [
      "contract-deployment",
      "token-mint",
      "token-transfer",
      "wallet-signing",
      "strk20-transaction",
      "bridge-deployment",
      "database-write",
      "checkout-activation",
    ],
  } as const;
}

export const z0cMigrationReviewFacts = {
  sourceEnvelope: z0cAssetSpec.canonicalAsset.tokenomicsSource,
  z0cDecimals: Z0C_DECIMALS,
  zeeroL1Decimals: ZEERO_L1_DECIMALS,
  zeeroL1HardCapAtomicUnits: ZEERO_L1_HARD_CAP_ATOMIC_UNITS,
  z0cUnitsPerZeeroL1AtomicUnit: Z0C_UNITS_PER_ZEERO_L1_ATOMIC_UNIT,
  currentTemplateReady: false,
} as const;

function isDocumentReference(value: string | null): value is string {
  return value !== null && /^docs\/[A-Z0-9_-]+\.md$/.test(value);
}

function containsSensitiveMaterial(value: string): boolean {
  return /(private[_-]?key|seed phrase|mnemonic|viewing[_-]?key|witness|note secret|secret|api[_-]?key|token)/i.test(value);
}
