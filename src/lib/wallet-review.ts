export const STARKNET_SEPOLIA_WALLET_CHAIN =
  "starknet:0x534e5f5345504f4c4941";
export const STARKNET_MAINNET_WALLET_CHAIN = "starknet:0x534e5f4d41494e";

export type WalletAccountDescriptor = {
  address: string;
  chains: readonly string[];
};

export type WalletReviewPhase =
  | "disconnected"
  | "connected"
  | "preparing"
  | "prepared"
  | "submitting"
  | "submitted"
  | "blocked";

export type WalletReviewControls = {
  canPrepare: boolean;
  canSubmit: boolean;
};

export function requireSepoliaWalletAccount(
  accounts: readonly WalletAccountDescriptor[],
): WalletAccountDescriptor {
  const account = accounts[0];
  if (!account) throw new Error("WALLET_CONNECTION_REJECTED");
  if (!account.chains.some(isSepoliaWalletChain)) {
    throw new Error("WALLET_WRONG_CHAIN");
  }
  return account;
}

export function requireMainnetWalletAccount(
  accounts: readonly WalletAccountDescriptor[],
): WalletAccountDescriptor {
  const account = accounts[0];
  if (!account) throw new Error("WALLET_CONNECTION_REJECTED");
  if (!account.chains.some(isMainnetWalletChain)) {
    throw new Error("WALLET_WRONG_MAINNET_CHAIN");
  }
  return account;
}

export function requireMainnetWalletChain(chainId: string): string {
  if (!isMainnetWalletChain(chainId.startsWith("starknet:") ? chainId : `starknet:${chainId}`)) {
    throw new Error("WALLET_WRONG_MAINNET_CHAIN");
  }
  return chainId;
}

export function walletReviewControls(
  phase: WalletReviewPhase,
  acknowledged: boolean,
): WalletReviewControls {
  return {
    canPrepare: phase === "connected" || phase === "blocked",
    canSubmit: phase === "prepared" && acknowledged,
  };
}

export function walletFlowErrorMessage(error: unknown): string {
  const code = errorCode(error);
  const message = errorMessage(error);

  if (code === 4001 || /reject|denied|declined|cancelled|canceled/i.test(message)) {
    return "The wallet request was rejected. Nothing was submitted.";
  }
  if (message.includes("WALLET_WRONG_CHAIN")) {
    return "The connected wallet account is not on Starknet Sepolia. Switch networks and reconnect.";
  }
  if (message.includes("WALLET_WRONG_MAINNET_CHAIN")) {
    return "The connected wallet account is not on Starknet Mainnet. Switch networks and reconnect.";
  }
  if (message.includes("STRK20_WRONG_CHAIN")) {
    return "The configured RPC is not Starknet Sepolia. Preparation stopped before the wallet request.";
  }
  if (message.includes("STRK20_WRONG_MAINNET_CHAIN")) {
    return "The configured RPC is not Starknet Mainnet. Preparation stopped before the wallet request.";
  }
  if (message.includes("STRK20_POOL_CLASS_UNREVIEWED")) {
    return "The live STRK20 pool class does not match the reviewed target. Preparation remains blocked.";
  }
  if (message.includes("STRK20_POOL_ADDRESS_MISMATCH")) {
    return "The STRK20 pool address does not match the reviewed network configuration.";
  }
  if (message.includes("ESCROW_")) {
    return "The onchain escrow token, winner, amount, or claim state does not match this review. Nothing was submitted.";
  }
  if (message.includes("WALLET_API_UNSUPPORTED")) {
    return "The selected wallet does not support the required STRK20 Wallet API version.";
  }
  if (message.includes("INVALID_")) {
    return `Review field rejected: ${message}.`;
  }
  return "The wallet flow could not continue. Nothing was submitted.";
}

function isSepoliaWalletChain(chain: string): boolean {
  const normalized = chain.toLowerCase();
  return (
    normalized === STARKNET_SEPOLIA_WALLET_CHAIN.toLowerCase() ||
    normalized === "starknet:sn_sepolia"
  );
}

function isMainnetWalletChain(chain: string): boolean {
  const normalized = chain.toLowerCase();
  return (
    normalized === STARKNET_MAINNET_WALLET_CHAIN.toLowerCase() ||
    normalized === "starknet:sn_main"
  );
}

function errorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}
