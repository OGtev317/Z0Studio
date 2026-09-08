import { walletV6, type STRK20_ACTION } from "starknet";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import {
  STRK20_OBSERVED_POOL_CLASS_HASH,
  STRK20_REVIEWED_POOL_CLASS_HASH,
  STRK20_SEPOLIA_POOL,
} from "./strk20-sepolia";
import {
  STARKNET_MAINNET_CHAIN_ID,
  STRK20_MAINNET_POOL,
  STRK20_MAINNET_V2_CLASS_HASH,
} from "./strk20-mainnet";

export const STRK20_WALLET_API_MIN_VERSION = "0.10.3";
export const STRK20_SEPOLIA_POOL_ADDRESS = STRK20_SEPOLIA_POOL;
export const STRK20_REVIEWED_RC0_CLASS_HASH = STRK20_REVIEWED_POOL_CLASS_HASH;
export const STRK20_OBSERVED_SEPOLIA_CLASS_HASH = STRK20_OBSERVED_POOL_CLASS_HASH;

export type ReviewedPoolTarget = {
  network: "SN_SEPOLIA" | "SN_MAIN";
  chainId: string;
  address: string;
  classHash: string;
};

export const STRK20_SEPOLIA_REVIEW_TARGET: ReviewedPoolTarget = {
  network: "SN_SEPOLIA",
  chainId: "0x534e5f5345504f4c4941",
  address: STRK20_SEPOLIA_POOL_ADDRESS,
  classHash: STRK20_REVIEWED_RC0_CLASS_HASH,
};

export const STRK20_MAINNET_REVIEW_TARGET: ReviewedPoolTarget = {
  network: "SN_MAIN",
  chainId: STARKNET_MAINNET_CHAIN_ID,
  address: STRK20_MAINNET_POOL,
  classHash: STRK20_MAINNET_V2_CLASS_HASH,
};

const OP_DEPOSIT = 0n;
const OP_CLAIM = 5n;
const ROLE_NONE = 0n;
const ROLE_BUYER = 1n;
const ROLE_SELLER = 2n;
const MAX_U8 = (1n << 8n) - 1n;
const MAX_U64 = (1n << 64n) - 1n;
const MAX_U128 = (1n << 128n) - 1n;
const OPEN_NOTE_PLACEHOLDER = "${openNoteIds[0]}";

export type FeltInput = string | bigint | number;

export type GigstarkPassportProofCalldata = {
  policyId: FeltInput;
  audience: FeltInput;
  purpose: FeltInput;
  credentialClass: FeltInput;
  scopeNullifier: FeltInput;
  proofCommitment: FeltInput;
  issuedAt: FeltInput;
  expiresAt: FeltInput;
  signatureR: FeltInput;
  signatureS: FeltInput;
};

export type ReviewedPool = {
  address: string;
  classHash: string;
};

export type Strk20WalletAccount = {
  strk20PrepareInvoke(actions: STRK20_ACTION[], simulate?: boolean): Promise<unknown>;
  strk20InvokeTransaction(actions: STRK20_ACTION[]): Promise<{ transaction_hash: string }>;
};

export type StarknetPoolProvider = {
  getChainId(): Promise<string>;
  getClassHashAt(contractAddress: string, blockIdentifier?: "latest"): Promise<string>;
};

export type StarknetEscrowProvider = StarknetPoolProvider & {
  callContract(
    call: { contractAddress: string; entrypoint: string; calldata: string[] },
    blockIdentifier?: "latest",
  ): Promise<readonly string[]>;
};

export type EscrowDepositInput = {
  pool: ReviewedPool;
  escrowAddress: FeltInput;
  token: FeltInput;
  amount: bigint;
  escrowId: FeltInput;
  buyerCommitment: FeltInput;
  sellerCommitment: FeltInput;
  deadline: FeltInput;
};

