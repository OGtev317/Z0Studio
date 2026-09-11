import assert from "node:assert/strict";
import test from "node:test";
import {
  getZ0CContractBuildReadiness,
  validateZ0CTokenomicsDecision,
  z0cInheritedL1TokenomicsDecision,
  z0cTokenomicsDecisionTemplate,
} from "../src/lib/z0c-tokenomics";

test("Z0C contract work is blocked until every economic control is reviewed", () => {
  const readiness = getZ0CContractBuildReadiness(z0cTokenomicsDecisionTemplate);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.blockers.includes("Z0C_CANONICAL_ASSET_NOT_SELECTED"));
  assert.ok(readiness.blockers.includes("Z0C_SUPPLY_POLICY_NOT_SELECTED"));
  assert.ok(readiness.blockers.includes("Z0C_TREASURY_CUSTODY_NOT_SELECTED"));
  assert.ok(readiness.blockers.includes("Z0C_AUDIT_PLAN_NOT_REVIEWED"));
});

test("a fixed Z0C supply cannot retain an issuance authority", () => {
  const blockers = validateZ0CTokenomicsDecision({
    ...z0cTokenomicsDecisionTemplate,
    canonicalAsset: "zeero-native",
    supplyPolicy: "fixed",
    issuanceAuthority: "timelocked-governance",
    treasuryCustody: "multisig",
    migrationPolicy: "burn-and-mint",
    starknetNetwork: "sepolia",
    allocationPolicyReference: "docs/Z0C_ALLOCATION_POLICY.md",
    auditPlanReference: "docs/Z0C_AUDIT_PLAN.md",
  });
  assert.ok(blockers.includes("Z0C_FIXED_SUPPLY_REQUIRES_NO_ISSUANCE_AUTHORITY"));
});

test("a complete reviewed Z0C decision can unlock local contract drafting", () => {
  const readiness = getZ0CContractBuildReadiness({
    ...z0cTokenomicsDecisionTemplate,
    canonicalAsset: "zeero-native",
    supplyPolicy: "fixed",
    issuanceAuthority: "zeero-protocol-earned-issuance",
    treasuryCustody: "no-premine-no-reserve",
    migrationPolicy: "burn-and-mint",
    starknetNetwork: "sepolia",
    allocationPolicyReference: "docs/Z0C_ALLOCATION_POLICY.md",
    auditPlanReference: "docs/Z0C_AUDIT_PLAN.md",
  });
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.blockers, []);
});

test("the inherited Zeero L1 model blocks only unresolved representation work", () => {
  const readiness = getZ0CContractBuildReadiness(z0cInheritedL1TokenomicsDecision);
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.blockers, [
    "Z0C_MIGRATION_POLICY_NOT_SELECTED",
    "Z0C_STARKNET_NETWORK_NOT_SELECTED",
    "Z0C_AUDIT_PLAN_NOT_REVIEWED",
  ]);
});
