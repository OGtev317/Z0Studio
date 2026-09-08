import {
  ZEEROSTREAM_DEMO_RECEIPTS,
  ZEEROSTREAM_DEMO_URL,
  ZEEROSTREAM_DEMO_VIDEO_URL,
  ZEEROSTREAM_MANIFEST_URL,
} from "./hackathon-evidence";

const PRIVATE_FIELD_PATTERN =
  /(private[_-]?key|viewing[_-]?key|seed|mnemonic|note[_-]?secret|private[_-]?balance|witness\s*[:=]|proof\s*[:=])/i;

export type ReceiptRoomCard = {
  step: string;
  role: string;
  detail: string;
  hash: string;
  status: "verified-mainnet" | "local-demo";
  visibleFields: readonly string[];
  hiddenFields: readonly string[];
};

export type CreatorReceiptRoom = {
  demoUrl: string;
  demoVideoUrl: string;
  manifestUrl: string;
  poolEventPolicy: string;
  cards: ReceiptRoomCard[];
};

export type AccessPassInput = {
  receiptHash: string;
  tier: "Supporter" | "Studio" | "Patron";
  audience: string;
  issuedAt: number;
  expiresAt: number;
};

export type AccessDisclosurePass = {
  version: 1;
  tier: AccessPassInput["tier"];
  audience: string;
  receiptHash: string;
  disclosureDigest: string;
  issuedAt: number;
  expiresAt: number;
  visibleFields: readonly string[];
  hiddenFields: readonly string[];
};

export function buildCreatorReceiptRoom(): CreatorReceiptRoom {
  return {
    demoUrl: ZEEROSTREAM_DEMO_URL,
    demoVideoUrl: ZEEROSTREAM_DEMO_VIDEO_URL,
    manifestUrl: ZEEROSTREAM_MANIFEST_URL,
    poolEventPolicy: "accepted finality, successful execution, and at least one reviewed-pool event",
    cards: ZEEROSTREAM_DEMO_RECEIPTS.map((receipt) => ({
      ...receipt,
      status: "verified-mainnet",
      visibleFields: receipt.role === "Private payment"
        ? ["transaction hash", "pool event", "finality", "timing"]
        : ["transaction hash", "pool event", "finality", "timing", "depositor", "deposit amount"],
      hiddenFields: receipt.role === "Private payment"
        ? ["sender", "recipient", "amount", "spent notes", "memo plaintext"]
        : ["private note secrets", "memo plaintext", "later private transfer relationship"],
    })),
  };
}

export async function createAccessDisclosurePass(input: AccessPassInput): Promise<AccessDisclosurePass> {
  const room = buildCreatorReceiptRoom();
  if (!room.cards.some((card) => normalizeTransactionHash(card.hash) === normalizeTransactionHash(input.receiptHash))) {
    throw new Error("ACCESS_PASS_UNKNOWN_RECEIPT");
  }
  if (!input.audience.trim() || input.expiresAt <= input.issuedAt) throw new Error("ACCESS_PASS_INVALID");
  assertNoPrivateMaterial(input.audience);
  const disclosureDigest = await digest([
    "ZEEROSTREAM_ACCESS_DISCLOSURE_V1",
    normalizeTransactionHash(input.receiptHash),
    input.tier,
    input.audience.trim(),
    input.issuedAt.toString(),
    input.expiresAt.toString(),
  ].join(":"));
  return {
    version: 1,
    tier: input.tier,
    audience: input.audience.trim(),
    receiptHash: normalizeTransactionHash(input.receiptHash),
    disclosureDigest,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    visibleFields: ["tier", "creator page", "expiry", "receipt binding"],
    hiddenFields: ["wallet address", "wallet history", "private notes", "memo plaintext", "proof witness"],
  };
}

export function assertPublicReceiptRoomRecord(record: unknown): void {
  const serialized = JSON.stringify(record);
  if (!serialized || PRIVATE_FIELD_PATTERN.test(serialized)) throw new Error("RECEIPT_ROOM_PRIVATE_MATERIAL");
}

function assertNoPrivateMaterial(value: string): void {
  if (PRIVATE_FIELD_PATTERN.test(value)) throw new Error("RECEIPT_ROOM_PRIVATE_MATERIAL");
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
