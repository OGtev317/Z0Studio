import type { MarketplaceState } from "./marketplace";
import type { Subscription } from "./subscription";

export const LOCAL_WORKSPACE_BACKUP_VERSION = 1;

type EncodedMarketplace = Omit<MarketplaceState, "gigs" | "orders" | "receipts"> & {
  gigs: Array<Omit<MarketplaceState["gigs"][number], "price"> & { price: string }>;
  orders: Array<Omit<MarketplaceState["orders"][number], "amount"> & { amount: string }>;
  receipts: Array<Omit<MarketplaceState["receipts"][number], "amount"> & { amount: string }>;
};

export type LocalWorkspaceBackup = {
  version: typeof LOCAL_WORKSPACE_BACKUP_VERSION;
  marketplace: EncodedMarketplace;
  subscriptions: Subscription[];
};

export function encodeMarketplace(state: MarketplaceState): EncodedMarketplace {
  return {
    ...state,
    gigs: state.gigs.map((gig) => ({ ...gig, price: gig.price.toString() })),
    orders: state.orders.map((order) => ({ ...order, amount: order.amount.toString() })),
    receipts: state.receipts.map((receipt) => ({ ...receipt, amount: receipt.amount.toString() })),
  };
}

export function decodeMarketplace(value: unknown): MarketplaceState {
  const record = requireRecord(value, "INVALID_MARKETPLACE_BACKUP");
  const profiles = requireArray(record.profiles, "INVALID_MARKETPLACE_BACKUP");
  const gigs = requireArray(record.gigs, "INVALID_MARKETPLACE_BACKUP").map((gig) => ({ ...requireRecord(gig, "INVALID_MARKETPLACE_BACKUP"), price: requirePositiveBigInt(requireRecord(gig, "INVALID_MARKETPLACE_BACKUP").price) }));
  const proposals = requireArray(record.proposals, "INVALID_MARKETPLACE_BACKUP");
  const orders = requireArray(record.orders, "INVALID_MARKETPLACE_BACKUP").map((order) => ({ ...requireRecord(order, "INVALID_MARKETPLACE_BACKUP"), amount: requirePositiveBigInt(requireRecord(order, "INVALID_MARKETPLACE_BACKUP").amount) }));
  const receipts = requireArray(record.receipts, "INVALID_MARKETPLACE_BACKUP").map((receipt) => ({ ...requireRecord(receipt, "INVALID_MARKETPLACE_BACKUP"), amount: requirePositiveBigInt(requireRecord(receipt, "INVALID_MARKETPLACE_BACKUP").amount) }));
  const feed = requireArray(record.feed, "INVALID_MARKETPLACE_BACKUP");
  return { profiles: profiles as MarketplaceState["profiles"], gigs: gigs as MarketplaceState["gigs"], proposals: proposals as MarketplaceState["proposals"], orders: orders as MarketplaceState["orders"], receipts: receipts as MarketplaceState["receipts"], feed: feed as MarketplaceState["feed"] };
}

export function createLocalWorkspaceBackup(marketplace: MarketplaceState, subscriptions: Subscription[]): LocalWorkspaceBackup {
  return { version: LOCAL_WORKSPACE_BACKUP_VERSION, marketplace: encodeMarketplace(marketplace), subscriptions };
}

export function parseLocalWorkspaceBackup(text: string): { marketplace: MarketplaceState; subscriptions: Subscription[] } {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("INVALID_LOCAL_BACKUP_JSON"); }
  const record = requireRecord(value, "INVALID_LOCAL_BACKUP");
  if (record.version !== LOCAL_WORKSPACE_BACKUP_VERSION) throw new Error("UNSUPPORTED_LOCAL_BACKUP_VERSION");
  const subscriptions = requireArray(record.subscriptions, "INVALID_LOCAL_BACKUP").map(validateSubscription);
  return { marketplace: decodeMarketplace(record.marketplace), subscriptions };
}

function validateSubscription(value: unknown): Subscription {
  const record = requireRecord(value, "INVALID_LOCAL_BACKUP");
  if (typeof record.id !== "string" || typeof record.creatorCommitment !== "string" || typeof record.memberCommitment !== "string" || !Number.isInteger(record.periodEndsAt) || !Number.isInteger(record.prepaidPeriods) || !Number.isInteger(record.creatorClaimedPeriods) || !["active", "cancelled", "expired"].includes(String(record.state))) throw new Error("INVALID_LOCAL_BACKUP");
  return record as unknown as Subscription;
}

function requireRecord(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, code: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function requirePositiveBigInt(value: unknown): bigint {
  if (typeof value !== "string") throw new Error("INVALID_MARKETPLACE_BACKUP");
  try { const parsed = BigInt(value); if (parsed <= 0n) throw new Error(); return parsed; } catch { throw new Error("INVALID_MARKETPLACE_BACKUP"); }
}
