import { createHash } from "node:crypto";
import { RpcProvider, hash, shortString } from "starknet";
import {
  STRK20_EXPECTED_LIVE_ABI_SHA256,
  STRK20_SEPOLIA_POOL,
} from "./strk20-sepolia";

export const STARKNET_SEPOLIA_CHAIN_ID = "0x534e5f5345504f4c4941" as const;
export const DEFAULT_STARKNET_HEALTH_INTERVAL_MS = 6_000;
export const DEFAULT_STARKNET_MAX_HEAD_AGE_SECONDS = 120;
export const DEFAULT_STARKNET_SEPOLIA_ENDPOINTS = [
  { name: "cartridge", url: "https://api.cartridge.gg/x/starknet/sepolia" },
  { name: "publicnode", url: "https://starknet-sepolia-rpc.publicnode.com" },
] as const;

export type StarknetEndpoint = { name: string; url: string };
export type StarknetPoolTarget = {
  network: "SN_SEPOLIA" | "SN_MAIN";
  chainId: string;
  pool: string;
  expectedAbiSha256: string;
  expectedPoolVersion: string;
};

export type StarknetHeadSnapshot = {
  endpoint: string;
  chainId: string;
  specVersion: string;
  blockNumber: number;
  blockHash: string;
  parentHash: string;
  status: string;
  timestamp: number;
  starknetVersion: string;
  transactionCount: number;
  syncing: false;
};

export type StarknetPoolSnapshot = {
  endpoint: string;
  blockNumber: number;
  blockHash: string;
  classHash: string;
  recomputedClassHash: string;
  classVersion: string;
  abiSha256: string;
  poolVersion: string;
  feeAmount: string;
  proofValidityBlocks: string;
  upgradeDelaySeconds: string;
  requiredAbiSurface: string[];
};

export type StarknetHealthReport = {
  network: StarknetPoolTarget["network"];
  checkedAt: string;
  intervalMs: number;
  firstHeads: StarknetHeadSnapshot[];
  firstCommonBlock: number;
  firstPoolState: StarknetPoolSnapshot[];
  secondHeads: StarknetHeadSnapshot[];
  secondCommonBlock: number;
  secondPoolState: StarknetPoolSnapshot[];
  advancedBy: Record<string, number>;
};

type ProviderBinding = { endpoint: StarknetEndpoint; provider: RpcProvider };
type AbiItem = {
  type?: unknown;
  name?: unknown;
  members?: unknown;
  variants?: unknown;
  items?: unknown;
};
type AbiField = { name?: unknown; type?: unknown };

export async function checkStarknetSepoliaHealth(options: {
  endpoints?: readonly StarknetEndpoint[];
  intervalMs?: number;
  maxHeadAgeSeconds?: number;
  nowSeconds?: () => number;
} = {}): Promise<StarknetHealthReport> {
  return checkStarknetPoolHealth({
    target: {
      network: "SN_SEPOLIA",
      chainId: STARKNET_SEPOLIA_CHAIN_ID,
      pool: STRK20_SEPOLIA_POOL,
      expectedAbiSha256: STRK20_EXPECTED_LIVE_ABI_SHA256,
      expectedPoolVersion: "2.0",
    },
    endpoints: options.endpoints ?? DEFAULT_STARKNET_SEPOLIA_ENDPOINTS,
    intervalMs: options.intervalMs,
    maxHeadAgeSeconds: options.maxHeadAgeSeconds,
    nowSeconds: options.nowSeconds,
  });
}

