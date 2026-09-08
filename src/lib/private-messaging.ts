import {
  createMessagingIdentity,
  decryptMessage,
  encryptMessage,
  validateEncryptedEnvelope,
  type EncryptedEnvelope,
  type MessagingIdentity,
} from "./encrypted-messaging";

export const PAYMENT_MEMO_RECEIPT_VERSION = 1;
const MAX_MEMO_BYTES = 280;
const PRIVATE_FIELD_PATTERN =
  /(private[_-]?key|viewing[_-]?key|seed|mnemonic|witness|proof|note[_-]?secret|private[_-]?balance)/i;

export type PaymentMemoContact = {
  label: string;
  publicKey: string;
};

export type PendingPaymentMemo = {
  envelope: EncryptedEnvelope;
  recipientLabel: string;
  replayNullifier: string;
};

export type PaymentMemoReceipt = {
  version: typeof PAYMENT_MEMO_RECEIPT_VERSION;
  paymentHash: string;
  recipientLabel: string;
  memoCommitment: string;
  replayNullifier: string;
  envelope: EncryptedEnvelope;
};

export { createMessagingIdentity, type MessagingIdentity };

export function createPaymentMemoContact(identity: MessagingIdentity): PaymentMemoContact {
  return { label: identity.label, publicKey: identity.publicKey };
}

export async function encryptPaymentMemo(input: {
  sender: MessagingIdentity;
  recipient: PaymentMemoContact;
  plaintext: string;
  paymentCommitment: string;
  createdAt?: number;
}): Promise<PendingPaymentMemo> {
  const plaintext = input.plaintext.trim();
  assertMemoPlaintext(plaintext);
  const replayNullifier = await digest(`ZEEROSTREAM_MEMO_REPLAY_V1:${crypto.randomUUID()}:${input.paymentCommitment}`);
  const envelope = await encryptMessage({
    id: `memo-${crypto.randomUUID()}`,
    threadCommitment: `zeerostream:payment-memo:${input.paymentCommitment}`,
    sender: input.sender,
    recipientPublicKey: input.recipient.publicKey,
    plaintext,
    createdAt: input.createdAt,
  });
  return { envelope, recipientLabel: input.recipient.label, replayNullifier };
}

export async function bindPaymentMemoReceipt(input: {
  pending: PendingPaymentMemo;
  paymentHash: string;
}): Promise<PaymentMemoReceipt> {
  const paymentHash = normalizeTransactionHash(input.paymentHash);
  await validateEncryptedEnvelope(input.pending.envelope);
  const memoCommitment = await commitMemoReceipt({
    paymentHash,
    replayNullifier: input.pending.replayNullifier,
    anchorDigest: input.pending.envelope.anchorDigest,
  });
  return {
    version: PAYMENT_MEMO_RECEIPT_VERSION,
    paymentHash,
    recipientLabel: input.pending.recipientLabel,
    memoCommitment,
    replayNullifier: input.pending.replayNullifier,
    envelope: input.pending.envelope,
  };
}

export async function decryptPaymentMemo(
  identity: MessagingIdentity,
  receipt: PaymentMemoReceipt,
): Promise<string> {
  await validatePaymentMemoReceipt(receipt);
  return decryptMessage(identity, receipt.envelope);
}

export async function validatePaymentMemoReceipt(receipt: PaymentMemoReceipt): Promise<void> {
  if (
    receipt.version !== PAYMENT_MEMO_RECEIPT_VERSION ||
    !receipt.paymentHash ||
    !receipt.recipientLabel.trim() ||
    !receipt.memoCommitment ||
    !receipt.replayNullifier ||
    !receipt.envelope
  ) {
    throw new Error("INVALID_PAYMENT_MEMO_RECEIPT");
  }
  normalizeTransactionHash(receipt.paymentHash);
  await validateEncryptedEnvelope(receipt.envelope);
  const expected = await commitMemoReceipt({
    paymentHash: receipt.paymentHash,
    replayNullifier: receipt.replayNullifier,
    anchorDigest: receipt.envelope.anchorDigest,
  });
  if (receipt.memoCommitment !== expected) throw new Error("PAYMENT_MEMO_TAMPERED");
}

