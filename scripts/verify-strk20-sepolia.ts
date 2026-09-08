import { RpcProvider } from "starknet";
import {
  DEFAULT_STARKNET_HEALTH_INTERVAL_MS,
  DEFAULT_STARKNET_SEPOLIA_ENDPOINTS,
  checkStarknetSepoliaHealth,
  type StarknetEndpoint,
} from "../src/lib/starknet-health";
import {
  STRK20_EXPECTED_LIVE_ABI_SHA256,
  STRK20_LIVE_CLASS_ACTIVATION_BLOCK,
  STRK20_LIVE_CLASS_ACTIVATION_TRANSACTION,
  STRK20_LIVE_CLASS_DECLARATION_BLOCK,
  STRK20_LIVE_CLASS_DECLARATION_TRANSACTION,
  STRK20_LIVE_COMPILED_CLASS_HASH,
  STRK20_OBSERVED_POOL_CLASS_HASH,
  STRK20_REPRODUCED_V2_POOL_CLASS_HASH,
  STRK20_REVIEWED_POOL_CLASS_HASH,
  STRK20_SEPOLIA_POOL,
  STRK20_SOURCE_CANDIDATE_COMMIT,
  STRK20_SOURCE_CANDIDATE_DEV_CLASS_HASH,
  STRK20_SOURCE_CANDIDATE_RELEASE_CLASS_HASH,
  STRK20_SOURCE_CANDIDATE_RELEASE_SIERRA_LENGTH,
  STRK20_LIVE_SIERRA_LENGTH,
  STRK20_WALLET_SDK_COMMIT,
  STRK20_WALLET_SDK_PACKAGE,
  STRK20_WALLET_SDK_RELEASE,
  STRK20_WALLET_SDK_VERSION,
} from "../src/lib/strk20-sepolia";

function sameFelt(left: string, right: string): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}

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

