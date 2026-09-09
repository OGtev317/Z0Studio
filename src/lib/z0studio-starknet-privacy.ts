export type PrivacyPaymentMode = "room-entry" | "locked-drop" | "creator-tip";

export type PrivacyPaymentIntentInput = {
  creatorHandle: string;
  roomId: string;
  mode: PrivacyPaymentMode;
  amount: string;
  recipient: string;
};

export type PrivacyPaymentIntent = {
  id: string;
  creatorHandle: string;
  roomId: string;
  mode: PrivacyPaymentMode;
  amount: string;
  recipient: string;
  status: "local-review-only";
  requiredAction: "shield-first" | "private-transfer";
};

export const z0StudioPrivacyPaymentSteps = [
  {
    id: "shield",
    title: "Shield funds first",
    body: "A deposit into the STRK20 pool is public. Z0Studio separates this step from room entry to reduce payment-linkage risk.",
  },
  {
    id: "mature",
    title: "Wait for note maturity",
    body: "The wallet checks note readiness before private spend preparation. Z0Studio does not read private balances or note material.",
  },
  {
    id: "transfer",
    title: "Pay creator privately",
    body: "The wallet prepares one exact STRK20 private transfer to the creator recipient and keeps viewing keys, notes, and proofs inside the wallet.",
  },
  {
    id: "pass",
    title: "Create Z0Pass access",
    body: "A verified receipt binding can unlock the room or paid drop without exposing the full creator-user relationship graph.",
  },
] as const;

export const z0StudioPrivacyPaymentBoundaries = [
  "STRK20 Wallet API is the primary Z0Studio checkout lane.",
  "No thirdweb checkout is required for shielded privacy payments.",
  "Wallets hold signing keys, viewing keys, private notes, and proof material.",
  "Deposits, withdrawals, open-note amounts, timing, and app-side actions can still be public.",
  "This setup does not submit transactions until the user explicitly reviews and signs in a compatible wallet.",
] as const;

export function createPrivacyPaymentIntent(input: PrivacyPaymentIntentInput): PrivacyPaymentIntent {
  const creatorHandle = cleanHandle(input.creatorHandle);
  const roomId = cleanId(input.roomId);
  const amount = cleanAmount(input.amount);
  const recipient = cleanRecipient(input.recipient);
  const mode = isPrivacyPaymentMode(input.mode) ? input.mode : "room-entry";
  assertNoPrivateMaterial(`${creatorHandle} ${roomId} ${amount} ${recipient}`);

  return {
    id: `privacy-intent-${hashText(`${creatorHandle}:${roomId}:${mode}:${amount}:${recipient}`)}`,
    creatorHandle,
    roomId,
    mode,
    amount,
    recipient,
    status: "local-review-only",
    requiredAction: mode === "creator-tip" ? "private-transfer" : "shield-first",
  };
}

function isPrivacyPaymentMode(value: string): value is PrivacyPaymentMode {
  return value === "room-entry" || value === "locked-drop" || value === "creator-tip";
}

function cleanHandle(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(cleaned)) throw new Error("PRIVACY_PAYMENT_HANDLE_INVALID");
  return cleaned;
}

function cleanId(value: string): string {
  const cleaned = value.replace(/\s+/g, "-").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(cleaned)) throw new Error("PRIVACY_PAYMENT_ROOM_INVALID");
  return cleaned;
}

function cleanAmount(value: string): string {
  const cleaned = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(cleaned) || cleaned === "0") {
    throw new Error("PRIVACY_PAYMENT_AMOUNT_INVALID");
  }
  return cleaned;
}

function cleanRecipient(value: string): string {
  const cleaned = value.trim();
  if (cleaned.toLowerCase().endsWith(".stark")) return cleaned.toLowerCase();
  if (/^0x[0-9a-fA-F]{1,64}$/.test(cleaned) && BigInt(cleaned) > 0n) {
    return `0x${BigInt(cleaned).toString(16)}`;
  }
  throw new Error("PRIVACY_PAYMENT_RECIPIENT_INVALID");
}

function assertNoPrivateMaterial(value: string): void {
  if (/(private[_-]?key|seed phrase|mnemonic|viewing[_-]?key|witness|memo plaintext|note secret|secret)/i.test(value)) {
    throw new Error("PRIVACY_PAYMENT_PRIVATE_MATERIAL");
  }
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
