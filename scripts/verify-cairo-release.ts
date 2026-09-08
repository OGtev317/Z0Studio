import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hash, type CairoAssembly, type CompiledSierra } from "starknet";
import {
  canonicalJson,
  canonicalPackageGraph,
  type ScarbMetadata,
} from "../src/lib/cairo-release";
import {
  STRK20_MAINNET_EXPECTED_ABI_SHA256,
  STRK20_MAINNET_EXPECTED_POOL_VERSION,
  STRK20_MAINNET_POOL,
  STRK20_MAINNET_V2_CLASS_HASH,
  STRK20_MAINNET_V2_SOURCE_TAG,
} from "../src/lib/strk20-mainnet";
import { STRK20_SEPOLIA_POOL } from "../src/lib/strk20-sepolia";

const SCARB_VERSION = "2.17.0";
const SNFORGE_VERSION = "0.59.0";
const EXPECTED_TESTS = 37;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sepoliaOutputPath = join(repositoryRoot, "release", "gigstark-sepolia-review.json");
const mainnetOutputPath = join(repositoryRoot, "release", "gigstark-mainnet-review.json");
const releaseInputs = [
  "contracts/.tool-versions",
  "contracts/Scarb.toml",
  "contracts/Scarb.lock",
  "contracts/src",
] as const;

const platformTargets = {
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
  "linux-arm64": "aarch64-unknown-linux-gnu",
  "linux-x64": "x86_64-unknown-linux-gnu",
} as const;

const releaseDigests = {
  scarb: {
    "aarch64-apple-darwin": "eda88f32ec1c95a1159cd2cce4fb4a1c49dc66067b3f05fb3439254ab25e8294",
    "x86_64-apple-darwin": "6efa2ef11d9d870ef6fbe10ecaa586a770f18e69ce14933b6d400ff3bd11cf7c",
    "aarch64-unknown-linux-gnu": "f86978bcc2e1315fe29ac77c60e95f0d80522255d1b66dabafe29b0b7801076d",
    "x86_64-unknown-linux-gnu": "708667e54ef42ff03b59ff1fd9d141a88243047e4caf93a421b29372f541af5b",
  },
  foundry: {
    "aarch64-apple-darwin": "8d7d6d48eb5bb9ae30014c1b7a044c65136fcc1ade4e1c4d7549b03d17cb39f5",
    "x86_64-apple-darwin": "78ec063109ca0c8e7448afa1622dddbe70b16645299f960984cfd7a54021b87d",
    "aarch64-unknown-linux-gnu": "58f05a834d931668bb3dd9e244e9fe1071519c3f51c57538d762024c784dc37a",
    "x86_64-unknown-linux-gnu": "cd0377defe199e397686e0803334d30138067988d594a079c20f8a3c621abbd4",
  },
} as const;

type ContractIndex = {
  contracts: Array<{
    contract_name: string;
    module_path: string;
    artifacts: { sierra: string; casm: string };
  }>;
};

type AbiEntry = {
  type?: string;
  name?: string;
  inputs?: Array<{ name: string; type: string }>;
};

