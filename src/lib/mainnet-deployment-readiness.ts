import {
  STRK20_MAINNET_POOL,
  STRK20_MAINNET_V2_CLASS_HASH,
} from "./strk20-mainnet";

export const MAINNET_DEPLOYMENT_INPUT_FORMAT =
  "gigstark-mainnet-deployment-inputs-v1" as const;

export type MainnetDeploymentInputs = {
  format: typeof MAINNET_DEPLOYMENT_INPUT_FORMAT;
  network: {
    chainId: "SN_MAIN";
    privacyPool: string;
    privacyPoolClassHash: string;
  };
  release: {
    manifestSha256: string | null;
    independentReview: {
      url: string | null;
      reviewer: string | null;
      reviewedCommit: string | null;
      decision: "approved" | null;
      unresolvedCritical: number | null;
      unresolvedHigh: number | null;
    };
  };
  governance: {
    adminAddress: string | null;
    adminClassHash: string | null;
    controlType: "multisig" | "timelocked_multisig" | null;
    threshold: number | null;
    signerSetReviewed: boolean;
    emergencyPolicyReviewed: boolean;
  };
  productionProof: {
    verifierClassHash: string | null;
    verifierCompiledClassHash: string | null;
    circuitSha256: string | null;
    verificationKeySha256: string | null;
    ceremonyReviewUrl: string | null;
  };
  attestor: {
    publicKey: string | null;
    rotationPolicyReviewed: boolean;
    compromisePolicyReviewed: boolean;
  };
  deployer: {
    accountAddress: string | null;
    accountClassHash: string | null;
    maximumTotalFeeFri: string | null;
  };
};

export type MainnetReleaseManifestSummary = {
  sha256: string;
  status?: unknown;
  network?: { chainId?: unknown };
  source?: { commit?: unknown };
  externalBindings?: {
    privacyPool?: {
      address?: unknown;
      classHash?: unknown;
      reviewedClassAllowlisted?: unknown;
    };
  };
  releaseGates?: {
    independentCairoReview?: unknown;
    constructorArguments?: unknown;
    declaration?: unknown;
    deployment?: unknown;
  };
};

const FORBIDDEN_FIELD_FRAGMENTS = [
  "privatekey",
  "seedphrase",
  "mnemonic",
  "viewingkey",
  "spendingkey",
  "witness",
  "apikey",
  "rpctoken",
] as const;
const PRIVATE_MATERIAL = /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|\b(?:seed phrase|mnemonic)\b/i;