async function verifyHistory(provider: RpcProvider) {
  const [declarationState, declarationBlock, activationState, activationBlock] =
    await Promise.all([
      provider.getBlockStateUpdate(STRK20_LIVE_CLASS_DECLARATION_BLOCK),
      provider.getBlockWithReceipts(STRK20_LIVE_CLASS_DECLARATION_BLOCK),
      provider.getBlockStateUpdate(STRK20_LIVE_CLASS_ACTIVATION_BLOCK),
      provider.getBlockWithReceipts(STRK20_LIVE_CLASS_ACTIVATION_BLOCK),
    ]);

  const declaredClass = declarationState.state_diff.declared_classes.find((entry) =>
    sameFelt(entry.class_hash, STRK20_OBSERVED_POOL_CLASS_HASH),
  );
  if (
    !declaredClass ||
    !sameFelt(declaredClass.compiled_class_hash, STRK20_LIVE_COMPILED_CLASS_HASH)
  ) {
    throw new Error("STRK20_DECLARATION_STATE_MISMATCH");
  }
  const declarationReceipt = declarationBlock.transactions.find(({ receipt }) =>
    sameFelt(receipt.transaction_hash, STRK20_LIVE_CLASS_DECLARATION_TRANSACTION),
  );
  if (
    !declarationReceipt ||
    declarationReceipt.transaction.type !== "DECLARE" ||
    !sameFelt(declarationReceipt.transaction.class_hash, STRK20_OBSERVED_POOL_CLASS_HASH) ||
    !("compiled_class_hash" in declarationReceipt.transaction) ||
    !sameFelt(
      declarationReceipt.transaction.compiled_class_hash,
      STRK20_LIVE_COMPILED_CLASS_HASH,
    ) ||
    declarationReceipt.receipt.execution_status !== "SUCCEEDED" ||
    declarationReceipt.receipt.finality_status !== "ACCEPTED_ON_L1"
  ) {
    throw new Error("STRK20_DECLARATION_RECEIPT_MISMATCH");
  }

  const replacement = activationState.state_diff.replaced_classes.find(
    (entry) =>
      sameFelt(entry.contract_address, STRK20_SEPOLIA_POOL) &&
      sameFelt(entry.class_hash, STRK20_OBSERVED_POOL_CLASS_HASH),
  );
  if (!replacement) throw new Error("STRK20_ACTIVATION_STATE_MISMATCH");
  const activationReceipt = activationBlock.transactions.find(({ receipt }) =>
    sameFelt(receipt.transaction_hash, STRK20_LIVE_CLASS_ACTIVATION_TRANSACTION),
  );
  if (
    !activationReceipt ||
    activationReceipt.transaction.type !== "INVOKE" ||
    !activationReceipt.transaction.calldata.some((value) => sameFelt(value, STRK20_SEPOLIA_POOL)) ||
    !activationReceipt.transaction.calldata.some((value) =>
      sameFelt(value, STRK20_OBSERVED_POOL_CLASS_HASH),
    ) ||
    activationReceipt.receipt.execution_status !== "SUCCEEDED" ||
    activationReceipt.receipt.finality_status !== "ACCEPTED_ON_L1"
  ) {
    throw new Error("STRK20_ACTIVATION_RECEIPT_MISMATCH");
  }

  return {
    declarationBlock: STRK20_LIVE_CLASS_DECLARATION_BLOCK,
    declarationTransaction: STRK20_LIVE_CLASS_DECLARATION_TRANSACTION,
    compiledClassHash: declaredClass.compiled_class_hash,
    activationBlock: STRK20_LIVE_CLASS_ACTIVATION_BLOCK,
    activationTransaction: STRK20_LIVE_CLASS_ACTIVATION_TRANSACTION,
  };
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
  const health = await checkStarknetSepoliaHealth({ endpoints, intervalMs: interval() });
  const latest = health.secondPoolState[0];
  if (!latest) throw new Error("STRK20_POOL_STATE_MISSING");
  const history = await verifyHistory(new RpcProvider({ nodeUrl: endpoints[0]!.url }));
  const classHash = latest.classHash;
  const sourceCandidateAbiMatch = latest.abiSha256 === STRK20_EXPECTED_LIVE_ABI_SHA256;
  const sourceCandidateClassReproduced =
    sameFelt(classHash, STRK20_SOURCE_CANDIDATE_RELEASE_CLASS_HASH) ||
    sameFelt(classHash, STRK20_SOURCE_CANDIDATE_DEV_CLASS_HASH);

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
        pool: STRK20_SEPOLIA_POOL,
        classHash,
        poolVersion: latest.poolVersion,
        proofValidityBlocks: latest.proofValidityBlocks,
        upgradeDelaySeconds: latest.upgradeDelaySeconds,
        abiSha256: latest.abiSha256,
        reviewedRc0: sameFelt(classHash, STRK20_REVIEWED_POOL_CLASS_HASH),
        reproducedV2: sameFelt(classHash, STRK20_REPRODUCED_V2_POOL_CLASS_HASH),
        knownObserved: sameFelt(classHash, STRK20_OBSERVED_POOL_CLASS_HASH),
        sourceCandidate: {
          repository: "starkware-libs/starknet-privacy",
          commit: STRK20_SOURCE_CANDIDATE_COMMIT,
          abiMatch: sourceCandidateAbiMatch,
          abiPackage: {
            name: STRK20_WALLET_SDK_PACKAGE,
            version: STRK20_WALLET_SDK_VERSION,
            release: STRK20_WALLET_SDK_RELEASE,
            commit: STRK20_WALLET_SDK_COMMIT,
          },
          releaseClassHash: STRK20_SOURCE_CANDIDATE_RELEASE_CLASS_HASH,
          devClassHash: STRK20_SOURCE_CANDIDATE_DEV_CLASS_HASH,
          releaseSierraLength: STRK20_SOURCE_CANDIDATE_RELEASE_SIERRA_LENGTH,
          liveSierraLength: STRK20_LIVE_SIERRA_LENGTH,
          classReproduced: sourceCandidateClassReproduced,
          status: sourceCandidateClassReproduced
            ? "SOURCE_REPRODUCED"
            : "ABI_PACKAGE_MAPPED_SOURCE_UNREPRODUCED",
        },
        history,
      },
      null,
      2,
    ),
  );

  if (!sourceCandidateAbiMatch || !sourceCandidateClassReproduced) {
    throw new Error("STRK20_POOL_SOURCE_NOT_REPRODUCED");
  }
  if (!sameFelt(classHash, STRK20_REVIEWED_POOL_CLASS_HASH)) {
    throw new Error("STRK20_POOL_CLASS_UNREVIEWED");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "STRK20_POOL_CHECK_FAILED");
  process.exitCode = 2;
});