export type EscrowClaimInput = {
  pool: ReviewedPool;
  escrowAddress: FeltInput;
  token: FeltInput;
  recipient: FeltInput;
  escrowId: FeltInput;
  winnerRole: "buyer" | "seller";
  proof: GigstarkPassportProofCalldata;
};

export async function detectStrk20WalletApi(
  wallet: WalletWithStarknetFeatures,
): Promise<{ supported: boolean; versions: string[] }> {
  const versions = (await walletV6.supportedWalletApi(wallet)).map(String);
  return { supported: supportsWalletApiVersions(versions), versions };
}

export function supportsWalletApiVersions(versions: readonly string[]): boolean {
  return versions.some(
    (version) => compareVersions(version, STRK20_WALLET_API_MIN_VERSION) >= 0,
  );
}

export function assertReviewedSepoliaPool(pool: ReviewedPool): void {
  assertReviewedPoolTarget(pool, STRK20_SEPOLIA_REVIEW_TARGET);
}

export function assertReviewedPoolTarget(
  pool: ReviewedPool,
  target: ReviewedPoolTarget,
): void {
  if (!sameFelt(pool.address, target.address)) {
    throw new Error("STRK20_POOL_ADDRESS_MISMATCH");
  }
  if (!sameFelt(pool.classHash, target.classHash)) {
    throw new Error("STRK20_POOL_CLASS_UNREVIEWED");
  }
}

export async function verifyReviewedSepoliaPool(
  provider: StarknetPoolProvider,
): Promise<ReviewedPool> {
  return verifyReviewedPoolTarget(provider, STRK20_SEPOLIA_REVIEW_TARGET);
}

export async function verifyReviewedPoolTarget(
  provider: StarknetPoolProvider,
  target: ReviewedPoolTarget,
): Promise<ReviewedPool> {
  const chainId = await provider.getChainId();
  if (!isTargetChainId(chainId, target)) {
    throw new Error(
      target.network === "SN_MAIN" ? "STRK20_WRONG_MAINNET_CHAIN" : "STRK20_WRONG_CHAIN",
    );
  }
  const pool = {
    address: target.address,
    classHash: await provider.getClassHashAt(target.address, "latest"),
  };
  assertReviewedPoolTarget(pool, target);
  return pool;
}

export function buildPrivateDepositActions(
  input: EscrowDepositInput,
  target: ReviewedPoolTarget = STRK20_SEPOLIA_REVIEW_TARGET,
): STRK20_ACTION[] {
  assertReviewedPoolTarget(input.pool, target);
  const amount = requireU128(input.amount, "INVALID_DEPOSIT_AMOUNT");
  const escrowAddress = requireAddress(input.escrowAddress, "INVALID_ESCROW_ADDRESS");
  const token = requireAddress(input.token, "INVALID_TOKEN_ADDRESS");
  const escrowId = requireFelt(input.escrowId, "INVALID_ESCROW_ID");
  const buyerCommitment = requireFelt(input.buyerCommitment, "INVALID_BUYER_COMMITMENT");
  const sellerCommitment = requireFelt(input.sellerCommitment, "INVALID_SELLER_COMMITMENT");
  if (sameFelt(buyerCommitment, sellerCommitment)) throw new Error("SAME_ROLE_COMMITMENT");
  const deadline = requireBoundedInteger(input.deadline, MAX_U64, "INVALID_DEADLINE");

  return [
    { type: "withdraw", token, amount, recipient: escrowAddress },
    {
      type: "invoke",
      contract: escrowAddress,
      calldata: [
        felt(OP_DEPOSIT),
        escrowId,
        felt(ROLE_NONE),
        token,
        amount,
        buyerCommitment,
        sellerCommitment,
        "0x0",
        deadline,
        "0x0",
        ...emptyProofCalldata(),
      ],
    },
  ];
}

