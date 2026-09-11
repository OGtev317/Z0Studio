export type Z0CCanonicalAsset = "not-selected" | "starknet-erc20" | "zeero-native";
export type Z0CSupplyPolicy = "not-selected" | "fixed" | "capped" | "governed";
export type Z0CIssuanceAuthority =
  | "not-selected"
  | "none-fixed-supply"
  | "zeero-protocol-earned-issuance"
  | "timelocked-governance";
export type Z0CTreasuryCustody =
  | "not-selected"
  | "no-premine-no-reserve"
  | "multisig"
  | "timelocked-governance";
export type Z0CMigrationPolicy = "not-selected" | "burn-and-mint" | "lock-and-mint";
export type Z0CStarknetNetwork = "not-selected" | "sepolia" | "mainnet";

export type Z0CTokenomicsDecision = {
  version: "z0c-tokenomics-decision-v1";
  canonicalAsset: Z0CCanonicalAsset;
  supplyPolicy: Z0CSupplyPolicy;
  issuanceAuthority: Z0CIssuanceAuthority;
  treasuryCustody: Z0CTreasuryCustody;
  migrationPolicy: Z0CMigrationPolicy;
  starknetNetwork: Z0CStarknetNetwork;
  allocationPolicyReference: string | null;
  auditPlanReference: string | null;
};

export const z0cTokenomicsDecisionTemplate: Z0CTokenomicsDecision = {
  version: "z0c-tokenomics-decision-v1",
  canonicalAsset: "not-selected",
  supplyPolicy: "not-selected",
  issuanceAuthority: "not-selected",
  treasuryCustody: "not-selected",
  migrationPolicy: "not-selected",
  starknetNetwork: "not-selected",
  allocationPolicyReference: null,
  auditPlanReference: null,
};

// This records the local Zeero L1 monetary envelope without asserting a live asset or bridge.
export const z0cInheritedL1TokenomicsDecision: Z0CTokenomicsDecision = {
  version: "z0c-tokenomics-decision-v1",
  canonicalAsset: "zeero-native",
  supplyPolicy: "fixed",
  issuanceAuthority: "zeero-protocol-earned-issuance",
  treasuryCustody: "no-premine-no-reserve",
  migrationPolicy: "not-selected",
  starknetNetwork: "not-selected",
  allocationPolicyReference: "docs/Z0C_ALLOCATION_POLICY.md",
  auditPlanReference: null,
};

export function validateZ0CTokenomicsDecision(decision: Z0CTokenomicsDecision): readonly string[] {
  const blockers: string[] = [];

  if (decision.canonicalAsset === "not-selected") blockers.push("Z0C_CANONICAL_ASSET_NOT_SELECTED");
  if (decision.supplyPolicy === "not-selected") blockers.push("Z0C_SUPPLY_POLICY_NOT_SELECTED");
  if (decision.issuanceAuthority === "not-selected") blockers.push("Z0C_ISSUANCE_AUTHORITY_NOT_SELECTED");
  if (decision.treasuryCustody === "not-selected") blockers.push("Z0C_TREASURY_CUSTODY_NOT_SELECTED");
  if (decision.migrationPolicy === "not-selected") blockers.push("Z0C_MIGRATION_POLICY_NOT_SELECTED");
  if (decision.starknetNetwork === "not-selected") blockers.push("Z0C_STARKNET_NETWORK_NOT_SELECTED");
  if (!isDocumentReference(decision.allocationPolicyReference)) blockers.push("Z0C_ALLOCATION_POLICY_NOT_REVIEWED");
  if (!isDocumentReference(decision.auditPlanReference)) blockers.push("Z0C_AUDIT_PLAN_NOT_REVIEWED");

  if (
    decision.supplyPolicy === "fixed"
    && decision.issuanceAuthority !== "none-fixed-supply"
    && decision.issuanceAuthority !== "zeero-protocol-earned-issuance"
  ) {
    blockers.push("Z0C_FIXED_SUPPLY_REQUIRES_NO_ISSUANCE_AUTHORITY");
  }
  if (
    decision.supplyPolicy !== "fixed"
    && (decision.issuanceAuthority === "none-fixed-supply" || decision.issuanceAuthority === "zeero-protocol-earned-issuance")
  ) {
    blockers.push("Z0C_NON_FIXED_SUPPLY_REQUIRES_GOVERNED_ISSUANCE");
  }
  if (decision.issuanceAuthority === "zeero-protocol-earned-issuance" && decision.canonicalAsset !== "zeero-native") {
    blockers.push("Z0C_EARNED_ISSUANCE_REQUIRES_ZEERO_NATIVE_CANONICAL_ASSET");
  }

  return blockers;
}

export function getZ0CContractBuildReadiness(decision: Z0CTokenomicsDecision) {
  const blockers = validateZ0CTokenomicsDecision(decision);
  return {
    ready: blockers.length === 0,
    blockers,
  } as const;
}

function isDocumentReference(value: string | null): value is string {
  return value !== null && /^docs\/[A-Z0-9_-]+\.md$/.test(value);
}
