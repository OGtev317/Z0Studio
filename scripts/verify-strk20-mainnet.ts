import {
  DEFAULT_STARKNET_HEALTH_INTERVAL_MS,
  checkStarknetPoolHealth,
  type StarknetEndpoint,
} from "../src/lib/starknet-health";
import {
  DEFAULT_STARKNET_MAINNET_ENDPOINTS,
  STARKNET_MAINNET_CHAIN_ID,
  STRK20_MAINNET_EXPECTED_ABI_SHA256,
  STRK20_MAINNET_EXPECTED_POOL_VERSION,
  STRK20_MAINNET_POOL,
  STRK20_MAINNET_V2_CLASS_HASH,
  STRK20_MAINNET_V2_SOURCE_TAG,
} from "../src/lib/strk20-mainnet";

function endpoint(name: string, environmentName: string, fallback: string): StarknetEndpoint {
  return { name, url: process.env[environmentName] ?? fallback };
}

function interval(): number {
  const value = process.env.GIGSTARK_HEALTH_INTERVAL_MS;
  if (value === undefined) return DEFAULT_STARKNET_HEALTH_INTERVAL_MS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("INVALID_STARKNET_HEALTH_INTERVAL");
  return parsed;
}

function sameFelt(left: string, right: string): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}

async function main() {
  const endpoints = [
    endpoint("primary", "GIGSTARK_MAINNET_RPC", DEFAULT_STARKNET_MAINNET_ENDPOINTS[0].url),
    endpoint(
      "secondary",
      "GIGSTARK_MAINNET_RPC_SECONDARY",
      DEFAULT_STARKNET_MAINNET_ENDPOINTS[1].url,
    ),
  ];
  const health = await checkStarknetPoolHealth({
    target: {
      network: "SN_MAIN",
      chainId: STARKNET_MAINNET_CHAIN_ID,
      pool: STRK20_MAINNET_POOL,
      expectedAbiSha256: STRK20_MAINNET_EXPECTED_ABI_SHA256,
      expectedPoolVersion: STRK20_MAINNET_EXPECTED_POOL_VERSION,
    },
    endpoints,
    intervalMs: interval(),
  });
  const latest = health.secondPoolState[0];
  if (!latest) throw new Error("STRK20_MAINNET_POOL_STATE_MISSING");
  if (!sameFelt(latest.classHash, STRK20_MAINNET_V2_CLASS_HASH)) {
    throw new Error("STRK20_MAINNET_POOL_CLASS_UNREVIEWED");
  }
  console.log(
    JSON.stringify(
      {
        health: "ok",
        network: health.network,
        checkedAt: health.checkedAt,
        heads: health.secondHeads.map((head) => ({
          endpoint: head.endpoint,
          blockNumber: head.blockNumber,
          blockHash: head.blockHash,
          status: head.status,
          syncing: head.syncing,
          specVersion: head.specVersion,
        })),
        advancedBy: health.advancedBy,
        pool: STRK20_MAINNET_POOL,
        classHash: latest.classHash,
        poolVersion: latest.poolVersion,
        abiSha256: latest.abiSha256,
        source: {
          tag: STRK20_MAINNET_V2_SOURCE_TAG,
          reproducedClassHash: STRK20_MAINNET_V2_CLASS_HASH,
          liveClassMatchesReproducedSource: true,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "STRK20_MAINNET_POOL_CHECK_FAILED");
  process.exitCode = 2;
});