export function buildWinnerClaimActions(
  input: EscrowClaimInput,
  target: ReviewedPoolTarget = STRK20_SEPOLIA_REVIEW_TARGET,
): STRK20_ACTION[] {
  assertReviewedPoolTarget(input.pool, target);
  const escrowAddress = requireAddress(input.escrowAddress, "INVALID_ESCROW_ADDRESS");
  const token = requireAddress(input.token, "INVALID_TOKEN_ADDRESS");
  const recipient = requireAddress(input.recipient, "INVALID_RECIPIENT_ADDRESS");
  const escrowId = requireFelt(input.escrowId, "INVALID_ESCROW_ID");
  const winnerRole = input.winnerRole === "buyer" ? ROLE_BUYER : ROLE_SELLER;

  return [
    { type: "transfer", token, amount: "OPEN", recipient },
    {
      type: "invoke",
      contract: escrowAddress,
      calldata: [
        felt(OP_CLAIM),
        escrowId,
        felt(winnerRole),
        "0x0",
        "0x0",
        "0x0",
        "0x0",
        "0x0",
        "0x0",
        OPEN_NOTE_PLACEHOLDER,
        ...proofCalldata(input.proof),
      ],
    },
  ];
}

export async function preparePrivateDeposit(
  account: Strk20WalletAccount,
  provider: StarknetPoolProvider,
  input: Omit<EscrowDepositInput, "pool">,
): Promise<unknown> {
  const pool = await verifyReviewedSepoliaPool(provider);
  return account.strk20PrepareInvoke(buildPrivateDepositActions({ ...input, pool }), true);
}

export async function preparePrivateDepositForReview(
  account: Strk20WalletAccount,
  provider: StarknetPoolProvider,
  input: Omit<EscrowDepositInput, "pool">,
): Promise<STRK20_ACTION[]> {
  const pool = await verifyReviewedSepoliaPool(provider);
  const actions = buildPrivateDepositActions({ ...input, pool });
  await account.strk20PrepareInvoke(actions, true);
  return actions;
}

export async function prepareMainnetPrivateDepositForReview(
  account: Strk20WalletAccount,
  provider: StarknetPoolProvider,
  input: Omit<EscrowDepositInput, "pool">,
): Promise<STRK20_ACTION[]> {
  const pool = await verifyReviewedPoolTarget(provider, STRK20_MAINNET_REVIEW_TARGET);
  const actions = buildPrivateDepositActions(
    { ...input, pool },
    STRK20_MAINNET_REVIEW_TARGET,
  );
  await account.strk20PrepareInvoke(actions, true);
  return actions;
}

export async function prepareWinnerClaim(
  account: Strk20WalletAccount,
  provider: StarknetPoolProvider,
  input: Omit<EscrowClaimInput, "pool">,
): Promise<unknown> {
  const pool = await verifyReviewedSepoliaPool(provider);
  return account.strk20PrepareInvoke(buildWinnerClaimActions({ ...input, pool }), true);
}

export async function prepareWinnerClaimForReview(
  account: Strk20WalletAccount,
  provider: StarknetEscrowProvider,
  input: Omit<EscrowClaimInput, "pool">,
): Promise<{ actions: STRK20_ACTION[]; publicAmount: string }> {
  const pool = await verifyReviewedSepoliaPool(provider);
  const actions = buildWinnerClaimActions({ ...input, pool });
  const escrowAddress = requireAddress(input.escrowAddress, "INVALID_ESCROW_ADDRESS");
  const escrowId = requireFelt(input.escrowId, "INVALID_ESCROW_ID");
  const token = requireAddress(input.token, "INVALID_TOKEN_ADDRESS");
  const record = await provider.callContract(
    { contractAddress: escrowAddress, entrypoint: "get_escrow", calldata: [escrowId] },
    "latest",
  );
  if (record.length !== 10) throw new Error("INVALID_ESCROW_RECORD");
  const recordToken = record[3];
  const recordAmount = record[4];
  const recordStatus = record[6];
  const claimed = input.winnerRole === "seller" ? record[7] : record[8];
  if (!recordToken || !sameFelt(recordToken, token)) throw new Error("ESCROW_TOKEN_MISMATCH");
  let amountValue: bigint;
  let statusValue: bigint;
  let claimedValue: bigint;
  try {
    amountValue = BigInt(recordAmount ?? "");
    statusValue = BigInt(recordStatus ?? "");
    claimedValue = BigInt(claimed ?? "");
  } catch {
    throw new Error("INVALID_ESCROW_RECORD");
  }
  if (amountValue <= 0n || amountValue > MAX_U128) {
    throw new Error("INVALID_ESCROW_AMOUNT");
  }
  const expectedStatus = input.winnerRole === "seller" ? 4n : 5n;
  if (statusValue !== expectedStatus) {
    throw new Error("ESCROW_WINNER_MISMATCH");
  }
  if (claimedValue !== 0n) throw new Error("ESCROW_ALREADY_CLAIMED");
  await account.strk20PrepareInvoke(actions, true);
  return { actions, publicAmount: amountValue.toString() };
}