async function main() {
  assertCommittedContractTree();
  const sourceCommit = git(["log", "-1", "--format=%H", "--", ...releaseInputs]);
  const contractTree = git(["rev-parse", `${sourceCommit}:contracts`]);
  const workDirectory = mkdtempSync(join(tmpdir(), "gigstark-cairo-release-"));

  try {
    const target = platformTargets[
      `${process.platform}-${process.arch}` as keyof typeof platformTargets
    ];
    if (!target) throw new Error("UNSUPPORTED_RELEASE_TOOLCHAIN_PLATFORM");

    const scarb = await installTool(workDirectory, "scarb", SCARB_VERSION, target);
    const foundry = await installTool(
      workDirectory,
      "starknet-foundry",
      SNFORGE_VERSION,
      target,
    );
    const scarbBinary = join(scarb.directory, "bin", "scarb");
    const snforgeBinary = join(foundry.directory, "bin", "snforge");
    const scarbVersion = exec(scarbBinary, ["--version"]);
    const snforgeVersion = exec(snforgeBinary, ["--version"]);
    if (!scarbVersion.startsWith(`scarb ${SCARB_VERSION}`)) {
      throw new Error(`WRONG_SCARB_VERSION:${scarbVersion}`);
    }
    if (snforgeVersion !== `snforge ${SNFORGE_VERSION}`) {
      throw new Error(`WRONG_SNFORGE_VERSION:${snforgeVersion}`);
    }

    const sourceArchive = join(workDirectory, "contracts.tar");
    execFileSync(
      "git",
      ["archive", "--format=tar", "--output", sourceArchive, sourceCommit, ...releaseInputs],
      { cwd: repositoryRoot, stdio: "pipe" },
    );
    execFileSync("tar", ["-xf", sourceArchive, "-C", workDirectory], { stdio: "pipe" });

    const contractDirectory = join(workDirectory, "contracts");
    const lockPath = join(contractDirectory, "Scarb.lock");
    const manifestPath = join(contractDirectory, "Scarb.toml");
    const lockSha256 = sha256File(lockPath);
    const buildTarget = join(workDirectory, "target");
    const environment = {
      ...process.env,
      PATH: `${join(foundry.directory, "bin")}:${join(scarb.directory, "bin")}:${process.env.PATH ?? ""}`,
      SCARB_CACHE: join(workDirectory, "scarb-cache"),
      SCARB_CONFIG: join(workDirectory, "scarb-config"),
      SCARB_TARGET_DIR: buildTarget,
    };

    const buildOutput = exec(scarbBinary, ["--release", "build"], contractDirectory, environment);
    process.stdout.write(`${buildOutput}\n`);
    const testOutput = exec(
      snforgeBinary,
      ["test", "--release", "--color", "never"],
      contractDirectory,
      environment,
    );
    process.stdout.write(`${testOutput}\n`);
    const testMatch = testOutput.match(/Tests:\s+(\d+) passed, 0 failed/);
    if (!testMatch || Number(testMatch[1]) !== EXPECTED_TESTS) {
      throw new Error("UNEXPECTED_CAIRO_TEST_RESULT");
    }
    if (sha256File(lockPath) !== lockSha256) throw new Error("SCARB_LOCK_CHANGED_DURING_BUILD");

    const metadataOutput = exec(
      scarbBinary,
      ["--release", "--no-warnings", "metadata", "--format-version", "1"],
      contractDirectory,
      environment,
    );
    const metadata = parseScarbMetadata(metadataOutput);
    const packageGraph = canonicalPackageGraph(metadata, "gigstark_escrow");
    const profileDirectory = join(buildTarget, "release");
    const contractIndex = JSON.parse(
      readFileSync(join(profileDirectory, "gigstark_escrow.starknet_artifacts.json"), "utf8"),
    ) as ContractIndex;
    const contracts = contractIndex.contracts
      .map((entry) => contractArtifact(profileDirectory, entry))
      .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

    const reviewManifest = {
      format: "gigstark-sepolia-review-v1",
      status: "NO_BROADCAST_REVIEW_CANDIDATE",
      network: { name: "Starknet Sepolia", chainId: "SN_SEPOLIA" },
      source: {
        repository: "https://github.com/OGtev317/Gigstark",
        commit: sourceCommit,
        contractsTree: contractTree,
        archiveSha256: sha256File(sourceArchive),
        scarbManifestSha256: sha256File(manifestPath),
        scarbLockSha256: lockSha256,
        lockUnchangedAfterBuild: true,
      },
      toolchain: {
        profile: "release",
        scarb: {
          version: SCARB_VERSION,
          versionOutput: scarbVersion,
          archive: scarb.archive,
          archiveSha256: scarb.sha256,
        },
        starknetFoundry: {
          version: SNFORGE_VERSION,
          versionOutput: snforgeVersion,
          archive: foundry.archive,
          archiveSha256: foundry.sha256,
        },
        starkli: { used: false, reason: "No declaration or deployment is authorized." },
      },
      packageGraph: {
        sha256: sha256(canonicalJson(packageGraph)),
        packages: packageGraph,
      },
      verification: {
        cleanCommittedContractArchive: true,
        releaseBuild: "passed",
        cairoTests: { passed: EXPECTED_TESTS, failed: 0 },
        rpcRequests: false,
        transactionBroadcasts: false,
        fundMovements: false,
      },
      contracts,
      externalBindings: {
        privacyPool: {
          address: STRK20_SEPOLIA_POOL,
          sourceProvenance: "blocked_pending_starkware_issue_969",
          reviewedClassAllowlisted: false,
        },
      },
      releaseGates: {
        independentCairoReview: "required",
        privacyPoolSourceReproduction: "required",
        constructorArguments: "unset_and_unreviewed",
        declaration: "not_authorized",
        deployment: "not_authorized",
        walletExecution: "blocked_until_prior_gates_pass",
      },
    };

    const mainnetReviewManifest = {
      ...reviewManifest,
      format: "gigstark-mainnet-review-v1",
      network: { name: "Starknet Mainnet", chainId: "SN_MAIN" },
      externalBindings: {
        privacyPool: {
          address: STRK20_MAINNET_POOL,
          classHash: STRK20_MAINNET_V2_CLASS_HASH,
          sourceTag: STRK20_MAINNET_V2_SOURCE_TAG,
          abiSha256: STRK20_MAINNET_EXPECTED_ABI_SHA256,
          poolVersion: STRK20_MAINNET_EXPECTED_POOL_VERSION,
          sourceProvenance: "source_reproduced_official_v2_lineage",
          reviewedClassAllowlisted: true,
        },
      },
      releaseGates: {
        independentCairoReview: "required",
        privacyPoolSourceReproduction: "passed_for_pinned_mainnet_v2",
        livePoolHealthAndClassCheck: "required_immediately_before_wallet_preparation_and_submission",
        constructorArguments: "unset_and_unreviewed",
        declaration: "not_authorized",
        deployment: "not_authorized",
        walletExecution: "blocked_until_prior_gates_pass",
      },
    };

    mkdirSync(dirname(sepoliaOutputPath), { recursive: true });
    writeFileSync(sepoliaOutputPath, `${JSON.stringify(reviewManifest, null, 2)}\n`);
    writeFileSync(mainnetOutputPath, `${JSON.stringify(mainnetReviewManifest, null, 2)}\n`);
    console.log(`GIGSTARK_CAIRO_RELEASE_VERIFIED:${sepoliaOutputPath}`);
    console.log(`GIGSTARK_CAIRO_MAINNET_RELEASE_VERIFIED:${mainnetOutputPath}`);
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

function assertCommittedContractTree() {
  const status = git([
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    ...releaseInputs,
  ]);
  if (status) throw new Error(`CONTRACT_TREE_NOT_COMMITTED:${status.replaceAll("\n", ",")}`);
}

async function installTool(
  workDirectory: string,
  tool: "scarb" | "starknet-foundry",
  version: string,
  target: keyof (typeof releaseDigests)["scarb"],
) {
  const archive = `${tool}-v${version}-${target}.tar.gz`;
  const releaseName = tool === "scarb" ? "scarb" : "starknet-foundry";
  const repository = tool === "scarb" ? "software-mansion/scarb" : "foundry-rs/starknet-foundry";
  const digestGroup = tool === "scarb" ? releaseDigests.scarb : releaseDigests.foundry;
  const expectedSha256 = digestGroup[target];
  const url = `https://github.com/${repository}/releases/download/v${version}/${archive}`;
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${releaseName.toUpperCase()}_DOWNLOAD_FAILED:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedSha256) {
    throw new Error(`${releaseName.toUpperCase()}_CHECKSUM_MISMATCH:${actualSha256}`);
  }
  const archivePath = join(workDirectory, archive);
  writeFileSync(archivePath, bytes);
  execFileSync("tar", ["-xzf", archivePath, "-C", workDirectory], { stdio: "pipe" });
  return {
    archive,
    sha256: expectedSha256,
    directory: join(workDirectory, archive.replace(/\.tar\.gz$/, "")),
  };
}

function contractArtifact(
  profileDirectory: string,
  entry: ContractIndex["contracts"][number],
) {
  const sierraPath = join(profileDirectory, entry.artifacts.sierra);
  const casmPath = join(profileDirectory, entry.artifacts.casm);
  const sierra = JSON.parse(readFileSync(sierraPath, "utf8")) as CompiledSierra;
  const casm = JSON.parse(readFileSync(casmPath, "utf8")) as CairoAssembly;
  const constructor = (sierra.abi as AbiEntry[]).find((entry) => entry.type === "constructor");
  return {
    name: entry.contract_name,
    modulePath: entry.module_path,
    sierraClassHash: hash.computeContractClassHash(sierra),
    compiledClassHash: hash.computeCompiledClassHash(casm),
    sierraArtifactSha256: sha256File(sierraPath),
    casmArtifactSha256: sha256File(casmPath),
    sierraProgramLength: sierra.sierra_program.length,
    casmBytecodeLength: casm.bytecode.length,
    constructor: {
      arguments: (constructor?.inputs ?? []).map((input) => ({ ...input, value: null })),
      reviewed: false,
    },
  };
}

function parseScarbMetadata(output: string): ScarbMetadata {
  const start = output.indexOf("{");
  if (start < 0) throw new Error("INVALID_SCARB_METADATA");
  const parsed = JSON.parse(output.slice(start)) as Partial<ScarbMetadata>;
  if (!Array.isArray(parsed.packages)) throw new Error("INVALID_SCARB_METADATA");
  return parsed as ScarbMetadata;
}

function git(arguments_: string[]): string {
  return exec("git", arguments_, repositoryRoot);
}

function exec(
  executable: string,
  arguments_: string[],
  cwd = repositoryRoot,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return execFileSync(executable, arguments_, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "GIGSTARK_CAIRO_RELEASE_FAILED");
  process.exitCode = 2;
});
