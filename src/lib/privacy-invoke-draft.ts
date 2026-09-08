import { STRK20_SEPOLIA_POOL } from "./strk20-sepolia";

export type OpenNoteDeposit = { noteId: string; token: string; amount: bigint };
export type EscrowOutcome = "seller" | "buyer";
export type ClaimState = { outcome: EscrowOutcome; sellerClaimed: boolean; buyerClaimed: boolean; token: string; amount: bigint };

const MAX_U128 = (1n << 128n) - 1n;

function parseNonZeroFelt(value: string): bigint | undefined {
  if (!/^0x[0-9a-f]+$/i.test(value)) return undefined;
  const parsed = BigInt(value);
  return parsed > 0n ? parsed : undefined;
}

/** Test-only model of the Cairo wrapper's mandatory checks. */
export function privacyInvokeClaim(caller: string, state: ClaimState, winner: EscrowOutcome, noteId: string): { next: ClaimState; deposit: OpenNoteDeposit } {
  if (parseNonZeroFelt(caller) !== BigInt(STRK20_SEPOLIA_POOL)) throw new Error("ONLY_PRIVACY_POOL");
  if (!parseNonZeroFelt(noteId) || !parseNonZeroFelt(state.token) || state.amount <= 0n || state.amount > MAX_U128) throw new Error("INVALID_OPEN_NOTE_DEPOSIT");
  if (state.outcome !== winner) throw new Error("CLAIM_NOT_AUTHORIZED");
  if ((winner === "seller" && state.sellerClaimed) || (winner === "buyer" && state.buyerClaimed)) throw new Error("DOUBLE_CLAIM");
  const next = winner === "seller" ? { ...state, sellerClaimed: true } : { ...state, buyerClaimed: true };
  return { next, deposit: { noteId, token: state.token, amount: state.amount } };
}
