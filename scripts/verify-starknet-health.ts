import {
  DEFAULT_STARKNET_HEALTH_INTERVAL_MS,
  DEFAULT_STARKNET_SEPOLIA_ENDPOINTS,
  checkStarknetSepoliaHealth,
  type StarknetEndpoint,
} from "../src/lib/starknet-health";

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

async function main() {
  const endpoints = [
    endpoint("primary", "GIGSTARK_SEPOLIA_RPC", DEFAULT_STARKNET_SEPOLIA_ENDPOINTS[0].url),
    endpoint(
      "secondary",
      "GIGSTARK_SEPOLIA_RPC_SECONDARY",
      DEFAULT_STARKNET_SEPOLIA_ENDPOINTS[1].url,
    ),
  ];
  const report = await checkStarknetSepoliaHealth({ endpoints, intervalMs: interval() });
  console.log(JSON.stringify({ health: "ok", ...report }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "STARKNET_HEALTH_CHECK_FAILED");
  process.exitCode = 2;
});
