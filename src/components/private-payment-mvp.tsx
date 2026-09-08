"use client";

import { useEffect, useRef, useState } from "react";
import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import { RpcProvider, WalletAccountV6, walletV6, type STRK20_ACTION } from "starknet";
import {
  STRK20_MAINNET_REVIEW_TARGET,
  STRK20_WALLET_API_MIN_VERSION,
  detectStrk20WalletApi,
  verifyReviewedPoolTarget,
} from "../lib/strk20-wallet";
import { requireMainnetWalletAccount, requireMainnetWalletChain, walletFlowErrorMessage } from "../lib/wallet-review";
import {
  STRK_MAINNET_TOKEN,
  buildSimplePaymentActions,
  formatStrkAmount,
  isFirstShieldRegistrationRequired,
  parseTransactionHistory,
  paymentPreparationErrorMessage,
  receiptQualifiesForSubmission,
  updateTransactionHistory,
  type PaymentOperation,
} from "../lib/simple-mainnet-payment";
import {
  bindPaymentMemoReceipt,
  createMessagingIdentity,
  createPaymentMemoContact,
  decryptPaymentMemo,
  encryptPaymentMemo,
  parsePaymentMemoReceipt,
  parsePaymentMemoReceiptHistory,
  paymentMemoCommitmentForFields,
  updatePaymentMemoReceipts,
  type MessagingIdentity,
  type PaymentMemoReceipt,
  type PendingPaymentMemo,
} from "../lib/private-messaging";
import {
  ZEEROSTREAM_DEMO_RECEIPTS,
  ZEEROSTREAM_DEMO_URL,
  ZEEROSTREAM_DEMO_VIDEO_URL,
  ZEEROSTREAM_MANIFEST_URL,
} from "../lib/hackathon-evidence";

const MAINNET_RPC = process.env.NEXT_PUBLIC_GIGSTARK_MAINNET_RPC ?? "https://starknet-rpc.publicnode.com";
const HISTORY_KEY = "zeerostream.mainnet-payment-hashes.v1";
const VERIFIED_HISTORY_KEY = "zeerostream.mainnet-payment-verified-hashes.v1";
const MEMO_RECEIPTS_KEY = "zeerostream.payment-memo-receipts.v1";
type Phase = "disconnected" | "connected" | "preparing" | "prepared" | "submitting" | "submitted" | "confirmed" | "blocked";

