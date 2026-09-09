"use client";

import { useEffect, useState } from "react";
import {
  createPrivacyPaymentIntent,
  z0StudioPrivacyPaymentBoundaries,
  z0StudioPrivacyPaymentSteps,
  type PrivacyPaymentIntent,
  type PrivacyPaymentMode,
} from "../lib/z0studio-starknet-privacy";

const PRIVACY_PAYMENT_INTENTS_KEY = "z0studio.privacy-payment-intents.v1";

export function PrivacyPaymentSetup() {
  const [creatorHandle, setCreatorHandle] = useState("zero-studio");
  const [roomId, setRoomId] = useState("zero-studio-room");
  const [mode, setMode] = useState<PrivacyPaymentMode>("room-entry");
  const [amount, setAmount] = useState("9");
  const [recipient, setRecipient] = useState("zero.stark");
  const [intents, setIntents] = useState<PrivacyPaymentIntent[]>([]);
  const [notice, setNotice] = useState("Create a local privacy-payment intent, then use the guarded STRK20 flow below.");

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PRIVACY_PAYMENT_INTENTS_KEY) ?? "[]") as PrivacyPaymentIntent[];
      setIntents(Array.isArray(parsed) ? parsed.slice(0, 8) : []);
    } catch {
      setNotice("Local privacy-payment storage is unavailable.");
    }
  }, []);

  function saveIntent() {
    try {
      const intent = createPrivacyPaymentIntent({ creatorHandle, roomId, mode, amount, recipient });
      const next = [intent, ...intents.filter((entry) => entry.id !== intent.id)].slice(0, 8);
      localStorage.setItem(PRIVACY_PAYMENT_INTENTS_KEY, JSON.stringify(next));
      setIntents(next);
      setNotice("Local privacy-payment intent saved. No wallet, proof, or transaction was requested.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PRIVACY_PAYMENT_INTENT_REJECTED");
    }
  }

  return (
    <section className="privacy-payment-setup" aria-labelledby="privacy-payment-title">
      <div className="privacy-payment-head">
        <div>
          <p className="eyebrow">Primary checkout lane</p>
          <h2 id="privacy-payment-title">Shielded Starknet payments power room access.</h2>
          <p>
            Z0Studio uses STRK20 as the native privacy checkout route. thirdweb is not needed for checkout
            when the goal is shielded payments, private creator transfers, and Z0Pass access receipts.
          </p>
        </div>
        <span className="badge">STRK20 · Wallet API</span>
      </div>

      <ol className="privacy-payment-steps">
        {z0StudioPrivacyPaymentSteps.map((step) => (
          <li key={step.id}>
            <span>{step.id}</span>
            <b>{step.title}</b>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="privacy-intent-panel">
        <div className="privacy-intent-grid">
          <label>
            Creator
            <input value={creatorHandle} onChange={(event) => setCreatorHandle(event.target.value)} />
          </label>
          <label>
            Room
            <input value={roomId} onChange={(event) => setRoomId(event.target.value)} />
          </label>
          <label>
            Mode
            <select value={mode} onChange={(event) => setMode(event.target.value as PrivacyPaymentMode)}>
              <option value="room-entry">Room entry</option>
              <option value="locked-drop">Locked drop</option>
              <option value="creator-tip">Creator tip</option>
            </select>
          </label>
          <label>
            Amount
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label>
            Creator recipient
            <input value={recipient} onChange={(event) => setRecipient(event.target.value)} />
          </label>
          <button type="button" onClick={saveIntent}>Save privacy intent</button>
        </div>
        <p className="notice" role="status">{notice}</p>
      </div>

      <div className="privacy-intent-list">
        {intents.length === 0 ? <p>No local privacy-payment intents yet.</p> : intents.map((intent) => (
          <article key={intent.id}>
            <b>{intent.mode}</b>
            <span>@{intent.creatorHandle} · {intent.roomId} · {intent.amount} STRK</span>
            <small>{intent.recipient} · {intent.requiredAction} · {intent.status}</small>
          </article>
        ))}
      </div>

      <div className="privacy-payment-boundaries">
        {z0StudioPrivacyPaymentBoundaries.map((boundary) => <p key={boundary}>{boundary}</p>)}
      </div>
    </section>
  );
}