export async function checkStarknetPoolHealth(options: {
  target: StarknetPoolTarget;
  endpoints: readonly StarknetEndpoint[];
  intervalMs?: number;
  maxHeadAgeSeconds?: number;
  nowSeconds?: () => number;
}): Promise<StarknetHealthReport> {
  const { target, endpoints } = options;
  if (endpoints.length < 2) throw new Error("STARKNET_HEALTH_REQUIRES_TWO_ENDPOINTS");
  assertDistinctEndpoints(endpoints);
  const intervalMs = options.intervalMs ?? DEFAULT_STARKNET_HEALTH_INTERVAL_MS;
  if (!Number.isInteger(intervalMs) || intervalMs < 1_000 || intervalMs > 30_000) {
    throw new Error("INVALID_STARKNET_HEALTH_INTERVAL");
  }
  const maxHeadAgeSeconds =
    options.maxHeadAgeSeconds ?? DEFAULT_STARKNET_MAX_HEAD_AGE_SECONDS;
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1_000));
  const bindings = endpoints.map((endpoint) => ({
    endpoint,
    provider: new RpcProvider({ nodeUrl: endpoint.url }),
  }));

  const firstHeads = await Promise.all(bindings.map(readHead));
  assertHealthyHeads(firstHeads, nowSeconds(), maxHeadAgeSeconds, target.chainId);
  const firstCommonBlock = Math.min(...firstHeads.map((head) => head.blockNumber));
  const firstPoolState = await Promise.all(
    bindings.map((binding) => readPoolState(binding, firstCommonBlock, target)),
  );
  assertPoolAgreement(firstPoolState, target);

  await new Promise((resolve) => setTimeout(resolve, intervalMs));

  const secondHeads = await Promise.all(bindings.map(readHead));
  assertHealthyHeads(secondHeads, nowSeconds(), maxHeadAgeSeconds, target.chainId);
  const secondCommonBlock = Math.min(...secondHeads.map((head) => head.blockNumber));
  const secondPoolState = await Promise.all(
    bindings.map((binding) => readPoolState(binding, secondCommonBlock, target)),
  );
  assertPoolAgreement(secondPoolState, target);

  const advancedBy = Object.fromEntries(
    firstHeads.map((first) => {
      const second = secondHeads.find((candidate) => candidate.endpoint === first.endpoint);
      if (!second) throw new Error("STARKNET_ENDPOINT_SET_CHANGED");
      const delta = second.blockNumber - first.blockNumber;
      if (delta <= 0) throw new Error(`STARKNET_HEAD_NOT_ADVANCING:${first.endpoint}`);
      return [first.endpoint, delta];
    }),
  );

  return {
    network: target.network,
    checkedAt: new Date(nowSeconds() * 1_000).toISOString(),
    intervalMs,
    firstHeads,
    firstCommonBlock,
    firstPoolState,
    secondHeads,
    secondCommonBlock,
    secondPoolState,
    advancedBy,
  };
}

export function assertDistinctEndpoints(endpoints: readonly StarknetEndpoint[]): void {
  const names = new Set<string>();
  const urls = new Set<string>();
  for (const endpoint of endpoints) {
    const name = endpoint.name.trim().toLowerCase();
    const url = endpoint.url.trim().replace(/\/+$/, "").toLowerCase();
    if (!name || !url) throw new Error("STARKNET_ENDPOINT_INVALID");
    if (names.has(name)) throw new Error(`STARKNET_ENDPOINT_NAME_DUPLICATE:${endpoint.name}`);
    if (urls.has(url)) throw new Error(`STARKNET_ENDPOINT_URL_DUPLICATE:${endpoint.name}`);
    names.add(name);
    urls.add(url);
  }
}

export function assertHealthyHeads(
  heads: readonly StarknetHeadSnapshot[],
  nowSeconds: number,
  maxHeadAgeSeconds: number,
  expectedChainId: string = STARKNET_SEPOLIA_CHAIN_ID,
): void {
  if (heads.length < 2) throw new Error("STARKNET_HEALTH_REQUIRES_TWO_ENDPOINTS");
  for (const head of heads) {
    if (!sameFelt(head.chainId, expectedChainId)) {
      throw new Error(`STARKNET_WRONG_CHAIN:${head.endpoint}`);
    }
    if (head.syncing !== false) throw new Error(`STARKNET_PROVIDER_SYNCING:${head.endpoint}`);
    if (head.status !== "ACCEPTED_ON_L1" && head.status !== "ACCEPTED_ON_L2") {
      throw new Error(`STARKNET_HEAD_NOT_ACCEPTED:${head.endpoint}`);
    }
    const age = nowSeconds - head.timestamp;
    if (age < -30 || age > maxHeadAgeSeconds) {
      throw new Error(`STARKNET_STALE_HEAD:${head.endpoint}`);
    }
  }
}

