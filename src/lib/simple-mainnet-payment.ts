import type { STRK20_ACTION } from "starknet";

export const STRK_MAINNET_TOKEN =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" as const;

export type PaymentOperation = "shield" | "pay" | "withdraw";

const PREPARATION_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_STRK_AMOUNT: "Enter a STRK amount greater than zero, using no more than 18 decimal places.",
  RECIPIENT_REQUIRED: "Enter the creator's .stark name or Starknet address.",
  INVALID_RECIPIENT: "Enter a valid Starknet recipient address.",
  STARK_NAME_NOT_FOUND: "That .stark name did not resolve on Starknet Mainnet.",
};

export function paymentPreparationErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return PREPARATION_ERROR_MESSAGES[code]
    ?? "The wallet could not prepare this action. Check the fields, wallet network, and note maturity, then try again.";
}

/**
 * A privacy wallet can require its first pool deposit to register the sender.
 * Registration changes pool state, so a simulated invoke may return this exact
 * error even though the subsequent wallet-controlled deposit is valid.
 */
export function isFirstShieldRegistrationRequired(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return /(?:^|[\s(])NOT_REGISTERED(?:\)|\s|$)/.test(message.trim());
}

export function parseStrkAmount(value: string): string {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(normalized)) {
    throw new Error("INVALID_STRK_AMOUNT");
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  const amount = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0") || "0");
  if (amount <= 0n || amount >= 1n << 128n) throw new Error("INVALID_STRK_AMOUNT");
  return `0x${amount.toString(16)}`;
}

export function formatStrkAmount(value: string): string {
  const amount = BigInt(value);
  const whole = amount / 10n ** 18n;
  const fraction = (amount % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function buildSimplePaymentActions(
  operation: PaymentOperation,
  amount: string,
  recipient?: string,
): STRK20_ACTION[] {
  const rawAmount = parseStrkAmount(amount);
  if (operation === "shield") {
    return [{ type: "deposit", token: STRK_MAINNET_TOKEN, amount: rawAmount }];
  }
  const target = requireAddress(recipient);
  if (operation === "pay") {
    return [{ type: "transfer", token: STRK_MAINNET_TOKEN, amount: rawAmount, recipient: target }];
  }
  return [{ type: "withdraw", token: STRK_MAINNET_TOKEN, amount: rawAmount, recipient: target }];
}

export function receiptTouchesPool(receipt: unknown, poolAddress: string): boolean {
  if (!receipt || typeof receipt !== "object") return false;
  const wrapper = receipt as Record<string, unknown>;
  const record = wrapper.value && typeof wrapper.value === "object"
    ? wrapper.value as Record<string, unknown>
    : wrapper;
  if (record.execution_status === "REVERTED") return false;
  if (record.execution_status !== "SUCCEEDED") return false;
  const events = Array.isArray(record.events) ? record.events : [];
  return events.some((event) => {
    if (!event || typeof event !== "object") return false;
    const from = (event as Record<string, unknown>).from_address;
    return typeof from === "string" && sameFelt(from, poolAddress);
  });
}

export function receiptQualifiesForSubmission(receipt: unknown, poolAddress: string): boolean {
  if (!receiptTouchesPool(receipt, poolAddress)) return false;
  const wrapper = receipt as Record<string, unknown>;
  const record = wrapper.value && typeof wrapper.value === "object"
    ? wrapper.value as Record<string, unknown>
    : wrapper;
  return record.finality_status === "ACCEPTED_ON_L1" || record.finality_status === "ACCEPTED_ON_L2";
}

export function updateTransactionHistory(history: readonly string[], candidate: string, limit = 12): string[] {
  const normalized = normalizeTransactionHash(candidate);
  const existing = history.flatMap((item) => {
    try { return [normalizeTransactionHash(item)]; } catch { return []; }
  });
  return [normalized, ...existing.filter((item) => item !== normalized)].slice(0, limit);
}

export function parseTransactionHistory(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.reduce<string[]>((history, item) => {
      if (typeof item !== "string") return history;
      try { return updateTransactionHistory(history, item); } catch { return history; }
    }, []).reverse();
  } catch {
    return [];
  }
}

function normalizeTransactionHash(value: string): string {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value) || BigInt(value) === 0n) {
    throw new Error("INVALID_TRANSACTION_HASH");
  }
  return `0x${BigInt(value).toString(16)}`;
}

function requireAddress(value?: string): string {
  if (!value) throw new Error("RECIPIENT_REQUIRED");
  try {
    const parsed = BigInt(value);
    if (parsed <= 0n || parsed >= 1n << 251n) throw new Error();
    return `0x${parsed.toString(16)}`;
  } catch {
    throw new Error("INVALID_RECIPIENT");
  }
}

function sameFelt(left: string, right: string): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}
