import assert from "node:assert/strict";
import test from "node:test";
import {
  STRK20_OBSERVED_SEPOLIA_CLASS_HASH,
  STRK20_MAINNET_REVIEW_TARGET,
  STRK20_REVIEWED_RC0_CLASS_HASH,
  STRK20_SEPOLIA_POOL_ADDRESS,
  buildPrivateDepositActions,
  buildWinnerClaimActions,
  preparePrivateDeposit,
  preparePrivateDepositForReview,
  prepareMainnetPrivateDepositForReview,
  prepareWinnerClaimForReview,
  submitPreparedActions,
  supportsWalletApiVersions,
  verifyReviewedSepoliaPool,
  type EscrowDepositInput,
  type GigstarkPassportProofCalldata,
  type StarknetEscrowProvider,
  type StarknetPoolProvider,
  type Strk20WalletAccount,
} from "../src/lib/strk20-wallet";

const pool = {
  address: STRK20_SEPOLIA_POOL_ADDRESS,
  classHash: STRK20_REVIEWED_RC0_CLASS_HASH,
};

const deposit = (): EscrowDepositInput => ({
  pool,
  escrowAddress: "0x123",
  token: "0x456",
  amount: 100n,
  escrowId: "0x789",
  buyerCommitment: "0xabc",
  sellerCommitment: "0xdef",
  deadline: 2_000,
});

const DEFAULT_ESCROW_RECORD = [
  "0xabc", "0xdef", "0x777", "0x456", "0x64", "0x800", "0x4", "0x0", "0x0", "0x3",
];

const provider = (
  classHash: string = STRK20_REVIEWED_RC0_CLASS_HASH,
  escrowRecord: readonly string[] = DEFAULT_ESCROW_RECORD,
): StarknetEscrowProvider => ({
  async getChainId() {
    return "SN_SEPOLIA";
  },
  async getClassHashAt(address, blockIdentifier) {
    assert.equal(address, STRK20_SEPOLIA_POOL_ADDRESS);
    assert.equal(blockIdentifier, "latest");
    return classHash;
  },
  async callContract(call, blockIdentifier) {
    assert.equal(call.contractAddress, "0x123");
    assert.equal(call.entrypoint, "get_escrow");
    assert.deepEqual(call.calldata, ["0x789"]);
    assert.equal(blockIdentifier, "latest");
    return escrowRecord;
  },
});

const mainnetProvider = (
  classHash: string = STRK20_MAINNET_REVIEW_TARGET.classHash,
): StarknetPoolProvider => ({
  async getChainId() {
    return "SN_MAIN";
  },
  async getClassHashAt(address, blockIdentifier) {
    assert.equal(address, STRK20_MAINNET_REVIEW_TARGET.address);
    assert.equal(blockIdentifier, "latest");
    return classHash;
  },
});

const proof = (): GigstarkPassportProofCalldata => ({
  policyId: "0x1",
  audience: "0x123",
  purpose: 1,
  credentialClass: "0x2",
  scopeNullifier: "0x3",
  proofCommitment: "0x4",
  issuedAt: 1_900,
  expiresAt: 1_950,
  signatureR: "0x5",
  signatureS: "0x6",
});

const claim = () => ({
  escrowAddress: "0x123",
  token: "0x456",
  recipient: "0x999",
  escrowId: "0x789",
  winnerRole: "seller" as const,
  proof: proof(),
});

test("detects only Wallet API 0.10.3 or newer without a balance probe", () => {
  assert.equal(supportsWalletApiVersions(["0.10.2"]), false);
  assert.equal(supportsWalletApiVersions(["0.10.3"]), true);
  assert.equal(supportsWalletApiVersions(["0.10.4-rc.1"]), true);
});

test("private escrow deposit withdraws to the helper before invoking it", () => {
  const actions = buildPrivateDepositActions(deposit());
  assert.equal(actions.length, 2);
  assert.equal(actions[0]?.type, "withdraw");
  assert.equal(actions[1]?.type, "invoke");
  if (actions[1]?.type !== "invoke") assert.fail("expected invoke action");
  assert.equal(actions[1].contract, "0x123");
  assert.equal(actions[1].calldata.length, 20);
});