export function assertPoolAgreement(
  states: readonly StarknetPoolSnapshot[],
  target: Pick<StarknetPoolTarget, "expectedAbiSha256" | "expectedPoolVersion"> = {
    expectedAbiSha256: STRK20_EXPECTED_LIVE_ABI_SHA256,
    expectedPoolVersion: "2.0",
  },
): void {
  if (states.length < 2) throw new Error("STARKNET_HEALTH_REQUIRES_TWO_ENDPOINTS");
  const expected = states[0];
  if (!expected) throw new Error("STARKNET_POOL_STATE_MISSING");
  for (const state of states) {
    if (state.blockNumber !== expected.blockNumber || !sameFelt(state.blockHash, expected.blockHash)) {
      throw new Error(`STARKNET_BLOCK_DISAGREEMENT:${state.endpoint}`);
    }
    if (!sameFelt(state.classHash, expected.classHash)) {
      throw new Error(`STARKNET_POOL_CLASS_DISAGREEMENT:${state.endpoint}`);
    }
    if (!sameFelt(state.recomputedClassHash, state.classHash)) {
      throw new Error(`STARKNET_POOL_CLASS_HASH_INVALID:${state.endpoint}`);
    }
    if (state.abiSha256 !== target.expectedAbiSha256) {
      throw new Error(`STARKNET_POOL_ABI_MISMATCH:${state.endpoint}`);
    }
    if (state.poolVersion !== target.expectedPoolVersion) {
      throw new Error(`STARKNET_POOL_VERSION_MISMATCH:${state.endpoint}`);
    }
    if (state.requiredAbiSurface.length !== 7) {
      throw new Error(`STARKNET_POOL_ABI_SURFACE_MISSING:${state.endpoint}`);
    }
  }
}

export function canonicalAbiSha256(abi: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(abi))).digest("hex");
}

export function verifyPoolAbiSurface(abi: unknown): string[] {
  if (!Array.isArray(abi)) throw new Error("STARKNET_POOL_ABI_NOT_ARRAY");
  const items = abi as AbiItem[];
  const functions = items.flatMap((item) => {
    if (item.type === "function") return [item];
    if (item.type === "interface" && Array.isArray(item.items)) {
      return (item.items as AbiItem[]).filter((nested) => nested.type === "function");
    }
    return [];
  });
  const requiredFunctions = [
    "compile_actions",
    "apply_actions",
    "get_version",
    "get_fee_amount",
    "get_proof_validity_blocks",
  ];
  for (const name of requiredFunctions) {
    if (!functions.some((entry) => entry.name === name)) {
      throw new Error(`STARKNET_POOL_ABI_FUNCTION_MISSING:${name}`);
    }
  }

  const invoke = findNamedItem(items, "struct", "privacy::actions::InvokeExternalInput");
  assertFields(
    invoke.members,
    [
      ["contract_address", "core::starknet::contract_address::ContractAddress"],
      ["calldata", "core::array::Span::<core::felt252>"],
    ],
    "STARKNET_INVOKE_EXTERNAL_SHAPE_MISMATCH",
  );

  const clientAction = findNamedItem(items, "enum", "privacy::actions::ClientAction");
  const variants = fields(clientAction.variants);
  if (!variants.some((variant) => variant.name === "InvokeExternal")) {
    throw new Error("STARKNET_INVOKE_EXTERNAL_VARIANT_MISSING");
  }
  if (!variants.some((variant) => variant.name === "ComputeAndInvoke")) {
    throw new Error("STARKNET_COMPUTE_AND_INVOKE_VARIANT_MISSING");
  }

  const invokedEvent = findNamedItem(
    items,
    "event",
    "privacy::events::ExternalContractInvoked",
  );
  assertFields(
    invokedEvent.members,
    [
      ["contract_address", "core::starknet::contract_address::ContractAddress"],
      ["selector", "core::felt252"],
    ],
    "STARKNET_EXTERNAL_INVOKE_EVENT_SHAPE_MISMATCH",
  );

  return [...requiredFunctions, "InvokeExternalInput", "ExternalContractInvoked"];
}

