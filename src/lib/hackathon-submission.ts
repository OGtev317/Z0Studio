import { receiptTouchesPool } from "./simple-mainnet-payment";

export type HackathonSubmission = {
  transactions: string[];
  contracts: string[];
  demo_video: string;
  demo_url: string;
};

export type QualifyingReceiptEvidence = {
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  finalityStatus: string;
  executionStatus: "SUCCEEDED";
  poolEventCount: number;
};

export function parseHackathonSubmission(value: unknown): HackathonSubmission {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SUBMISSION_NOT_OBJECT");
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.transactions) || !record.transactions.every((item) => typeof item === "string")) {
    throw new Error("SUBMISSION_TRANSACTIONS_INVALID");
  }
  if (!Array.isArray(record.contracts) || !record.contracts.every((item) => typeof item === "string")) {
    throw new Error("SUBMISSION_CONTRACTS_INVALID");
  }
  if (typeof record.demo_video !== "string" || typeof record.demo_url !== "string") {
    throw new Error("SUBMISSION_URLS_INVALID");
  }
  return {
    transactions: record.transactions,
    contracts: record.contracts,
    demo_video: record.demo_video,
    demo_url: record.demo_url,
  };
}

export function assertHackathonSubmissionReady(submission: HackathonSubmission): void {
  if (submission.transactions.length < 3) throw new Error("SUBMISSION_REQUIRES_THREE_TRANSACTIONS");
  const normalized = submission.transactions.map((hash) => requireTransactionHash(hash));
  if (new Set(normalized).size !== normalized.length) throw new Error("SUBMISSION_TRANSACTION_DUPLICATE");
  if (submission.contracts.length !== 0) throw new Error("SIMPLIFIED_MVP_MUST_NOT_DECLARE_CONTRACTS");
  requirePublicHttpsUrl(submission.demo_url, "SUBMISSION_DEMO_URL_INVALID");
  requirePublicHttpsUrl(submission.demo_video, "SUBMISSION_VIDEO_URL_INVALID");
}

export function qualifyingReceiptEvidence(
  transactionHash: string,
  receipt: unknown,
  poolAddress: string,
): QualifyingReceiptEvidence {
  requireTransactionHash(transactionHash);
  const record = unwrapReceipt(receipt);
  if (!receiptTouchesPool(receipt, poolAddress)) throw new Error("SUBMISSION_RECEIPT_NOT_QUALIFYING");
  const finalityStatus = requireString(record.finality_status, "SUBMISSION_FINALITY_MISSING");
  if (finalityStatus !== "ACCEPTED_ON_L1" && finalityStatus !== "ACCEPTED_ON_L2") {
    throw new Error("SUBMISSION_RECEIPT_NOT_ACCEPTED");
  }
  const blockHash = requireString(record.block_hash, "SUBMISSION_BLOCK_HASH_MISSING");
  const blockNumber = record.block_number;
  if (!Number.isInteger(blockNumber) || Number(blockNumber) < 0) throw new Error("SUBMISSION_BLOCK_NUMBER_MISSING");
  const events = Array.isArray(record.events) ? record.events : [];
  const poolEventCount = events.filter((event) => {
    if (!event || typeof event !== "object") return false;
    const from = (event as Record<string, unknown>).from_address;
    return typeof from === "string" && sameFelt(from, poolAddress);
  }).length;
  return {
    transactionHash: normalizeFelt(transactionHash),
    blockHash: normalizeFelt(blockHash),
    blockNumber: Number(blockNumber),
    finalityStatus,
    executionStatus: "SUCCEEDED",
    poolEventCount,
  };
}

export function assertProviderReceiptAgreement(
  left: QualifyingReceiptEvidence,
  right: QualifyingReceiptEvidence,
): void {
  if (
    left.transactionHash !== right.transactionHash ||
    left.blockHash !== right.blockHash ||
    left.blockNumber !== right.blockNumber ||
    left.executionStatus !== right.executionStatus ||
    left.poolEventCount !== right.poolEventCount
  ) throw new Error("SUBMISSION_PROVIDER_RECEIPT_DISAGREEMENT");
}

function unwrapReceipt(receipt: unknown): Record<string, unknown> {
  if (!receipt || typeof receipt !== "object") throw new Error("SUBMISSION_RECEIPT_INVALID");
  const wrapper = receipt as Record<string, unknown>;
  if (wrapper.value && typeof wrapper.value === "object") return wrapper.value as Record<string, unknown>;
  return wrapper;
}

function requireTransactionHash(value: string): string {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value)) throw new Error("SUBMISSION_TRANSACTION_HASH_INVALID");
  if (BigInt(value) === 0n) throw new Error("SUBMISSION_TRANSACTION_HASH_INVALID");
  return normalizeFelt(value);
}

function requirePublicHttpsUrl(value: string, error: string): void {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error();
  } catch {
    throw new Error(error);
  }
}

function requireString(value: unknown, error: string): string {
  if (typeof value !== "string" || !value) throw new Error(error);
  return value;
}

function normalizeFelt(value: string): string {
  return `0x${BigInt(value).toString(16)}`;
}

function sameFelt(left: string, right: string): boolean {
  try { return BigInt(left) === BigInt(right); } catch { return false; }
}
