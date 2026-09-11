import assert from "node:assert/strict";
import test from "node:test";
import {
  Z0C_DECIMALS,
  Z0C_HARD_CAP_UNITS,
  ZEERO_L1_HARD_CAP_ATOMIC_UNITS,
  createZ0CPaymentIntent,
  getZ0CCheckoutReadiness,
  parseZ0CAmount,
  validateZ0CRepresentationSupplyInvariant,
  z0CUnitsToZeeroL1AtomicUnits,
  zeeroL1AtomicUnitsToZ0CUnits,
  z0cAssetSpec,
} from "../src/lib/z0c-token";

test("Z0C inherits the local Zeero L1 envelope and is not a deployed token", () => {
  assert.equal(z0cAssetSpec.name, "ZeeroCash");
  assert.equal(z0cAssetSpec.symbol, "Z0C");
  assert.equal(z0cAssetSpec.decimals, Z0C_DECIMALS);
  assert.equal(z0cAssetSpec.status, "inherits-local-zeero-l1-tokenomics");
  assert.equal(z0cAssetSpec.canonicalAsset.symbol, "ZEERO");
  assert.equal(z0cAssetSpec.canonicalAsset.supplyPolicy, "fixed-50000000-zeero-cap");
  assert.equal(z0cAssetSpec.starknetRepresentation.issuanceAuthority, "no-independent-issuance");
  assert.equal(z0cAssetSpec.starknetRepresentation.contractAddress, null);
  assert.equal(z0cAssetSpec.zeeroRepresentation.status, "local-design-candidate-not-launched");
  assert.ok(z0cAssetSpec.blockedActions.includes("token-deployment"));
  assert.ok(z0cAssetSpec.blockedActions.includes("wallet-signing"));
});

test("Z0C amounts use exact 18-decimal units without floating point", () => {
  assert.deepEqual(parseZ0CAmount("12.3400"), {
    display: "12.34",
    units: 12_340_000_000_000_000_000n,
  });
  assert.deepEqual(parseZ0CAmount("0.000000000000000001"), {
    display: "0.000000000000000001",
    units: 1n,
  });
  assert.throws(() => parseZ0CAmount("0"), /Z0C_AMOUNT_OUT_OF_RANGE/);
  assert.throws(() => parseZ0CAmount("1.0000000000000000001"), /Z0C_AMOUNT_INVALID/);
  assert.throws(() => parseZ0CAmount("1e3"), /Z0C_AMOUNT_INVALID/);
  assert.throws(() => parseZ0CAmount("50000000.000000000000000001"), /Z0C_AMOUNT_OUT_OF_RANGE/);
});

test("Z0C uses an exact local unit translation to the Zeero L1 atomic unit", () => {
  assert.equal(zeeroL1AtomicUnitsToZ0CUnits(1n), 10_000_000_000n);
  assert.equal(zeeroL1AtomicUnitsToZ0CUnits(ZEERO_L1_HARD_CAP_ATOMIC_UNITS), Z0C_HARD_CAP_UNITS);
  assert.equal(z0CUnitsToZeeroL1AtomicUnits(12_340_000_000_000_000_000n), 1_234_000_000n);
  assert.throws(() => z0CUnitsToZeeroL1AtomicUnits(1n), /Z0C_AMOUNT_NOT_REPRESENTABLE_ON_ZEERO_L1/);
});

test("a future Z0C representation cannot exceed or detach from ZEERO backing", () => {
  assert.deepEqual(validateZ0CRepresentationSupplyInvariant({
    zeeroL1BackingAtomicUnits: 1_234_000_000n,
    z0cOutstandingUnits: 12_340_000_000_000_000_000n,
  }), []);
  assert.deepEqual(validateZ0CRepresentationSupplyInvariant({
    zeeroL1BackingAtomicUnits: 1_234_000_000n,
    z0cOutstandingUnits: 12_340_000_000_000_000_001n,
  }), ["Z0C_OUTSTANDING_SUPPLY_NOT_FULLY_BACKED"]);
  assert.deepEqual(validateZ0CRepresentationSupplyInvariant({
    zeeroL1BackingAtomicUnits: ZEERO_L1_HARD_CAP_ATOMIC_UNITS + 1n,
    z0cOutstandingUnits: Z0C_HARD_CAP_UNITS,
  }), ["ZEERO_L1_BACKING_OUT_OF_RANGE"]);
});

test("Z0C payment intents stay local and do not create a wallet action", () => {
  const intent = createZ0CPaymentIntent({
    creatorHandle: "@zero-studio",
    roomId: "Zero Studio Room",
    purpose: "room-entry",
    amount: "9.25",
  });
  assert.equal(intent.creatorHandle, "zero-studio");
  assert.equal(intent.roomId, "zero-studio-room");
  assert.equal(intent.asset, "Z0C");
  assert.equal(intent.paymentRail, "z0c-strk20-private-transfer");
  assert.equal(intent.status, "local-draft-only");
  assert.equal(intent.units, 9_250_000_000_000_000_000n);
  assert.throws(() => createZ0CPaymentIntent({
    creatorHandle: "zero-studio",
    roomId: "zero-studio-room",
    purpose: "creator-tip",
    amount: "0.000000000000000001",
  }), /Z0C_AMOUNT_NOT_REPRESENTABLE_ON_ZEERO_L1/);
});

test("Z0C checkout fails closed until the token and privacy route are reviewed", () => {
  const readiness = getZ0CCheckoutReadiness();
  assert.equal(readiness.ready, false);
  assert.ok(readiness.blockers.includes("Z0C_STARKNET_CONTRACT_NOT_DEPLOYED"));
  assert.ok(readiness.blockers.includes("ZEERO_L1_EMISSION_NOT_ACTIVE"));
  assert.ok(readiness.blockers.includes("Z0C_STRK20_POOL_COMPATIBILITY_NOT_VERIFIED"));
  assert.ok(readiness.blockers.includes("Z0C_MIGRATION_POLICY_NOT_SELECTED"));
});