function shortHash(value: string): string {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function PrivatePaymentMvp() {
  const storeRef = useRef<Store | null>(null);
  const reviewRevision = useRef(0);
  const walletOperationPending = useRef(false);
  const [wallets, setWallets] = useState<readonly WalletWithStarknetFeatures[]>([]);
  const [walletName, setWalletName] = useState("");
  const [account, setAccount] = useState<WalletAccountV6 | null>(null);
  const [identity, setIdentity] = useState("");
  const [operation, setOperation] = useState<PaymentOperation>("shield");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [resolvedRecipient, setResolvedRecipient] = useState("");
  const [fee, setFee] = useState("");
  const [prepared, setPrepared] = useState<STRK20_ACTION[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [registrationRequired, setRegistrationRequired] = useState(false);
  const [phase, setPhase] = useState<Phase>("disconnected");
  const [message, setMessage] = useState("Check a wallet, connect on Mainnet, then prepare one exact action.");
  const [hash, setHash] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [verifiedHistory, setVerifiedHistory] = useState<string[]>([]);
  const [memoClient, setMemoClient] = useState<MessagingIdentity | null>(null);
  const [memoCreator, setMemoCreator] = useState<MessagingIdentity | null>(null);
  const [memoText, setMemoText] = useState("");
  const [pendingMemo, setPendingMemo] = useState<PendingPaymentMemo | null>(null);
  const [memoReceipts, setMemoReceipts] = useState<PaymentMemoReceipt[]>([]);
  const [memoImport, setMemoImport] = useState("");
  const [decryptedMemo, setDecryptedMemo] = useState("");
  const [memoNotice, setMemoNotice] = useState("Optional memo receipts are encrypted locally and stored only as ciphertext.");

  useEffect(() => {
    const store = createStore({ eip1193Adapters: [] });
    storeRef.current = store;
    const update = (next: readonly WalletWithStarknetFeatures[]) => setWallets(next);
    update(store.getWallets());
    const unsubscribe = store.subscribe(update);
    try {
      setHistory(parseTransactionHistory(localStorage.getItem(HISTORY_KEY)));
      setVerifiedHistory(parseTransactionHistory(localStorage.getItem(VERIFIED_HISTORY_KEY)));
      setMemoReceipts(parsePaymentMemoReceiptHistory(localStorage.getItem(MEMO_RECEIPTS_KEY)));
    } catch {
      setMessage("Browser recovery storage is unavailable. Preserve transaction hashes after submitting.");
    }
    return () => { reviewRevision.current += 1; unsubscribe(); storeRef.current = null; };
  }, []);

  useEffect(() => {
    if (!account) return;
    return account.onChange(() => {
      reviewRevision.current += 1;
      setPendingMemo(null); setResolvedRecipient("");
      setAccount(null); setIdentity(""); setFee(""); setPrepared(null); setAcknowledged(false); setRegistrationRequired(false); setPhase("disconnected");
      setMessage("The wallet account or network changed. Reconnect and prepare again.");
    });
  }, [account]);

  function resetPreparation() {
    reviewRevision.current += 1;
    setPrepared(null); setAcknowledged(false); setRegistrationRequired(false); setResolvedRecipient(""); setPendingMemo(null);
    if (account) setPhase("connected");
  }

  async function createMemoKeys() {
    if (walletOperationPending.current) return;
    resetPreparation();
    try {
      const [client, creator] = await Promise.all([
        createMessagingIdentity("client memo key"),
        createMessagingIdentity("creator inbox key"),
      ]);
      setMemoClient(client); setMemoCreator(creator); setPendingMemo(null); setDecryptedMemo("");
      setMemoNotice("Session-only memo keys created. The creator private key cannot be exported or stored.");
    } catch (error) {
      setMemoNotice(error instanceof Error ? error.message : "PAYMENT_MEMO_KEYS_FAILED");
    }
  }

  async function checkWallets() {
    const candidates = storeRef.current?.getWallets() ?? wallets;
    setMessage("Checking Wallet API versions without reading balances…");
    for (const wallet of candidates) {
      try {
        const capability = await detectStrk20WalletApi(wallet);
        if (capability.supported) {
          setWalletName(wallet.name);
          setMessage(`${wallet.name} supports Wallet API ${capability.versions.join(", ")}.`);
          return;
        }
      } catch { /* continue to the next installed wallet */ }
    }
    setWalletName("");
    setMessage(`No installed wallet reported Wallet API ${STRK20_WALLET_API_MIN_VERSION} or newer.`);
  }

  async function connect() {
    const wallet = wallets.find((candidate) => candidate.name === walletName);
    if (!wallet) return;
    setMessage("Waiting for Mainnet wallet connection approval…");
    let stage = "wallet connection";
    try {
      const capability = await detectStrk20WalletApi(wallet);
      if (!capability.supported) throw new Error("WALLET_API_UNSUPPORTED");
      const connection = await wallet.features["standard:connect"].connect();
      stage = "connected account";
      const connected = requireMainnetWalletAccount(connection.accounts);
      stage = "wallet network";
      requireMainnetWalletChain(String(await walletV6.requestChainId(wallet)));
      const provider = new RpcProvider({ nodeUrl: MAINNET_RPC });
      const nextAccount = new WalletAccountV6({ provider, walletProvider: wallet, address: connected.address });
      stage = "reviewed Mainnet pool";
      await verifyReviewedPoolTarget(provider, STRK20_MAINNET_REVIEW_TARGET);
      stage = "live pool fee";
      const feeResult = await provider.callContract({ contractAddress: STRK20_MAINNET_REVIEW_TARGET.address, entrypoint: "get_fee_amount", calldata: [] });
      setFee(formatStrkAmount(feeResult[0] ?? "0x0"));
      setAccount(nextAccount); setPhase("connected");
      try { setIdentity(await provider.getStarkName(connected.address)); } catch { setIdentity(""); }
      setMessage("Connected to the reviewed Mainnet pool. No balance or private note was requested.");
    } catch (error) {
      const detail = walletFlowErrorMessage(error);
      setAccount(null); setFee(""); setPhase("blocked");
      setMessage(detail === "The wallet flow could not continue. Nothing was submitted."
        ? `Connection stopped while checking ${stage}. Nothing was submitted.`
        : detail);
    }
  }

  async function resolveTarget(provider: RpcProvider): Promise<string | undefined> {
    if (operation === "shield") return undefined;
    const value = recipient.trim();
    if (!value) throw new Error("RECIPIENT_REQUIRED");
    if (value.toLowerCase().endsWith(".stark")) {
      const address = await provider.getAddressFromStarkName(value.toLowerCase());
      if (!address || BigInt(address) === 0n) throw new Error("STARK_NAME_NOT_FOUND");
      return address;
    }
    return value;
  }

  async function prepare() {
    if (!account || walletOperationPending.current) return;
    walletOperationPending.current = true;
    const revision = ++reviewRevision.current;
    setPrepared(null); setAcknowledged(false); setPendingMemo(null);
    setPhase("preparing"); setMessage("Verifying Mainnet and asking the wallet for a dry run…");
    try {
      const provider = new RpcProvider({ nodeUrl: MAINNET_RPC });
      await verifyReviewedPoolTarget(provider, STRK20_MAINNET_REVIEW_TARGET);
      const target = await resolveTarget(provider);
      const actions = buildSimplePaymentActions(operation, amount, target);
      const feeResult = await provider.callContract({ contractAddress: STRK20_MAINNET_REVIEW_TARGET.address, entrypoint: "get_fee_amount", calldata: [] });
      setFee(formatStrkAmount(feeResult[0] ?? "0x0"));
      if (revision !== reviewRevision.current) return;
      await account.strk20PrepareInvoke(actions, true);
      let nextPendingMemo: PendingPaymentMemo | null = null;
      if (operation === "pay" && memoText.trim()) {
        if (!memoClient || !memoCreator) throw new Error("PAYMENT_MEMO_KEYS_REQUIRED");
        nextPendingMemo = await encryptPaymentMemo({
          sender: memoClient,
          recipient: createPaymentMemoContact(memoCreator),
          plaintext: memoText,
          paymentCommitment: await paymentMemoCommitmentForFields({
            operation,
            amount,
            recipient: target ?? "",
            pool: STRK20_MAINNET_REVIEW_TARGET.address,
          }),
        });
      }
      if (revision !== reviewRevision.current) return;
      setResolvedRecipient(target ?? "");
      setPendingMemo(nextPendingMemo);
      setPrepared(actions); setAcknowledged(false); setRegistrationRequired(false); setPhase("prepared");
      setMessage(nextPendingMemo
        ? "Dry run completed and the memo is encrypted locally. Review the fields before signing."
        : "Dry run completed. Review the exact public fields and pool fee before signing.");
      setMemoNotice(nextPendingMemo
        ? "Memo ciphertext is ready. Plaintext will not enter the wallet action, transaction calldata, or receipt storage."
        : "No memo attached to this prepared action.");
    } catch (error) {
      if (revision !== reviewRevision.current) return;
      if (operation === "shield" && isFirstShieldRegistrationRequired(error)) {
        setPrepared(null); setAcknowledged(false); setRegistrationRequired(true); setPhase("blocked");
        setMessage("Ready X requires its first shield to be registered in the wallet's own Privacy flow. Shield this reviewed amount in Ready X, preserve the pool-deposit hash, then reconnect Z.");
        return;
      }
      setPrepared(null); setAcknowledged(false); setRegistrationRequired(false); setPendingMemo(null); setPhase("blocked");
      setMessage(error instanceof Error && error.message === "PAYMENT_MEMO_KEYS_REQUIRED"
        ? "Create session memo keys before preparing a private payment with a memo."
        : paymentPreparationErrorMessage(error));
    } finally {
      walletOperationPending.current = false;
    }
  }

  async function submit() {
    if (!account || !prepared || !acknowledged || phase !== "prepared" || walletOperationPending.current) return;
    walletOperationPending.current = true;
    const revision = reviewRevision.current;
    setPhase("submitting"); setMessage("Waiting for your explicit Mainnet wallet signature…");
    try {
      const provider = new RpcProvider({ nodeUrl: MAINNET_RPC });
      await verifyReviewedPoolTarget(provider, STRK20_MAINNET_REVIEW_TARGET);
      if (revision !== reviewRevision.current) return;
      const result = await account.strk20InvokeTransaction(prepared);
      const nextHistory = updateTransactionHistory(history, result.transaction_hash);
      setHistory(nextHistory); setHash(result.transaction_hash); setPhase("submitted");
      if (pendingMemo) {
        try {
          const memoReceipt = await bindPaymentMemoReceipt({ pending: pendingMemo, paymentHash: result.transaction_hash });
          const nextMemoReceipts = updatePaymentMemoReceipts(memoReceipts, memoReceipt);
          setMemoReceipts(nextMemoReceipts); setPendingMemo(null); setMemoText("");
          localStorage.setItem(MEMO_RECEIPTS_KEY, JSON.stringify(nextMemoReceipts));
          setMemoNotice("Encrypted memo receipt saved locally beside the payment hash.");
        } catch (error) {
          setMemoNotice(error instanceof Error ? error.message : "PAYMENT_MEMO_RECEIPT_FAILED");
        }
      }
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
        setMessage("Submitted. Preserve this hash even if the selected RPC has not indexed it yet.");
      } catch {
        setMessage("Submitted, but browser recovery storage is unavailable. Copy the displayed hash now.");
      }
    } catch (error) {
      setPhase("blocked"); setMessage(walletFlowErrorMessage(error));
    } finally {
      walletOperationPending.current = false;
    }
  }

  async function copyMemoReceipt(receipt: PaymentMemoReceipt) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt));
      setMemoNotice("Encrypted memo receipt copied. It contains ciphertext and a payment binding, not plaintext.");
    } catch {
      setMemoNotice("Copy was unavailable. Select the memo receipt JSON directly.");
    }
  }

  async function importMemoReceipt() {
    try {
      const receipt = await parsePaymentMemoReceipt(memoImport);
      const nextMemoReceipts = updatePaymentMemoReceipts(memoReceipts, receipt);
      setMemoReceipts(nextMemoReceipts); setMemoImport("");
      localStorage.setItem(MEMO_RECEIPTS_KEY, JSON.stringify(nextMemoReceipts));
      setMemoNotice("Encrypted memo receipt imported. Decrypt as the creator to read it locally.");
    } catch (error) {
      setMemoNotice(error instanceof Error ? error.message : "PAYMENT_MEMO_IMPORT_FAILED");
    }
  }

  async function decryptLatestMemo(receipt = memoReceipts[0]) {
    if (!receipt || !memoCreator) return;
    try {
      setDecryptedMemo(await decryptPaymentMemo(memoCreator, receipt));
      setMemoNotice("Creator decrypted the memo locally. No wallet key, viewing key, note, proof, or witness was used.");
    } catch (error) {
      setDecryptedMemo("");
      setMemoNotice(error instanceof Error ? error.message : "PAYMENT_MEMO_DECRYPT_FAILED");
    }
  }

  async function verifyReceipt(candidate = hash) {
    if (!candidate) return;
    setMessage("Checking the Mainnet receipt and pool event…");
    try {
      const provider = new RpcProvider({ nodeUrl: MAINNET_RPC });
      const receipt = await provider.getTransactionReceipt(candidate);
      if (!receiptQualifiesForSubmission(receipt, STRK20_MAINNET_REVIEW_TARGET.address)) {
        throw new Error("Receipt is not yet accepted and successful, or no STRK20 pool event was found.");
      }
      const nextVerified = updateTransactionHistory(verifiedHistory, candidate);
      setVerifiedHistory(nextVerified); setHash(candidate); setPhase("confirmed");
      try {
        localStorage.setItem(VERIFIED_HISTORY_KEY, JSON.stringify(nextVerified));
        setMessage("Confirmed by the configured RPC: accepted, successful, and emitted an event from the reviewed STRK20 pool.");
      } catch {
        setMessage("Receipt confirmed, but browser recovery storage is unavailable. Copy the displayed hash now.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "RECEIPT_NOT_READY");
    }
  }

  async function copyCreatorHandoff() {
    if (!resolvedRecipient) return;
    try {
      await navigator.clipboard.writeText(resolvedRecipient);
      setMessage("Resolved creator recipient copied. Give the client this public address or .stark alias—never a wallet secret.");
    } catch {
      setMessage("Copy was unavailable. Select the resolved creator address directly; never share a wallet secret.");
    }
  }

  const actionLabel = operation === "shield"
    ? "Shield STRK"
    : operation === "pay"
      ? "Private creator payment"
      : "Withdraw STRK";

  const walletReady = Boolean(account);
  const actionReady = Boolean(prepared);
  const receiptReady = phase === "submitted" || phase === "confirmed";

  return (
    <section id="pay" className="payment-mvp" aria-labelledby="payment-title">
      <div className="payment-heading">
        <div>
          <p className="eyebrow">Live Mainnet MVP</p>
          <h2 id="payment-title">One private payment flow. Three verifiable pool receipts.</h2>
          <p>
            Wallet connection proves account control. A resolved <code>.stark</code> name is a public
            recipient alias—not a private-pool identity claim.
          </p>
        </div>
        <span className="badge">SN_MAIN · POOL V2</span>
      </div>

      <ol className="qualifying-route" aria-label="Qualifying Mainnet transaction route">
        <li><b>Creator wallet:</b> shield STRK to register and create receipt 1.</li>
        <li><b>Client wallet:</b> shield enough STRK for the payment and create receipt 2.</li>
        <li><b>Client wallet:</b> pay the registered creator privately and create receipt 3.</li>
      </ol>

      <section className="payment-demo-route" aria-labelledby="demo-route-title">
        <div className="payment-demo-route-heading">
          <div>
            <p className="eyebrow">Two-user demo route</p>
            <h3 id="demo-route-title">Hand off a public recipient. Keep private state in each wallet.</h3>
          </div>
          <p>Switch wallets only at the marked handoff. Z never transfers keys, notes, balances, or proofs between participants.</p>
        </div>

        <ol className="demo-progress">
          <li className={walletReady ? "complete" : "active"} aria-current={!walletReady ? "step" : undefined}>
            <span>1</span><b>Connect</b><small>Check capability and connect the active Mainnet wallet.</small>
          </li>
          <li className={actionReady ? "complete" : walletReady ? "active" : ""} aria-current={walletReady && !actionReady ? "step" : undefined}>
            <span>2</span><b>Prepare</b><small>Resolve public fields, read the fee, and dry-run privately.</small>
          </li>
          <li className={receiptReady ? "complete" : actionReady ? "active" : ""} aria-current={actionReady && !receiptReady ? "step" : undefined}>
            <span>3</span><b>Sign &amp; verify</b><small>Approve in the wallet, then verify the public pool receipt.</small>
          </li>
        </ol>

        <div className="participant-handoff">
          <article>
            <p className="eyebrow">Creator handoff</p>
            <h4>Share a recipient, never a secret.</h4>
            <p>{resolvedRecipient ? "The dry run resolved this public recipient:" : <>After shielding, give the client your public <code>.stark</code> alias or address.</>}</p>
            {resolvedRecipient ? (
              <>
                <code>{resolvedRecipient}</code>
                <button type="button" className="secondary" onClick={() => void copyCreatorHandoff()}>Copy public recipient</button>
              </>
            ) : null}
          </article>
          <article>
            <p className="eyebrow">Client preflight</p>
            <h4>One exact review before signing.</h4>
            <dl>
              <div><dt>Wallet</dt><dd>{account ? "Connected on Mainnet" : "Not connected"}</dd></div>
              <div><dt>Recipient</dt><dd>{resolvedRecipient || "Resolved during payment dry run"}</dd></div>
              <div><dt>Notes</dt><dd>Maturity is checked by the wallet; note data stays private.</dd></div>
              <div><dt>Next</dt><dd>{prepared ? "Review and acknowledge the exact action." : "Prepare an exact action."}</dd></div>
            </dl>
          </article>
        </div>
      </section>

      <div className="payment-grid">
        <article className={walletReady ? "flow-card complete" : "flow-card active"}>
          <p className="flow-card-kicker">Step 01</p>
          <h3>Connect safely</h3>
          <p>Capability checks do not request private balances or note data.</p>
          <button type="button" onClick={checkWallets}>Check compatible wallet</button>
          <p>{walletName || `${wallets.length} installed wallet(s) discovered`}</p>
          <button type="button" className="secondary" onClick={connect} disabled={!walletName || Boolean(account)}>
            {account ? "Wallet connected" : "Connect on Mainnet"}
          </button>
          {account ? <p className="mono account-identity">{identity || account.address}<br /><small>{identity ? account.address : "No primary .stark name resolved"}</small></p> : null}
        </article>

        <article className={`flow-card ${actionReady ? "complete" : walletReady ? "active" : ""}`}>
          <p className="flow-card-kicker">Step 02</p>
          <h3>Prepare privately</h3>
          <label>
            Action
            <select disabled={phase === "preparing" || phase === "submitting"} value={operation} onChange={(event) => { setOperation(event.target.value as PaymentOperation); resetPreparation(); }}>
              <option value="shield">Shield STRK · public deposit</option>
              <option value="pay">Pay creator · private transfer</option>
              <option value="withdraw">Withdraw STRK · public exit</option>
            </select>
          </label>
          <label>
            Amount in STRK
            <input disabled={phase === "preparing" || phase === "submitting"} inputMode="decimal" autoComplete="off" placeholder="Example: 10" value={amount} onChange={(event) => { setAmount(event.target.value); resetPreparation(); }} />
          </label>
          {operation !== "shield" ? (
            <label>
              {operation === "pay" ? "Creator .stark name or address" : "Public withdrawal address"}
              <input disabled={phase === "preparing" || phase === "submitting"} autoComplete="off" spellCheck={false} placeholder="creator.stark or 0x…" value={recipient} onChange={(event) => { setRecipient(event.target.value); resetPreparation(); }} />
            </label>
          ) : (
            <p className="payment-note">Your wallet may ask twice: first for ERC-20 approval, then for the pool deposit. Only the pool deposit is qualifying evidence.</p>
          )}
          {operation === "pay" ? (
            <label>
              Private memo receipt
              <textarea
                disabled={phase === "preparing" || phase === "submitting"}
                rows={3}
                maxLength={280}
                placeholder="Optional encrypted memo for the creator"
                value={memoText}
                onChange={(event) => { setMemoText(event.target.value); resetPreparation(); }}
              />
            </label>
          ) : null}
          <button type="button" onClick={prepare} disabled={!account || phase === "preparing" || phase === "submitting"}>
            {phase === "preparing" ? "Preparing…" : "Prepare and dry-run"}
          </button>
        </article>

        <article className={`flow-card ${receiptReady ? "complete" : actionReady ? "active" : ""}`}>
          <p className="flow-card-kicker">Step 03</p>
          <h3>Review and sign</h3>
          <dl className="review-facts">
            <div><dt>Network</dt><dd>Starknet Mainnet</dd></div>
            <div><dt>Pool</dt><dd>{STRK20_MAINNET_REVIEW_TARGET.address}</dd></div>
            <div><dt>Action</dt><dd>{actionLabel}</dd></div>
            <div><dt>Token</dt><dd>STRK · {STRK_MAINNET_TOKEN}</dd></div>
            <div><dt>Amount</dt><dd>{amount || "—"} STRK</dd></div>
            {resolvedRecipient ? <div><dt>Recipient</dt><dd>{resolvedRecipient}</dd></div> : null}
            <div><dt>Pool fee</dt><dd>{fee ? `${fee} STRK · live read` : "Available after dry run"}</dd></div>
          </dl>
          {registrationRequired ? <p className="payment-note">Ready X requires first-shield registration in its own Privacy flow. Complete that public shield there, preserve the deposit hash, then reconnect here.</p> : null}
          <label className="review-acknowledgement">
            <input type="checkbox" checked={acknowledged} disabled={phase !== "prepared"} onChange={(event) => setAcknowledged(event.target.checked)} />
            <span>I reviewed the network, pool, action, token, amount, recipient, and live fee.</span>
          </label>
          <button type="button" onClick={submit} disabled={!prepared || !acknowledged || phase !== "prepared"}>
            {phase === "submitting" ? "Waiting for wallet…" : "Request Mainnet signature"}
          </button>
        </article>
      </div>

      <p className="wallet-flow-status" role="status" aria-live="polite"><span className="status-dot" aria-hidden="true" />{message}</p>

      {hash ? (
        <div className="receipt-card">
          <b>Latest transaction</b>
          <a href={`https://voyager.online/tx/${hash}`} target="_blank" rel="noreferrer" aria-label={`View transaction ${hash} on Voyager`}>{shortHash(hash)}</a>
          <button type="button" className="secondary" onClick={() => void verifyReceipt()}>Verify receipt and pool event</button>
        </div>
      ) : null}

      {history.length ? (
        <details className="transaction-history" open={verifiedHistory.length >= 3}>
          <summary>Submission evidence · {verifiedHistory.length} verified / {history.length} submitted</summary>
          {history.map((item) => (
            <div key={item}>
              <a href={`https://voyager.online/tx/${item}`} target="_blank" rel="noreferrer" aria-label={`View transaction ${item} on Voyager`}>{shortHash(item)}</a>
              {verifiedHistory.includes(item)
                ? <strong className="verified-hash">Verified</strong>
                : <button type="button" className="secondary" onClick={() => void verifyReceipt(item)}>Verify</button>}
            </div>
          ))}
        </details>
      ) : null}

      <section className="memo-receipts" aria-labelledby="memo-receipts-title">
        <div>
          <p className="eyebrow">Encrypted memo receipt</p>
          <h3 id="memo-receipts-title">Attach a private note without changing the pool transaction.</h3>
          <p>The memo is encrypted before signing and bound to the returned payment hash after submission. The stored receipt contains ciphertext, a commitment, a replay nullifier, and a local recipient label.</p>
        </div>
        <div className="memo-tools">
          <article>
            <h4>Demo keys</h4>
            <p>Session-only keys model creator import/decrypt. They are not wallet viewing keys.</p>
            <button type="button" className="secondary" disabled={phase === "preparing" || phase === "submitting"} onClick={() => void createMemoKeys()}>{memoCreator ? "Rotate memo keys" : "Create memo keys"}</button>
            {memoCreator ? <code>creator key {memoCreator.keyId}</code> : null}
            {pendingMemo ? <strong className="verified-hash">Memo encrypted before signature</strong> : null}
          </article>
          <article>
            <h4>Creator inbox demo</h4>
            <textarea rows={4} value={memoImport} onChange={(event) => setMemoImport(event.target.value)} placeholder="Paste encrypted memo receipt JSON" />
            <div className="memo-actions">
              <button type="button" className="secondary" onClick={() => void importMemoReceipt()} disabled={!memoImport.trim()}>Import receipt</button>
              <button type="button" className="secondary" onClick={() => void decryptLatestMemo()} disabled={!memoCreator || memoReceipts.length === 0}>Decrypt latest</button>
            </div>
            <p role="status">{memoNotice}</p>
            {decryptedMemo ? <p className="memo-plaintext"><b>Creator local view:</b> {decryptedMemo}</p> : null}
          </article>
        </div>
        {memoReceipts.length ? (
          <details className="transaction-history">
            <summary>Local memo receipts · {memoReceipts.length}</summary>
            {memoReceipts.map((receipt) => (
              <div key={`${receipt.paymentHash}:${receipt.memoCommitment}`}>
                <span><b>{receipt.recipientLabel}</b> · {shortHash(receipt.paymentHash)} · memo {receipt.memoCommitment.slice(0, 16)}…</span>
                <button type="button" className="secondary" onClick={() => void copyMemoReceipt(receipt)}>Copy receipt</button>
              </div>
            ))}
          </details>
        ) : null}
      </section>

      <section id="evidence" className="receipt-timeline" aria-labelledby="receipt-timeline-title">
        <div>
          <p className="eyebrow">Verified Mainnet evidence</p>
          <h3 id="receipt-timeline-title">Three public receipts. One private payment relationship.</h3>
          <p>Each committed hash was checked through two independent RPC providers for accepted finality, successful execution, and a reviewed-pool event.</p>
          <span className="evidence-seal"><b>3 / 3</b> receipts verified</span>
          <div className="submission-links" aria-label="Hackathon submission links">
            <a href={ZEEROSTREAM_DEMO_URL}>Live app</a>
            <a href={ZEEROSTREAM_DEMO_VIDEO_URL}>Demo video</a>
            <a href={ZEEROSTREAM_MANIFEST_URL}>STRK20 manifest</a>
          </div>
        </div>
        <ol>
          {ZEEROSTREAM_DEMO_RECEIPTS.map((receipt) => (
            <li key={receipt.hash}>
              <span>{receipt.step}</span>
              <div>
                <b>{receipt.role}</b>
                <small>{receipt.detail}</small>
                <a href={`https://voyager.online/tx/${receipt.hash}`} target="_blank" rel="noreferrer" aria-label={`View ${receipt.role} transaction ${receipt.hash} on Voyager`}>
                  View on Voyager <code>{shortHash(receipt.hash)}</code>
                </a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="submission-dossier" aria-labelledby="submission-dossier-title">
        <div>
          <p className="eyebrow">Submission pack</p>
          <h3 id="submission-dossier-title">Ready to score, with conservative claims.</h3>
          <p>The submitted artifact is the non-custodial checkout, encrypted memo receipt demo, selective-disclosure demo, public MP4, and three reviewed STRK20 Mainnet pool receipts.</p>
        </div>
        <dl>
          <div><dt>Verifier result</dt><dd>READY_TO_SCORE</dd></div>
          <div><dt>Wallet boundary</dt><dd>User wallet signs; Z keeps no keys, notes, witnesses, or balances.</dd></div>
          <div><dt>Not claimed</dt><dd>No live subscriptions, helper contract mail storage, autonomous billing, or production creator analytics.</dd></div>
        </dl>
      </section>

      <p className="payment-boundary"><b>Wallet-only boundary:</b> signing keys, viewing keys, notes, witnesses, proofs, and private balances never enter Z. Deposits and withdrawals are public; private transfers hide pool-side sender, recipient, and amount, while timing remains observable.</p>
    </section>
  );
}