export async function parsePaymentMemoReceipt(value: string): Promise<PaymentMemoReceipt> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("INVALID_PAYMENT_MEMO_RECEIPT");
  }
  const receipt = parsed as PaymentMemoReceipt;
  await validatePaymentMemoReceipt(receipt);
  return receipt;
}

export function updatePaymentMemoReceipts(
  receipts: readonly PaymentMemoReceipt[],
  candidate: PaymentMemoReceipt,
  limit = 12,
): PaymentMemoReceipt[] {
  const paymentHash = normalizeTransactionHash(candidate.paymentHash);
  if (receipts.some((receipt) => receipt.replayNullifier === candidate.replayNullifier && receipt.paymentHash !== paymentHash)) {
    throw new Error("PAYMENT_MEMO_REPLAYED");
  }
  return [
    { ...candidate, paymentHash },
    ...receipts.filter((receipt) => normalizeTransactionHash(receipt.paymentHash) !== paymentHash),
  ].slice(0, limit);
}

export function parsePaymentMemoReceiptHistory(value: string | null): PaymentMemoReceipt[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.reduce<PaymentMemoReceipt[]>((receipts, item) => {
      try {
        const receipt = item as PaymentMemoReceipt;
        normalizeTransactionHash(receipt.paymentHash);
        if (!receipt.memoCommitment || !receipt.replayNullifier || !receipt.envelope) return receipts;
        return updatePaymentMemoReceipts(receipts, receipt);
      } catch {
        return receipts;
      }
    }, []).reverse();
  } catch {
    return [];
  }
}

export async function assertPaymentMemoReceiptIsPublic(receipt: PaymentMemoReceipt, plaintext: string): Promise<void> {
  await validatePaymentMemoReceipt(receipt);
  const serialized = JSON.stringify(receipt);
  if (plaintext && serialized.includes(plaintext)) throw new Error("PAYMENT_MEMO_STORES_PLAINTEXT");
  if (PRIVATE_FIELD_PATTERN.test(serialized)) throw new Error("PAYMENT_MEMO_CONTAINS_PRIVATE_MATERIAL");
}

export async function paymentMemoCommitmentForFields(input: {
  operation: string;
  amount: string;
  recipient: string;
  pool: string;
}): Promise<string> {
  return digest([
    "ZEEROSTREAM_PAYMENT_MEMO_FIELDS_V1",
    input.operation,
    input.amount.trim(),
    input.recipient.trim().toLowerCase(),
    input.pool.toLowerCase(),
  ].join(":"));
}

function assertMemoPlaintext(plaintext: string): void {
  if (!plaintext) throw new Error("PAYMENT_MEMO_REQUIRED");
  if (new TextEncoder().encode(plaintext).length > MAX_MEMO_BYTES) throw new Error("PAYMENT_MEMO_TOO_LONG");
  if (PRIVATE_FIELD_PATTERN.test(plaintext)) throw new Error("PAYMENT_MEMO_PRIVATE_MATERIAL");
}

async function commitMemoReceipt(input: {
  paymentHash: string;
  replayNullifier: string;
  anchorDigest: string;
}): Promise<string> {
  return digest([
    "ZEEROSTREAM_PAYMENT_MEMO_RECEIPT_V1",
    normalizeTransactionHash(input.paymentHash),
    input.replayNullifier,
    input.anchorDigest,
  ].join(":"));
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeTransactionHash(value: string): string {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value) || BigInt(value) === 0n) {
    throw new Error("INVALID_TRANSACTION_HASH");
  }
  return `0x${BigInt(value).toString(16)}`;
}
