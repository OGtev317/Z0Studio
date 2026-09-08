import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RpcProvider, hash, type CairoAssembly } from "starknet";
import {
  STRK20_LIVE_CASM_BYTECODE_LENGTH,
  STRK20_LIVE_COMPILED_CLASS_HASH,
  STRK20_LIVE_SIERRA_LENGTH,
  STRK20_OBSERVED_POOL_CLASS_HASH,
  STRK20_SEPOLIA_POOL,
  STRK20_UNIVERSAL_SIERRA_COMPILER_VERSION,
} from "../src/lib/strk20-sepolia";
import {
  DEFAULT_STARKNET_SEPOLIA_ENDPOINTS,
  STARKNET_SEPOLIA_CHAIN_ID,
} from "../src/lib/starknet-health";

const rpc = process.env.GIGSTARK_SEPOLIA_RPC ?? DEFAULT_STARKNET_SEPOLIA_ENDPOINTS[0].url;

const compilerAssets = {
  "darwin-arm64": {
    archive: "universal-sierra-compiler-v2.8.0-aarch64-apple-darwin.tar.gz",
    sha256: "64359fdc6d45d7e3778ea2628523c94af05d882f15aecdb61cb29a268420519a",
  },
  "darwin-x64": {
    archive: "universal-sierra-compiler-v2.8.0-x86_64-apple-darwin.tar.gz",
    sha256: "9621ab391ef91929bf4dccfa30bcd106157a2379dca1daad4f2163c821d7a050",
  },
} as const;

function sameFelt(left: string, right: string): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}

async function main() {
  const compilerWorkDirectory = mkdtempSync(join(tmpdir(), "gigstark-usc-"));
  try {
    const compiler = await resolveCompiler(compilerWorkDirectory);
    const compilerVersion = execFileSync(compiler, ["--version"], { encoding: "utf8" }).trim();
    if (compilerVersion !== `universal-sierra-compiler ${STRK20_UNIVERSAL_SIERRA_COMPILER_VERSION}`) {
      throw new Error(`STRK20_WRONG_UNIVERSAL_SIERRA_COMPILER:${compilerVersion}`);
    }

    const provider = new RpcProvider({ nodeUrl: rpc });
    const chainId = await provider.getChainId();
    if (!sameFelt(chainId, STARKNET_SEPOLIA_CHAIN_ID)) throw new Error("STRK20_WRONG_CHAIN");

    const [classHash, contractClass] = await Promise.all([
      provider.getClassHashAt(STRK20_SEPOLIA_POOL, "latest"),
      provider.getClassAt(STRK20_SEPOLIA_POOL, "latest"),
    ]);
    if (!sameFelt(classHash, STRK20_OBSERVED_POOL_CLASS_HASH)) {
      throw new Error(`STRK20_LIVE_CLASS_CHANGED:${classHash}`);
    }
    if (!("sierra_program" in contractClass)) throw new Error("STRK20_POOL_CLASS_NOT_SIERRA");

    const recomputedClassHash = hash.computeContractClassHash(contractClass);
    if (!sameFelt(recomputedClassHash, STRK20_OBSERVED_POOL_CLASS_HASH)) {
      throw new Error(`STRK20_SIERRA_HASH_MISMATCH:${recomputedClassHash}`);
    }
    if (contractClass.sierra_program.length !== STRK20_LIVE_SIERRA_LENGTH) {
      throw new Error(`STRK20_SIERRA_LENGTH_MISMATCH:${contractClass.sierra_program.length}`);
    }

    const workDirectory = mkdtempSync(join(tmpdir(), "gigstark-strk20-artifacts-"));
    const sierraPath = join(workDirectory, "privacy-pool.sierra.json");
    const casmPath = join(workDirectory, "privacy-pool.casm.json");
    try {
      writeFileSync(
        sierraPath,
        JSON.stringify({
          ...contractClass,
          abi:
            typeof contractClass.abi === "string"
              ? contractClass.abi
              : JSON.stringify(contractClass.abi),
        }),
      );
      execFileSync(
        compiler,
        ["compile-contract", "--sierra-path", sierraPath, "--output-path", casmPath],
        { stdio: "pipe" },
      );
      const compiledClass = JSON.parse(readFileSync(casmPath, "utf8")) as CairoAssembly;
      const recomputedCompiledClassHash = hash.computeCompiledClassHash(compiledClass);
      if (!sameFelt(recomputedCompiledClassHash, STRK20_LIVE_COMPILED_CLASS_HASH)) {
        throw new Error(`STRK20_CASM_HASH_MISMATCH:${recomputedCompiledClassHash}`);
      }
      if (compiledClass.bytecode.length !== STRK20_LIVE_CASM_BYTECODE_LENGTH) {
        throw new Error(`STRK20_CASM_LENGTH_MISMATCH:${compiledClass.bytecode.length}`);
      }

      console.log(
        JSON.stringify(
          {
            network: "SN_SEPOLIA",
            pool: STRK20_SEPOLIA_POOL,
            compilerVersion,
            sierraClassHash: recomputedClassHash,
            compiledClassHash: recomputedCompiledClassHash,
            sierraLength: contractClass.sierra_program.length,
            casmBytecodeLength: compiledClass.bytecode.length,
            sourceMapped: false,
            status: "ONCHAIN_ARTIFACT_PAIR_REPRODUCED_SOURCE_UNMAPPED",
          },
          null,
          2,
        ),
      );
    } finally {
      rmSync(workDirectory, { recursive: true, force: true });
    }
  } finally {
    rmSync(compilerWorkDirectory, { recursive: true, force: true });
  }
}

async function resolveCompiler(workDirectory: string): Promise<string> {
  if (process.env.GIGSTARK_USC_BIN) return process.env.GIGSTARK_USC_BIN;

  try {
    const installedVersion = execFileSync("universal-sierra-compiler", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (installedVersion === `universal-sierra-compiler ${STRK20_UNIVERSAL_SIERRA_COMPILER_VERSION}`) {
      return "universal-sierra-compiler";
    }
  } catch {
    // Use the pinned, checksum-verified release asset below.
  }

  const asset = compilerAssets[`${process.platform}-${process.arch}` as keyof typeof compilerAssets];
  if (!asset) {
    throw new Error("STRK20_PINNED_COMPILER_UNAVAILABLE_SET_GIGSTARK_USC_BIN");
  }
  const url = `https://github.com/software-mansion/universal-sierra-compiler/releases/download/v${STRK20_UNIVERSAL_SIERRA_COMPILER_VERSION}/${asset.archive}`;
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`STRK20_COMPILER_DOWNLOAD_FAILED:${response.status}`);
  const archiveBytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(archiveBytes).digest("hex");
  if (digest !== asset.sha256) throw new Error(`STRK20_COMPILER_CHECKSUM_MISMATCH:${digest}`);

  const archivePath = join(workDirectory, asset.archive);
  writeFileSync(archivePath, archiveBytes);
  execFileSync("tar", ["-xzf", archivePath, "-C", workDirectory], { stdio: "pipe" });
  return join(
    workDirectory,
    asset.archive.replace(/\.tar\.gz$/, ""),
    "bin",
    "universal-sierra-compiler",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "STRK20_ARTIFACT_REPRODUCTION_FAILED");
  process.exitCode = 2;
});