export function reviewMainnetDeploymentInputs(
  input: MainnetDeploymentInputs,
  manifest: MainnetReleaseManifestSummary,
): string[] {
  assertNoPrivateMaterial(input);
  const blockers: string[] = [];

  if (input.format !== MAINNET_DEPLOYMENT_INPUT_FORMAT) blockers.push("INPUT_FORMAT_INVALID");
  if (input.network.chainId !== "SN_MAIN") blockers.push("NETWORK_CHAIN_INVALID");
  if (!sameFelt(input.network.privacyPool, STRK20_MAINNET_POOL)) {
    blockers.push("PRIVACY_POOL_MISMATCH");
  }
  if (!sameFelt(input.network.privacyPoolClassHash, STRK20_MAINNET_V2_CLASS_HASH)) {
    blockers.push("PRIVACY_POOL_CLASS_MISMATCH");
  }

  if (!isSha256(input.release.manifestSha256)) blockers.push("MANIFEST_SHA256_UNSET");
  else if (input.release.manifestSha256 !== manifest.sha256) {
    blockers.push("MANIFEST_SHA256_MISMATCH");
  }
  if (
    manifest.status !== "NO_BROADCAST_REVIEW_CANDIDATE" ||
    manifest.network?.chainId !== "SN_MAIN" ||
    !isGitCommit(manifest.source?.commit) ||
    !sameFelt(manifest.externalBindings?.privacyPool?.address, STRK20_MAINNET_POOL) ||
    !sameFelt(
      manifest.externalBindings?.privacyPool?.classHash,
      STRK20_MAINNET_V2_CLASS_HASH,
    ) ||
    manifest.externalBindings?.privacyPool?.reviewedClassAllowlisted !== true
  ) {
    blockers.push("MAINNET_RELEASE_MANIFEST_INVALID");
  }
  if (
    manifest.releaseGates?.independentCairoReview !== "required" ||
    manifest.releaseGates?.constructorArguments !== "unset_and_unreviewed" ||
    manifest.releaseGates?.declaration !== "not_authorized" ||
    manifest.releaseGates?.deployment !== "not_authorized"
  ) {
    blockers.push("RELEASE_SAFETY_GATES_INVALID");
  }

  const independentReview = input.release.independentReview;
  if (
    !isHttpsUrl(independentReview.url) ||
    !nonEmpty(independentReview.reviewer) ||
    !isGitCommit(independentReview.reviewedCommit) ||
    independentReview.decision !== "approved" ||
    independentReview.unresolvedCritical !== 0 ||
    independentReview.unresolvedHigh !== 0
  ) {
    blockers.push("INDEPENDENT_REVIEW_PENDING");
  }
  if (
    isGitCommit(independentReview.reviewedCommit) &&
    isGitCommit(manifest.source?.commit) &&
    independentReview.reviewedCommit !== manifest.source.commit
  ) {
    blockers.push("INDEPENDENT_REVIEW_COMMIT_MISMATCH");
  }

  if (!isAddress(input.governance.adminAddress)) blockers.push("GOVERNANCE_ADMIN_UNSET");
  if (!isFelt(input.governance.adminClassHash)) {
    blockers.push("GOVERNANCE_ADMIN_CLASS_UNSET");
  }
  if (
    input.governance.controlType !== "multisig" &&
    input.governance.controlType !== "timelocked_multisig"
  ) {
    blockers.push("GOVERNANCE_CONTROL_UNREVIEWED");
  }
  if (!Number.isInteger(input.governance.threshold) || (input.governance.threshold ?? 0) < 2) {
    blockers.push("GOVERNANCE_THRESHOLD_UNREVIEWED");
  }
  if (!input.governance.signerSetReviewed) blockers.push("GOVERNANCE_SIGNERS_UNREVIEWED");
  if (!input.governance.emergencyPolicyReviewed) {
    blockers.push("GOVERNANCE_EMERGENCY_POLICY_UNREVIEWED");
  }

  if (!isFelt(input.productionProof.verifierClassHash)) {
    blockers.push("PRODUCTION_VERIFIER_CLASS_UNSET");
  }
  if (!isFelt(input.productionProof.verifierCompiledClassHash)) {
    blockers.push("PRODUCTION_VERIFIER_COMPILED_CLASS_UNSET");
  }
  if (!isSha256(input.productionProof.circuitSha256)) {
    blockers.push("PRODUCTION_CIRCUIT_UNREVIEWED");
  }
  if (!isSha256(input.productionProof.verificationKeySha256)) {
    blockers.push("PRODUCTION_VERIFICATION_KEY_UNREVIEWED");
  }
  if (!isHttpsUrl(input.productionProof.ceremonyReviewUrl)) {
    blockers.push("PRODUCTION_CEREMONY_REVIEW_PENDING");
  }

  if (!isFelt(input.attestor.publicKey)) blockers.push("ATTESTOR_PUBLIC_KEY_UNSET");
  if (!input.attestor.rotationPolicyReviewed) blockers.push("ATTESTOR_ROTATION_UNREVIEWED");
  if (!input.attestor.compromisePolicyReviewed) {
    blockers.push("ATTESTOR_COMPROMISE_POLICY_UNREVIEWED");
  }

  if (!isAddress(input.deployer.accountAddress)) blockers.push("DEPLOYER_ACCOUNT_UNSET");
  if (!isFelt(input.deployer.accountClassHash)) blockers.push("DEPLOYER_CLASS_UNSET");
  if (!isPositiveIntegerString(input.deployer.maximumTotalFeeFri)) {
    blockers.push("MAXIMUM_TOTAL_FEE_FRI_UNSET");
  }

  return [...new Set(blockers)];
}

export function assertNoPrivateMaterial(value: unknown, path = "input"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPrivateMaterial(item, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
      if (FORBIDDEN_FIELD_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment))) {
        throw new Error(`PRIVATE_MATERIAL_FIELD_FORBIDDEN:${path}.${key}`);
      }
      assertNoPrivateMaterial(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && PRIVATE_MATERIAL.test(value)) {
    throw new Error(`PRIVATE_MATERIAL_VALUE_FORBIDDEN:${path}`);
  }
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpsUrl(value: unknown): value is string {
  if (!nonEmpty(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isGitCommit(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}

function isPositiveIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value);
}

function isAddress(value: unknown): value is string {
  if (!isFelt(value)) return false;
  return BigInt(value) < 2n ** 251n;
}

function isFelt(value: unknown): value is string {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) return false;
  try {
    const parsed = BigInt(value);
    return parsed > 0n && parsed < 2n ** 252n;
  } catch {
    return false;
  }
}

function sameFelt(left: unknown, right: unknown): boolean {
  if (typeof left !== "string" || typeof right !== "string") return false;
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}