test("winner claim opens exactly one note and passes its placeholder to the helper", () => {
  const actions = buildWinnerClaimActions({
    pool,
    escrowAddress: "0x123",
    token: "0x456",
    recipient: "0x999",
    escrowId: "0x789",
    winnerRole: "seller",
    proof: proof(),
  });
  assert.equal(actions.length, 2);
  assert.deepEqual(actions[0], {
    type: "transfer",
    token: "0x456",
    amount: "OPEN",
    recipient: "0x999",
  });
  if (actions[1]?.type !== "invoke") assert.fail("expected invoke action");
  assert.equal(actions[1].calldata[9], "${openNoteIds[0]}");
  assert.equal(actions[1].calldata.length, 20);
});

test("current unmapped Sepolia pool class fails closed", () => {
  assert.throws(
    () =>
      buildPrivateDepositActions({
        ...deposit(),
        pool: { address: STRK20_SEPOLIA_POOL_ADDRESS, classHash: STRK20_OBSERVED_SEPOLIA_CLASS_HASH },
      }),
    /STRK20_POOL_CLASS_UNREVIEWED/,
  );
});

test("runtime pool verification rejects wrong chain and the observed unmapped class", async () => {
  await assert.rejects(
    verifyReviewedSepoliaPool({
      ...provider(),
      async getChainId() {
        return "SN_MAIN";
      },
    }),
    /STRK20_WRONG_CHAIN/,
  );
  await assert.rejects(
    verifyReviewedSepoliaPool(provider(STRK20_OBSERVED_SEPOLIA_CLASS_HASH)),
    /STRK20_POOL_CLASS_UNREVIEWED/,
  );
});

test("preparation simulates without balances or submission and submission stays explicit", async () => {
  const calls: string[] = [];
  const account: Strk20WalletAccount = {
    async strk20PrepareInvoke(actions, simulate) {
      calls.push(`prepare:${actions.length}:${String(simulate)}`);
      return { call: "prepared" };
    },
    async strk20InvokeTransaction(actions) {
      calls.push(`submit:${actions.length}`);
      return { transaction_hash: "0xfeed" };
    },
  };
  const { pool: _pool, ...depositInput } = deposit();
  await preparePrivateDeposit(account, provider(), depositInput);
  assert.deepEqual(calls, ["prepare:2:true"]);
  const reviewedActions = await preparePrivateDepositForReview(
    account,
    provider(),
    depositInput,
  );
  assert.equal(reviewedActions.length, 2);
  assert.equal(reviewedActions[0]?.type, "withdraw");
  assert.deepEqual(calls, ["prepare:2:true", "prepare:2:true"]);
  const result = await submitPreparedActions(
    account,
    provider(),
    reviewedActions,
  );
  assert.equal(result.transaction_hash, "0xfeed");
  assert.deepEqual(calls, ["prepare:2:true", "prepare:2:true", "submit:2"]);

  const claimReview = await prepareWinnerClaimForReview(account, provider(), claim());
  const claimActions = claimReview.actions;
  assert.equal(claimReview.publicAmount, "100");
  assert.equal(claimActions.length, 2);
  assert.deepEqual(claimActions[0], {
    type: "transfer",
    token: "0x456",
    amount: "OPEN",
    recipient: "0x999",
  });
  assert.deepEqual(calls, [
    "prepare:2:true",
    "prepare:2:true",
    "submit:2",
    "prepare:2:true",
  ]);
});

test("preparation never reaches the wallet when the live class is unreviewed", async () => {
  let prepared = false;
  const account: Strk20WalletAccount = {
    async strk20PrepareInvoke() {
      prepared = true;
      return {};
    },
    async strk20InvokeTransaction() {
      throw new Error("NOT_EXPECTED");
    },
  };
  const { pool: _pool, ...depositInput } = deposit();
  await assert.rejects(
    preparePrivateDepositForReview(
      account,
      provider(STRK20_OBSERVED_SEPOLIA_CLASS_HASH),
      depositInput,
    ),
    /STRK20_POOL_CLASS_UNREVIEWED/,
  );
  assert.equal(prepared, false);
  await assert.rejects(
    prepareWinnerClaimForReview(
      account,
      provider(STRK20_OBSERVED_SEPOLIA_CLASS_HASH),
      claim(),
    ),
    /STRK20_POOL_CLASS_UNREVIEWED/,
  );
  assert.equal(prepared, false);
});