export async function submitPreparedActions(
  account: Strk20WalletAccount,
  provider: StarknetPoolProvider,
  actions: STRK20_ACTION[],
): Promise<{ transaction_hash: string }> {
  if (actions.length === 0) throw new Error("EMPTY_STRK20_ACTIONS");
  await verifyReviewedSepoliaPool(provider);
  return account.strk20InvokeTransaction(actions);
}

function proofCalldata(proof: GigstarkPassportProofCalldata): string[] {
  const issuedAt = requireBoundedInteger(proof.issuedAt, MAX_U64, "INVALID_ISSUED_AT");
  const expiresAt = requireBoundedInteger(proof.expiresAt, MAX_U64, "INVALID_EXPIRES_AT");
  if (BigInt(expiresAt) <= BigInt(issuedAt)) throw new Error("INVALID_PROOF_TIME_RANGE");
  return [
    requireFelt(proof.policyId, "INVALID_POLICY_ID"),
    requireAddress(proof.audience, "INVALID_PROOF_AUDIENCE"),
    requireBoundedInteger(proof.purpose, MAX_U8, "INVALID_PROOF_PURPOSE"),
    requireFelt(proof.credentialClass, "INVALID_CREDENTIAL_CLASS"),
    requireFelt(proof.scopeNullifier, "INVALID_SCOPE_NULLIFIER"),
    requireFelt(proof.proofCommitment, "INVALID_PROOF_COMMITMENT"),
    issuedAt,
    expiresAt,
    requireFelt(proof.signatureR, "INVALID_SIGNATURE_R"),
    requireFelt(proof.signatureS, "INVALID_SIGNATURE_S"),
  ];
}

function emptyProofCalldata(): string[] {
  return Array.from({ length: 10 }, () => "0x0");
}

function requireAddress(value: FeltInput, error: string): string {
  const normalized = requireFelt(value, error);
  const parsed = BigInt(normalized);
  if (parsed >= 1n << 251n) throw new Error(error);
  return normalized;
}

function requireFelt(value: FeltInput, error: string): string {
  let parsed: bigint;
  try {
    parsed = BigInt(value);
  } catch {
    throw new Error(error);
  }
  if (parsed <= 0n || parsed >= 1n << 251n) throw new Error(error);
  return felt(parsed);
}

function requireU128(value: bigint, error: string): string {
  if (value <= 0n || value > MAX_U128) throw new Error(error);
  return felt(value);
}

function requireBoundedInteger(value: FeltInput, maximum: bigint, error: string): string {
  const normalized = requireFelt(value, error);
  if (BigInt(normalized) > maximum) throw new Error(error);
  return normalized;
}

function felt(value: bigint): string {
  return `0x${value.toString(16)}`;
}

function sameFelt(left: FeltInput, right: FeltInput): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}

function isTargetChainId(chainId: string, target: ReviewedPoolTarget): boolean {
  if (chainId === target.network) return true;
  return sameFelt(chainId, target.chainId);
}

function compareVersions(left: string, right: string): number {
  const parse = (version: string) => {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    return match ? match.slice(1).map(Number) : [0, 0, 0];
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
