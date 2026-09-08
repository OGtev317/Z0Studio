export type EscrowStatus = "funded" | "delivered" | "settled" | "disputed" | "refunded";

export type Escrow = {
  id: string;
  buyerCommitment: string;
  sellerCommitment: string;
  amount: bigint;
  deliveryCommitment?: string;
  status: EscrowStatus;
  sellerClaimed: boolean;
  buyerClaimed: boolean;
};

export type Settlement = "seller" | "buyer";

export function createEscrow(input: Omit<Escrow, "status" | "sellerClaimed" | "buyerClaimed">): Escrow {
  if (input.amount <= 0n) throw new Error("ESCROW_AMOUNT_ZERO");
  if (!input.buyerCommitment || !input.sellerCommitment) throw new Error("ROLE_COMMITMENT_REQUIRED");
  return { ...input, status: "funded", sellerClaimed: false, buyerClaimed: false };
}

export function submitDelivery(escrow: Escrow, deliveryCommitment: string): Escrow {
  if (escrow.status !== "funded") throw new Error("DELIVERY_NOT_ALLOWED");
  if (!deliveryCommitment) throw new Error("DELIVERY_COMMITMENT_REQUIRED");
  return { ...escrow, deliveryCommitment, status: "delivered" };
}

export function settle(escrow: Escrow, winner: Settlement): Escrow {
  if (escrow.status !== "delivered" && escrow.status !== "disputed") throw new Error("SETTLEMENT_NOT_ALLOWED");
  return { ...escrow, status: winner === "seller" ? "settled" : "refunded" };
}

export function openDispute(escrow: Escrow): Escrow {
  if (escrow.status !== "funded" && escrow.status !== "delivered") throw new Error("DISPUTE_NOT_ALLOWED");
  return { ...escrow, status: "disputed" };
}

export function claimPrivateNote(escrow: Escrow, recipient: Settlement): Escrow {
  const sellerWins = escrow.status === "settled" && recipient === "seller";
  const buyerWins = escrow.status === "refunded" && recipient === "buyer";
  if (!sellerWins && !buyerWins) throw new Error("CLAIM_NOT_AUTHORIZED");
  if (recipient === "seller") {
    if (escrow.sellerClaimed) throw new Error("DOUBLE_CLAIM");
    return { ...escrow, sellerClaimed: true };
  }
  if (escrow.buyerClaimed) throw new Error("DOUBLE_CLAIM");
  return { ...escrow, buyerClaimed: true };
}
