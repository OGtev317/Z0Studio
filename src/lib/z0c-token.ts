export type Z0CPaymentPurpose = "room-entry" | "locked-drop" | "creator-tip";

export type Z0CPaymentIntent = {
  creatorHandle: string;
  roomId: string;
  purpose: Z0CPaymentPurpose;
  amount: string;
  units: bigint;
  asset: "Z0C";
  paymentRail: "z0c-strk20-private-transfer";
  status: "local-draft-only";
};

export type Z0CRepresentationSupplySnapshot = {
  zeeroL1BackingAtomicUnits: bigint;
  z0cOutstandingUnits: bigint;
};

export const Z0C_DECIMALS = 18;
export const Z0C_MAX_UNITS = (1n << 128n) - 1n;
export const ZEERO_L1_DECIMALS = 8;
export const ZEERO_L1_ATOMIC_UNITS_PER_ZEERO = 100_000_000n;
export const ZEERO_L1_HARD_CAP_ATOMIC_UNITS = 5_000_000_000_000_000n;
export const ZEERO_L1_HARD_CAP = "50000000";
export const Z0C_UNITS_PER_ZEERO_L1_ATOMIC_UNIT = 10n ** BigInt(Z0C_DECIMALS - ZEERO_L1_DECIMALS);
export const Z0C_HARD_CAP_UNITS = ZEERO_L1_HARD_CAP_ATOMIC_UNITS * Z0C_UNITS_PER_ZEERO_L1_ATOMIC_UNIT;

export const z0cAssetSpec = {
  version: "z0c-asset-spec-v1",
  name: "ZeeroCash",
  symbol: "Z0C",
  decimals: Z0C_DECIMALS,
  status: "inherits-local-zeero-l1-tokenomics",
  canonicalAsset: {
    symbol: "ZEERO",
    network: "zeero-l1-design-candidate",
    tokenomicsSource: "ZEERO_L1_FIXED_SUPPLY_TOKENOMICS_V1",
    tokenomicsStatus: "bitcoin-inspired-envelope-captured-not-launched",
    supplyPolicy: `fixed-${ZEERO_L1_HARD_CAP}-zeero-cap`,
    issuancePolicy: "earned-protocol-issuance",
    fairLaunchPolicy: "no-premine-no-insider-allocation",
  },
  starknetRepresentation: {
    standard: "ERC-20",
    contractAddress: null,
    network: null,
    role: "future-non-canonical-representation",
    supplyPolicy: "inherits-zeero-l1-fixed-cap",
    issuanceAuthority: "no-independent-issuance",
  },
  zeeroRepresentation: {
    status: "local-design-candidate-not-launched",
    migrationPolicy: "not-selected",
  },
  blockedActions: [
    "token-deployment",
    "token-mint",
    "wallet-signing",
    "strk20-transaction",
    "bridge-deployment",
    "database-write",
  ],
} as const;

export function parseZ0CAmount(value: string): { display: string; units: bigint } {
  const input = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(input)) {
    throw new Error("Z0C_AMOUNT_INVALID");
  }

  const [whole, fraction = ""] = input.split(".");
  const units = BigInt(whole) * 10n ** BigInt(Z0C_DECIMALS)
    + BigInt(fraction.padEnd(Z0C_DECIMALS, "0"));
  if (units === 0n || units > Z0C_MAX_UNITS || units > Z0C_HARD_CAP_UNITS) {
    throw new Error("Z0C_AMOUNT_OUT_OF_RANGE");
  }

  const normalizedFraction = fraction.replace(/0+$/, "");
  return { display: normalizedFraction ? `${whole}.${normalizedFraction}` : whole, units };
}

export function zeeroL1AtomicUnitsToZ0CUnits(value: bigint): bigint {
  if (value < 0n || value > ZEERO_L1_HARD_CAP_ATOMIC_UNITS) {
    throw new Error("ZEERO_L1_ATOMIC_AMOUNT_OUT_OF_RANGE");
  }
  return value * Z0C_UNITS_PER_ZEERO_L1_ATOMIC_UNIT;
}

