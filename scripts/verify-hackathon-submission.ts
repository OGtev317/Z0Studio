import { readFile } from "node:fs/promises";
import { RpcProvider } from "starknet";
import {
  assertHackathonSubmissionReady,
  assertProviderReceiptAgreement,
  parseHackathonSubmission,
  qualifyingReceiptEvidence,
} from "../src/lib/hackathon-submission";
import {
  DEFAULT_STARKNET_MAINNET_ENDPOINTS,
  STARKNET_MAINNET_CHAIN_ID,
  STRK20_MAINNET_POOL,
  STRK20_MAINNET_V2_CLASS_HASH,
} from "../src/lib/strk20-mainnet";

async function main() {
  const repository = parseHackathonSubmission(JSON.parse(await readFile("strk20.json", "utf8")));
  const published = parseHackathonSubmission(JSON.parse(await readFile("public/strk20.json", "utf8")));
  if (JSON.stringify(repository) !== JSON.stringify(published)) throw new Error("SUBMISSION_MANIFESTS_DIFFER");
  assertHackathonSubmissionReady(repository);

  const endpoints = [
    { name: "primary", url: process.env.GIGSTARK_MAINNET_RPC ?? DEFAULT_STARKNET_MAINNET_ENDPOINTS[0].url },
    { name: "secondary", url: process.env.GIGSTARK_MAINNET_RPC_SECONDARY ?? DEFAULT_STARKNET_MAINNET_ENDPOINTS[1].url },
  ];
  if (normalizeUrl(endpoints[0].url) === normalizeUrl(endpoints[1].url)) throw new Error("SUBMISSION_RPCS_NOT_DISTINCT");
  const providers = endpoints.map((endpoint) => ({ ...endpoint, provider: new RpcProvider({ nodeUrl: endpoint.url }) }));

  await Promise.all(providers.map(async ({ name, provider }) => {
    const [chainId, classHash] = await Promise.all([
      provider.getChainId(),
      provider.getClassHashAt(STRK20_MAINNET_POOL, "latest"),
    ]);
    if (!sameFelt(chainId, STARKNET_MAINNET_CHAIN_ID)) throw new Error(`SUBMISSION_WRONG_CHAIN:${name}`);
    if (!sameFelt(classHash, STRK20_MAINNET_V2_CLASS_HASH)) throw new Error(`SUBMISSION_POOL_CLASS_CHANGED:${name}`);
  }));

  const receipts = [];
  for (const transactionHash of repository.transactions) {
    const evidence = await Promise.all(providers.map(async ({ name, provider }) => ({
      provider: name,
      evidence: qualifyingReceiptEvidence(
        transactionHash,
        await provider.getTransactionReceipt(transactionHash),
        STRK20_MAINNET_POOL,
      ),
    })));
    const first = evidence[0]?.evidence;
    const second = evidence[1]?.evidence;
    if (!first || !second) throw new Error("SUBMISSION_RECEIPT_EVIDENCE_MISSING");
    assertProviderReceiptAgreement(first, second);
    receipts.push({ transactionHash: first.transactionHash, blockNumber: first.blockNumber, poolEventCount: first.poolEventCount, providers: evidence.map((item) => item.provider) });
  }

  const cacheBust = `submission=${Date.now()}`;
  const [demoResponse, videoResponse, liveManifestResponse] = await Promise.all([
    fetch(`${repository.demo_url}${repository.demo_url.includes("?") ? "&" : "?"}${cacheBust}`, { redirect: "follow" }),
    fetch(repository.demo_video, { redirect: "follow" }),
    fetch(`${repository.demo_url.replace(/\/$/, "")}/strk20.json?${cacheBust}`, { redirect: "follow" }),
  ]);
  if (!demoResponse.ok) throw new Error(`SUBMISSION_DEMO_UNREACHABLE:${demoResponse.status}`);
  if (!videoResponse.ok) throw new Error(`SUBMISSION_VIDEO_UNREACHABLE:${videoResponse.status}`);
  if (!liveManifestResponse.ok) throw new Error(`SUBMISSION_LIVE_MANIFEST_UNREACHABLE:${liveManifestResponse.status}`);
  const liveManifest = parseHackathonSubmission(await liveManifestResponse.json());
  if (JSON.stringify(liveManifest) !== JSON.stringify(repository)) throw new Error("SUBMISSION_LIVE_MANIFEST_STALE");

  console.log(JSON.stringify({ status: "READY_TO_SCORE", demo: repository.demo_url, video: repository.demo_video, pool: STRK20_MAINNET_POOL, receipts }, null, 2));
}

function normalizeUrl(value: string): string { return value.trim().replace(/\/+$/, "").toLowerCase(); }
function sameFelt(left: string, right: string): boolean { try { return BigInt(left) === BigInt(right); } catch { return false; } }

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "SUBMISSION_VERIFICATION_FAILED");
  process.exitCode = 2;
});
