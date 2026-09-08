export type GigstarkProfile = {
  id: string;
  handle: string;
  displayName: string;
  role: "buyer" | "creator" | "both";
  starkName?: string;
  bio?: string;
};

export type Gig = {
  id: string;
  creatorId: string;
  title: string;
  category: string;
  description: string;
  price: bigint;
  status: "open" | "paused";
};

export type Proposal = {
  id: string;
  gigId: string;
  buyerId: string;
  message: string;
  status: "pending" | "accepted" | "declined";
};

export type Order = {
  id: string;
  gigId: string;
  proposalId: string;
  buyerId: string;
  creatorId: string;
  amount: bigint;
  status: "awaiting_payment" | "funded" | "delivered" | "settled" | "refunded";
  deliveryCommitment?: string;
  receiptId?: string;
};

export type PaymentReceipt = {
  id: string;
  orderId: string;
  kind: "deposit_reviewed" | "seller_claim" | "refund" | "subscription";
  amount: bigint;
  status: "local_record" | "wallet_submitted";
  transactionHash?: string;
};

export type TierFeedPost = {
  id: string;
  creatorId: string;
  tier: "supporter" | "patron" | "studio";
  body: string;
};

export type MarketplaceState = {
  profiles: GigstarkProfile[];
  gigs: Gig[];
  proposals: Proposal[];
  orders: Order[];
  receipts: PaymentReceipt[];
  feed: TierFeedPost[];
};

export const EMPTY_MARKETPLACE: MarketplaceState = {
  profiles: [], gigs: [], proposals: [], orders: [], receipts: [], feed: [],
};

function requireText(value: string, code: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(code);
  return trimmed;
}

function uniqueId(value: string, label: string): string {
  const id = requireText(value, `${label}_ID_REQUIRED`);
  return id;
}

export function upsertProfile(state: MarketplaceState, profile: GigstarkProfile): MarketplaceState {
  const next = { ...profile, id: uniqueId(profile.id, "PROFILE"), handle: requireText(profile.handle, "PROFILE_HANDLE_REQUIRED"), displayName: requireText(profile.displayName, "PROFILE_NAME_REQUIRED") };
  const profiles = state.profiles.some(({ id }) => id === next.id)
    ? state.profiles.map((entry) => entry.id === next.id ? next : entry)
    : [...state.profiles, next];
  return { ...state, profiles };
}

export function createGig(state: MarketplaceState, gig: Gig): MarketplaceState {
  if (!state.profiles.some(({ id }) => id === gig.creatorId)) throw new Error("CREATOR_PROFILE_REQUIRED");
  if (gig.price <= 0n) throw new Error("GIG_PRICE_REQUIRED");
  const next = { ...gig, id: uniqueId(gig.id, "GIG"), title: requireText(gig.title, "GIG_TITLE_REQUIRED"), category: requireText(gig.category, "GIG_CATEGORY_REQUIRED"), description: requireText(gig.description, "GIG_DESCRIPTION_REQUIRED") };
  return { ...state, gigs: [...state.gigs, next] };
}

export function submitProposal(state: MarketplaceState, proposal: Proposal): MarketplaceState {
  const gig = state.gigs.find(({ id }) => id === proposal.gigId);
  if (!gig || gig.status !== "open") throw new Error("GIG_NOT_OPEN");
  if (!state.profiles.some(({ id }) => id === proposal.buyerId)) throw new Error("BUYER_PROFILE_REQUIRED");
  if (proposal.buyerId === gig.creatorId) throw new Error("SELF_PROPOSAL_FORBIDDEN");
  const next = { ...proposal, id: uniqueId(proposal.id, "PROPOSAL"), message: requireText(proposal.message, "PROPOSAL_MESSAGE_REQUIRED"), status: "pending" as const };
  return { ...state, proposals: [...state.proposals, next] };
}

export function acceptProposal(state: MarketplaceState, proposalId: string, orderId: string): MarketplaceState {
  const proposal = state.proposals.find(({ id }) => id === proposalId);
  if (!proposal || proposal.status !== "pending") throw new Error("PROPOSAL_NOT_ACCEPTABLE");
  const gig = state.gigs.find(({ id }) => id === proposal.gigId);
  if (!gig || gig.status !== "open") throw new Error("GIG_NOT_OPEN");
  const order: Order = { id: uniqueId(orderId, "ORDER"), gigId: gig.id, proposalId: proposal.id, buyerId: proposal.buyerId, creatorId: gig.creatorId, amount: gig.price, status: "awaiting_payment" };
  return { ...state, proposals: state.proposals.map((entry) => entry.id === proposal.id ? { ...entry, status: "accepted" } : entry), orders: [...state.orders, order] };
}

export function fundOrder(state: MarketplaceState, orderId: string, receiptId: string): MarketplaceState {
  const order = state.orders.find(({ id }) => id === orderId);
  if (!order || order.status !== "awaiting_payment") throw new Error("ORDER_NOT_FUNDABLE");
  const receipt: PaymentReceipt = { id: uniqueId(receiptId, "RECEIPT"), orderId, kind: "deposit_reviewed", amount: order.amount, status: "local_record" };
  return { ...state, orders: state.orders.map((entry) => entry.id === orderId ? { ...entry, status: "funded", receiptId: receipt.id } : entry), receipts: [...state.receipts, receipt] };
}

export function recordDelivery(state: MarketplaceState, orderId: string, deliveryCommitment: string): MarketplaceState {
  const commitment = requireText(deliveryCommitment, "DELIVERY_COMMITMENT_REQUIRED");
  const order = state.orders.find(({ id }) => id === orderId);
  if (!order || order.status !== "funded") throw new Error("ORDER_NOT_DELIVERABLE");
  return { ...state, orders: state.orders.map((entry) => entry.id === orderId ? { ...entry, status: "delivered", deliveryCommitment: commitment } : entry) };
}

export function settleOrder(state: MarketplaceState, orderId: string, kind: "seller_claim" | "refund", receiptId: string): MarketplaceState {
  const order = state.orders.find(({ id }) => id === orderId);
  if (!order || order.status !== "delivered") throw new Error("ORDER_NOT_SETTLEABLE");
  const receipt: PaymentReceipt = { id: uniqueId(receiptId, "RECEIPT"), orderId, kind, amount: order.amount, status: "local_record" };
  return { ...state, orders: state.orders.map((entry) => entry.id === orderId ? { ...entry, status: kind === "seller_claim" ? "settled" : "refunded", receiptId: receipt.id } : entry), receipts: [...state.receipts, receipt] };
}

export function reputationFor(state: MarketplaceState, profileId: string): { completed: number; refunded: number; score: number } {
  const relevant = state.orders.filter((order) => order.buyerId === profileId || order.creatorId === profileId);
  const completed = relevant.filter(({ status }) => status === "settled").length;
  const refunded = relevant.filter(({ status }) => status === "refunded").length;
  return { completed, refunded, score: Math.max(0, completed * 100 - refunded * 25) };
}

export function appendFeedPost(state: MarketplaceState, post: TierFeedPost): MarketplaceState {
  if (!state.profiles.some(({ id }) => id === post.creatorId)) throw new Error("CREATOR_PROFILE_REQUIRED");
  const next = { ...post, id: uniqueId(post.id, "POST"), body: requireText(post.body, "POST_BODY_REQUIRED") };
  return { ...state, feed: [next, ...state.feed] };
}