export function z0CUnitsToZeeroL1AtomicUnits(value: bigint): bigint {
  if (value < 0n || value > Z0C_HARD_CAP_UNITS) {
    throw new Error("Z0C_AMOUNT_OUT_OF_RANGE");
  }
  if (value % Z0C_UNITS_PER_ZEERO_L1_ATOMIC_UNIT !== 0n) {
    throw new Error("Z0C_AMOUNT_NOT_REPRESENTABLE_ON_ZEERO_L1");
  }
  return value / Z0C_UNITS_PER_ZEERO_L1_ATOMIC_UNIT;
}

export function validateZ0CRepresentationSupplyInvariant(
  snapshot: Z0CRepresentationSupplySnapshot,
): readonly string[] {
  const blockers: string[] = [];

  if (
    snapshot.zeeroL1BackingAtomicUnits < 0n
    || snapshot.zeeroL1BackingAtomicUnits > ZEERO_L1_HARD_CAP_ATOMIC_UNITS
  ) {
    blockers.push("ZEERO_L1_BACKING_OUT_OF_RANGE");
  }
  if (snapshot.z0cOutstandingUnits < 0n || snapshot.z0cOutstandingUnits > Z0C_HARD_CAP_UNITS) {
    blockers.push("Z0C_OUTSTANDING_SUPPLY_OUT_OF_RANGE");
  }
  if (blockers.length > 0) return blockers;

  const expectedZ0CUnits = zeeroL1AtomicUnitsToZ0CUnits(snapshot.zeeroL1BackingAtomicUnits);
  if (snapshot.z0cOutstandingUnits !== expectedZ0CUnits) {
    blockers.push("Z0C_OUTSTANDING_SUPPLY_NOT_FULLY_BACKED");
  }
  return blockers;
}

export function createZ0CPaymentIntent(input: {
  creatorHandle: string;
  roomId: string;
  purpose: Z0CPaymentPurpose;
  amount: string;
}): Z0CPaymentIntent {
  if (!isZ0CPaymentPurpose(input.purpose)) throw new Error("Z0C_PURPOSE_INVALID");

  const { display, units } = parseZ0CAmount(input.amount);
  z0CUnitsToZeeroL1AtomicUnits(units);
  const creatorHandle = cleanHandle(input.creatorHandle);
  const roomId = cleanRoomId(input.roomId);
  assertNoSensitiveMaterial(`${creatorHandle} ${roomId}`);

  return {
    creatorHandle,
    roomId,
    purpose: input.purpose,
    amount: display,
    units,
    asset: "Z0C",
    paymentRail: "z0c-strk20-private-transfer",
    status: "local-draft-only",
  };
}

export function getZ0CCheckoutReadiness() {
  return {
    ready: false,
    blockers: [
      "Z0C_STARKNET_CONTRACT_NOT_DEPLOYED",
      "Z0C_TARGET_NETWORK_NOT_SELECTED",
      "ZEERO_L1_EMISSION_NOT_ACTIVE",
      "Z0C_STRK20_POOL_COMPATIBILITY_NOT_VERIFIED",
      "Z0C_MIGRATION_POLICY_NOT_SELECTED",
      "Z0C_AUDIT_PLAN_NOT_REVIEWED",
    ],
  } as const;
}

function isZ0CPaymentPurpose(value: string): value is Z0CPaymentPurpose {
  return value === "room-entry" || value === "locked-drop" || value === "creator-tip";
}

function cleanHandle(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(cleaned)) {
    throw new Error("Z0C_CREATOR_HANDLE_INVALID");
  }
  return cleaned;
}

function cleanRoomId(value: string): string {
  const cleaned = value.replace(/\s+/g, "-").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(cleaned)) {
    throw new Error("Z0C_ROOM_ID_INVALID");
  }
  return cleaned;
}

function assertNoSensitiveMaterial(value: string): void {
  if (/(private[_-]?key|seed phrase|mnemonic|viewing[_-]?key|witness|note secret|secret)/i.test(value)) {
    throw new Error("Z0C_SENSITIVE_MATERIAL_REJECTED");
  }
}
