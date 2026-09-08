"use client";

import { useEffect, useState } from "react";
import { sanitizeCheckoutIntent } from "../lib/z0studio-thirdweb";

const CHECKOUT_INTENTS_KEY = "z0studio.checkout-intents.v1";

type CheckoutIntent = ReturnType<typeof sanitizeCheckoutIntent>;

export function CheckoutIntentForm() {
  const [creatorName, setCreatorName] = useState("Zero Studio");
  const [handle, setHandle] = useState("zero-studio");
  const [roomName, setRoomName] = useState("Private build room");
  const [plan, setPlan] = useState("pro");
  const [email, setEmail] = useState("");
  const [intents, setIntents] = useState<CheckoutIntent[]>([]);
  const [notice, setNotice] = useState("Create a local onboarding intent before wiring live checkout.");

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(CHECKOUT_INTENTS_KEY) ?? "[]") as CheckoutIntent[];
      setIntents(Array.isArray(parsed) ? parsed.slice(0, 8) : []);
    } catch {
      setNotice("Local checkout intent storage is unavailable.");
    }
  }, []);

  function saveIntent() {
    try {
      const intent = sanitizeCheckoutIntent({ creatorName, handle, roomName, plan, email });
      const next = [intent, ...intents.filter((entry) => entry.id !== intent.id)].slice(0, 8);
      localStorage.setItem(CHECKOUT_INTENTS_KEY, JSON.stringify(next));
      setIntents(next);
      setNotice("Local checkout intent saved. No payment, wallet, or token action was started.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "CHECKOUT_INTENT_REJECTED");
    }
  }

  return (
    <section className="checkout-intent" aria-labelledby="checkout-intent-title">
      <div>
        <p className="eyebrow">Creator onboarding</p>
        <h2 id="checkout-intent-title">Prepare a room sale before activating live payments.</h2>
        <p>
          This form models the creator, room, plan, and contact needed for checkout wiring. It saves only
          browser-local product intent and rejects private material.
        </p>
      </div>
      <div className="checkout-intent-grid">
        <label>
          Creator
          <input value={creatorName} onChange={(event) => setCreatorName(event.target.value)} />
        </label>
        <label>
          Handle
          <input value={handle} onChange={(event) => setHandle(event.target.value)} />
        </label>
        <label>
          Room
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
        </label>
        <label>
          Plan
          <select value={plan} onChange={(event) => setPlan(event.target.value)}>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="studio">Studio</option>
          </select>
        </label>
        <label>
          Contact
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="creator@example.com" />
        </label>
        <button type="button" onClick={saveIntent}>Save local intent</button>
      </div>
      <p className="notice" role="status">{notice}</p>
      <div className="checkout-intent-list">
        {intents.length === 0 ? <p>No local checkout intents yet.</p> : intents.map((intent) => (
          <article key={intent.id}>
            <b>{intent.roomName}</b>
            <span>{intent.plan} · @{intent.handle} · {intent.status}</span>
            <small>{intent.email ?? "no contact stored"}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
