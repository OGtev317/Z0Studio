import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RpcProvider } from "starknet";
import {
  checkStarknetPoolHealth,
  type StarknetEndpoint,
} from "../src/lib/starknet-health";
import {
  reviewMainnetDeploymentInputs,
  type MainnetDeploymentInputs,
  type MainnetReleaseManifestSummary,
} from "../src/lib/mainnet-deployment-readiness";
import {
  DEFAULT_STARKNET_MAINNET_ENDPOINTS,
  STARKNET_MAINNET_CHAIN_ID,
  STRK20_MAINNET_EXPECTED_ABI_SHA256,
  STRK20_MAINNET_EXPECTED_POOL_VERSION,
  STRK20_MAINNET_POOL,
  STRK20_MAINNET_V2_CLASS_HASH,
} from "../src/lib/strk20-mainnet";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(repositoryRoot, "release/gigstark-mainnet-review.json");
const inputPath = resolve(
  repositoryRoot,
  process.argv[2] ?? "release/gigstark-mainnet-deployment-inputs.example.json",
);

function endpoint(name: string, environmentName: string, fallback: string): StarknetEndpoint {
  return { name, url: process.env[environmentName] ?? fallback };
}

function sameFelt(left: string, right: string): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}

async function main() {
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as MainnetReleaseManifestSummary;
  manifest.sha256 = createHash("sha256").update(manifestBytes).digest("hex");
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as MainnetDeploymentInputs;
  const blockers = reviewMainnetDeploymentInputs(input, manifest);
  if (blockers.length > 0) {
    console.log(
      JSON.stringify(
        {
          status: "BLOCKED_NO_BROADCAST",
          inputPath,
          manifestPath,
          blockers,
          broadcastAuthorized: false,
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }

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
  });
  const poolState = health.secondPoolState[0];
  if (!poolState || !sameFelt(poolState.classHash, STRK20_MAINNET_V2_CLASS_HASH)) {
    throw new Error("STRK20_MAINNET_POOL_CLASS_UNREVIEWED");
  }

  const providers = endpoints.map((item) => new RpcProvider({ nodeUrl: item.url }));
  const [adminClasses, deployerClasses] = await Promise.all([
    Promise.all(
      providers.map((provider) =>
        provider.getClassHashAt(input.governance.adminAddress!, "latest"),
      ),
    ),
    Promise.all(
      providers.map((provider) =>
        provider.getClassHashAt(input.deployer.accountAddress!, "latest"),
      ),
    ),
  ]);
  if (adminClasses.some((classHash) => !sameFelt(classHash, input.governance.adminClassHash!))) {
    throw new Error("GOVERNANCE_ADMIN_CLASS_MISMATCH");
  }
  if (deployerClasses.some((classHash) => !sameFelt(classHash, input.deployer.accountClassHash!))) {
    throw new Error("DEPLOYER_ACCOUNT_CLASS_MISMATCH");
  }

  console.log(
    JSON.stringify(
      {
        status: "NO_BROADCAST_DEPLOYMENT_REVIEW_READY",
        checkedAt: health.checkedAt,
        manifestSha256: manifest.sha256,
        mainnetHeads: health.secondHeads.map((head) => ({
          endpoint: head.endpoint,
          blockNumber: head.blockNumber,
          status: head.status,
        })),
        pool: STRK20_MAINNET_POOL,
        poolClassHash: poolState.classHash,
        governanceAdmin: input.governance.adminAddress,
        deployer: input.deployer.accountAddress,
        broadcastAuthorized: false,
        remainingManualGate:
          "Review the exact account, chain, current nonce, fees, class hashes, deployment order, constructor calldata, and each wallet request before any signature.",
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "MAINNET_DEPLOYMENT_REVIEW_FAILED");
  process.exitCode = 2;
});
