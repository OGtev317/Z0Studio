import assert from "node:assert/strict";
import test from "node:test";
import {
  STARKNET_MAINNET_WALLET_CHAIN,
  STARKNET_SEPOLIA_WALLET_CHAIN,
  requireMainnetWalletAccount,
  requireMainnetWalletChain,
  requireSepoliaWalletAccount,
  walletFlowErrorMessage,
  walletReviewControls,
} from "../src/lib/wallet-review";

test("wallet readiness accepts only a connected Starknet Mainnet account", () => {
  assert.equal(
    requireMainnetWalletAccount([
      { address: "0x456", chains: [STARKNET_MAINNET_WALLET_CHAIN] },
    ]).address,
    "0x456",
  );
  assert.equal(
    requireMainnetWalletAccount([
      { address: "0x456", chains: ["starknet:SN_MAIN"] },
    ]).address,
    "0x456",
  );
  assert.throws(
    () =>
      requireMainnetWalletAccount([
        { address: "0x456", chains: [STARKNET_SEPOLIA_WALLET_CHAIN] },
      ]),
    /WALLET_WRONG_MAINNET_CHAIN/,
  );
  assert.throws(() => requireMainnetWalletAccount([]), /WALLET_CONNECTION_REJECTED/);
  assert.equal(requireMainnetWalletChain("0x534e5f4d41494e"), "0x534e5f4d41494e");
  assert.equal(requireMainnetWalletChain("SN_MAIN"), "SN_MAIN");
  assert.throws(() => requireMainnetWalletChain("SN_SEPOLIA"), /WALLET_WRONG_MAINNET_CHAIN/);
});

test("wallet review accepts only a connected Starknet Sepolia account", () => {
  assert.equal(
    requireSepoliaWalletAccount([
      { address: "0x123", chains: [STARKNET_SEPOLIA_WALLET_CHAIN] },
    ]).address,
    "0x123",
  );
  assert.throws(
    () =>
      requireSepoliaWalletAccount([
        { address: "0x123", chains: ["starknet:0x534e5f4d41494e"] },
      ]),
    /WALLET_WRONG_CHAIN/,
  );
  assert.throws(() => requireSepoliaWalletAccount([]), /WALLET_CONNECTION_REJECTED/);
});

test("wrong-chain UI message is specific and confirms preparation stopped", () => {
  assert.equal(
    walletFlowErrorMessage(new Error("WALLET_WRONG_MAINNET_CHAIN")),
    "The connected wallet account is not on Starknet Mainnet. Switch networks and reconnect.",
  );
  assert.equal(
    walletFlowErrorMessage(new Error("WALLET_WRONG_CHAIN")),
    "The connected wallet account is not on Starknet Sepolia. Switch networks and reconnect.",
  );
  assert.equal(
    walletFlowErrorMessage(new Error("STRK20_WRONG_CHAIN")),
    "The configured RPC is not Starknet Sepolia. Preparation stopped before the wallet request.",
  );
  assert.equal(
    walletFlowErrorMessage(new Error("STRK20_WRONG_MAINNET_CHAIN")),
    "The configured RPC is not Starknet Mainnet. Preparation stopped before the wallet request.",
  );
});

test("wallet rejection UI does not imply that a transaction was submitted", () => {
  assert.equal(
    walletFlowErrorMessage({ code: 4001, message: "User rejected" }),
    "The wallet request was rejected. Nothing was submitted.",
  );
  assert.equal(
    walletFlowErrorMessage(new Error("User declined the request")),
    "The wallet request was rejected. Nothing was submitted.",
  );
  assert.equal(
    walletFlowErrorMessage({ message: "Request rejected by user" }),
    "The wallet request was rejected. Nothing was submitted.",
  );
});

test("winner-state mismatch UI confirms that no claim was submitted", () => {
  assert.equal(
    walletFlowErrorMessage(new Error("ESCROW_WINNER_MISMATCH")),
    "The onchain escrow token, winner, amount, or claim state does not match this review. Nothing was submitted.",
  );
});

test("submission stays disabled until dry-run preparation and acknowledgement", () => {
  assert.deepEqual(walletReviewControls("connected", false), {
    canPrepare: true,
    canSubmit: false,
  });
  assert.deepEqual(walletReviewControls("prepared", false), {
    canPrepare: false,
    canSubmit: false,
  });
  assert.deepEqual(walletReviewControls("prepared", true), {
    canPrepare: false,
    canSubmit: true,
  });
  assert.deepEqual(walletReviewControls("submitting", true), {
    canPrepare: false,
    canSubmit: false,
  });
});