test("Mainnet preparation dry-runs against V2 while submission remains disabled", async () => {
  const calls: string[] = [];
  const account: Strk20WalletAccount = {
    async strk20PrepareInvoke(actions, simulate) {
      calls.push(`prepare:${actions.length}:${String(simulate)}`);
      return {};
    },
    async strk20InvokeTransaction() {
      calls.push("submit");
      return { transaction_hash: "0xfeed" };
    },
  };
  const { pool: _pool, ...depositInput } = deposit();
  const actions = await prepareMainnetPrivateDepositForReview(
    account,
    mainnetProvider(),
    depositInput,
  );
  assert.equal(actions.length, 2);
  assert.deepEqual(calls, ["prepare:2:true"]);

  await assert.rejects(
    submitPreparedActions(account, mainnetProvider(), actions),
    /STRK20_WRONG_CHAIN/,
  );
  assert.deepEqual(calls, ["prepare:2:true"]);
});

test("Mainnet preparation fails before the wallet when the live class changes", async () => {
  let prepared = false;
  const account: Strk20WalletAccount = {
    async strk20PrepareInvoke() {
      prepared = true;
      return {};
    },
    async strk20InvokeTransaction() {
      throw new Error("NOT_EXPECTED");
    },
  };
  const { pool: _pool, ...depositInput } = deposit();
  await assert.rejects(
    prepareMainnetPrivateDepositForReview(account, mainnetProvider("0x123"), depositInput),
    /STRK20_POOL_CLASS_UNREVIEWED/,
  );
  assert.equal(prepared, false);
});

test("Mainnet preparation reports a Mainnet-specific wrong-chain gate", async () => {
  const account: Strk20WalletAccount = {
    async strk20PrepareInvoke() {
      throw new Error("NOT_EXPECTED");
    },
    async strk20InvokeTransaction() {
      throw new Error("NOT_EXPECTED");
    },
  };
  const { pool: _pool, ...depositInput } = deposit();
  await assert.rejects(
    prepareMainnetPrivateDepositForReview(
      account,
      { ...mainnetProvider(), async getChainId() { return "SN_SEPOLIA"; } },
      depositInput,
    ),
    /STRK20_WRONG_MAINNET_CHAIN/,
  );
});

test("winner-note review rejects mismatched or consumed escrow state before the wallet", async () => {
  let prepared = false;
  const account: Strk20WalletAccount = {
    async strk20PrepareInvoke() {
      prepared = true;
      return {};
    },
    async strk20InvokeTransaction() {
      throw new Error("NOT_EXPECTED");
    },
  };
  const tokenMismatch = [...DEFAULT_ESCROW_RECORD];
  tokenMismatch[3] = "0x999";
  await assert.rejects(
    prepareWinnerClaimForReview(account, provider(undefined, tokenMismatch), claim()),
    /ESCROW_TOKEN_MISMATCH/,
  );
  const winnerMismatch = [...DEFAULT_ESCROW_RECORD];
  winnerMismatch[6] = "0x5";
  await assert.rejects(
    prepareWinnerClaimForReview(account, provider(undefined, winnerMismatch), claim()),
    /ESCROW_WINNER_MISMATCH/,
  );
  const alreadyClaimed = [...DEFAULT_ESCROW_RECORD];
  alreadyClaimed[7] = "0x1";
  await assert.rejects(
    prepareWinnerClaimForReview(account, provider(undefined, alreadyClaimed), claim()),
    /ESCROW_ALREADY_CLAIMED/,
  );
  assert.equal(prepared, false);
});

test("malformed and overflowing public fields are rejected before wallet preparation", () => {
  assert.throws(
    () => buildPrivateDepositActions({ ...deposit(), amount: 1n << 128n }),
    /INVALID_DEPOSIT_AMOUNT/,
  );
  assert.throws(
    () => buildPrivateDepositActions({ ...deposit(), escrowAddress: "not-a-felt" }),
    /INVALID_ESCROW_ADDRESS/,
  );
  assert.throws(
    () => buildPrivateDepositActions({ ...deposit(), deadline: 1n << 64n }),
    /INVALID_DEADLINE/,
  );
  assert.throws(
    () =>
      buildWinnerClaimActions({
        pool,
        escrowAddress: "0x123",
        token: "0x456",
        recipient: "0x999",
        escrowId: "0x789",
        winnerRole: "seller",
        proof: { ...proof(), purpose: 256 },
      }),
    /INVALID_PROOF_PURPOSE/,
  );
  assert.throws(
    () =>
      buildWinnerClaimActions({
        pool,
        escrowAddress: "0x123",
        token: "0x456",
        recipient: "0x999",
        escrowId: "0x789",
        winnerRole: "seller",
        proof: { ...proof(), expiresAt: 1_800 },
      }),
    /INVALID_PROOF_TIME_RANGE/,
  );
});
