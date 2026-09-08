"use client";

import { useEffect, useState } from "react";
import { MAX_PREPAID_PERIODS, cancel, claimCreatorPeriod, prepay, startSubscription, type Subscription } from "../lib/subscription";

const STORAGE_KEY = "zeerostream.subscription-plans.v1";

function decode(value: string | null): Subscription[] {
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export function SubscriptionPlanner() {
  const [plans, setPlans] = useState<Subscription[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({ creator: "", member: "", periodEndsAt: "" });
  const [notice, setNotice] = useState("Plan one paid period first. Automatic renewal and wallet signatures are disabled.");
  useEffect(() => { setPlans(decode(localStorage.getItem(STORAGE_KEY))); setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(plans)); }, [plans, ready]);
  const act = (fn: () => Subscription[], message: string) => { try { setPlans(fn()); setNotice(message); } catch (error) { setNotice(error instanceof Error ? error.message : "SUBSCRIPTION_ACTION_FAILED"); } };
  return <section className="subscription-planner" aria-labelledby="subscription-title">
    <div><p className="eyebrow">Prepaid subscriptions</p><h2 id="subscription-title">Bounded periods, never automatic charges.</h2><p>Local plans track the product lifecycle while the reviewed escrow route is completed. A future payment action must show its exact network, helper, token, amount, period, and creator before the wallet is asked to sign.</p></div>
    <form onSubmit={(event) => { event.preventDefault(); act(() => [...plans, startSubscription({ id: `subscription-${crypto.randomUUID()}`, creatorCommitment: form.creator, memberCommitment: form.member, periodEndsAt: Number(form.periodEndsAt) })], "One local prepaid period created. No funds were requested."); setForm({ creator: "", member: "", periodEndsAt: "" }); }}><input required placeholder="Creator commitment" value={form.creator} onChange={(e) => setForm({ ...form, creator: e.target.value })}/><input required placeholder="Member commitment" value={form.member} onChange={(e) => setForm({ ...form, member: e.target.value })}/><input required type="number" min="1" placeholder="Period-end Unix timestamp" value={form.periodEndsAt} onChange={(e) => setForm({ ...form, periodEndsAt: e.target.value })}/><button>Create local plan</button></form>
    <p className="notice" role="status">{notice}</p>
    <div className="subscription-list">{plans.length === 0 ? <p className="muted">No local subscription plans yet.</p> : plans.map((plan) => <article key={plan.id}><div><b>{plan.id.slice(0, 22)}…</b><span>{plan.state} · {plan.prepaidPeriods}/{MAX_PREPAID_PERIODS} prepaid · {plan.creatorClaimedPeriods} claimed</span><small>Ends {plan.periodEndsAt} · creator {plan.creatorCommitment.slice(0, 14)}…</small></div><div className="order-actions">{plan.state === "active" && plan.prepaidPeriods < MAX_PREPAID_PERIODS ? <button onClick={() => act(() => plans.map((entry) => entry.id === plan.id ? prepay(entry, 1) : entry), "One additional local prepaid period recorded. Wallet execution remains unavailable.")}>Add one period</button> : null}{plan.state === "active" ? <button className="secondary" onClick={() => act(() => plans.map((entry) => entry.id === plan.id ? cancel(entry) : entry), "Subscription cancelled locally; already prepaid periods remain claimable.")}>Cancel</button> : null}{plan.prepaidPeriods > plan.creatorClaimedPeriods ? <button onClick={() => act(() => plans.map((entry) => entry.id === plan.id ? claimCreatorPeriod(entry) : entry), "Local creator-claim record added; this is not a payment receipt.")}>Record creator claim</button> : null}</div></article>)}</div>
    <p className="wallet-blocked">Execution gate: Z has no independently reviewed deployed subscription helper or Wallet API calldata target. This planner intentionally cannot prepare, sign, or submit a transaction. <a href="#wallet-check">Review the guarded escrow Wallet API flow</a> for the execution standard a future subscription flow must meet.</p>
  </section>;
}