async function readHead(binding: ProviderBinding): Promise<StarknetHeadSnapshot> {
  const { endpoint, provider } = binding;
  const [chainId, specVersion, block, syncing] = await Promise.all([
    provider.getChainId(),
    provider.getSpecVersion(),
    provider.getBlockWithTxHashes("latest"),
    provider.getSyncingStats(),
  ]);
  if (syncing !== false) throw new Error(`STARKNET_PROVIDER_SYNCING:${endpoint.name}`);
  if (block.block_number === undefined || block.block_hash === undefined || block.parent_hash === undefined) {
    throw new Error(`STARKNET_PRECONFIRMED_HEAD:${endpoint.name}`);
  }
  return {
    endpoint: endpoint.name,
    chainId,
    specVersion,
    blockNumber: block.block_number,
    blockHash: block.block_hash,
    parentHash: block.parent_hash,
    status: block.status,
    timestamp: block.timestamp,
    starknetVersion: block.starknet_version,
    transactionCount: block.transactions.length,
    syncing,
  };
}

async function readPoolState(
  binding: ProviderBinding,
  blockNumber: number,
  target: StarknetPoolTarget,
): Promise<StarknetPoolSnapshot> {
  const { endpoint, provider } = binding;
  const [block, classHash, contractClass, version, fee, validity, upgradeDelay] =
    await Promise.all([
      provider.getBlockWithTxHashes(blockNumber),
      provider.getClassHashAt(target.pool, blockNumber),
      provider.getClassAt(target.pool, blockNumber),
      provider.callContract(
        { contractAddress: target.pool, entrypoint: "get_version", calldata: [] },
        blockNumber,
      ),
      provider.callContract(
        { contractAddress: target.pool, entrypoint: "get_fee_amount", calldata: [] },
        blockNumber,
      ),
      provider.callContract(
        {
          contractAddress: target.pool,
          entrypoint: "get_proof_validity_blocks",
          calldata: [],
        },
        blockNumber,
      ),
      provider.callContract(
        { contractAddress: target.pool, entrypoint: "get_upgrade_delay", calldata: [] },
        blockNumber,
      ),
    ]);
  if (block.block_hash === undefined) throw new Error(`STARKNET_BLOCK_HASH_MISSING:${endpoint.name}`);
  if (!("sierra_program" in contractClass)) {
    throw new Error(`STARKNET_POOL_CLASS_NOT_SIERRA:${endpoint.name}`);
  }
  const abi = contractClass.abi;
  return {
    endpoint: endpoint.name,
    blockNumber,
    blockHash: block.block_hash,
    classHash,
    recomputedClassHash: hash.computeContractClassHash(contractClass),
    classVersion: contractClass.contract_class_version,
    abiSha256: canonicalAbiSha256(abi),
    poolVersion: shortString.decodeShortString(requireSingleFelt(version, "POOL_VERSION")),
    feeAmount: BigInt(requireSingleFelt(fee, "POOL_FEE")).toString(),
    proofValidityBlocks: BigInt(requireSingleFelt(validity, "PROOF_VALIDITY")).toString(),
    upgradeDelaySeconds: BigInt(requireSingleFelt(upgradeDelay, "UPGRADE_DELAY")).toString(),
    requiredAbiSurface: verifyPoolAbiSurface(abi),
  };
}

function requireSingleFelt(result: readonly string[], label: string): string {
  if (result.length !== 1 || result[0] === undefined) {
    throw new Error(`STARKNET_${label}_RESULT_INVALID`);
  }
  return result[0];
}

function findNamedItem(items: AbiItem[], type: string, name: string): AbiItem {
  const item = items.find((candidate) => candidate.type === type && candidate.name === name);
  if (!item) throw new Error(`STARKNET_POOL_ABI_ITEM_MISSING:${name}`);
  return item;
}

function assertFields(
  value: unknown,
  expected: readonly (readonly [string, string])[],
  error: string,
): void {
  const actual = fields(value);
  if (
    actual.length !== expected.length ||
    expected.some(
      ([name, type], index) => actual[index]?.name !== name || actual[index]?.type !== type,
    )
  ) {
    throw new Error(error);
  }
}

function fields(value: unknown): { name: string; type: string }[] {
  if (!Array.isArray(value)) return [];
  return (value as AbiField[])
    .filter((entry) => typeof entry.name === "string" && typeof entry.type === "string")
    .map((entry) => ({ name: entry.name as string, type: entry.type as string }));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function sameFelt(left: string, right: string): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}
