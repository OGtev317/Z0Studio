"use client";

import { useMemo, useState } from "react";
import { claimPrivateNote, createEscrow, openDispute, settle, submitDelivery, type Escrow } from "../lib/escrow";

const initial = () => createEscrow({
  id: "gig-demo-001",
  buyerCommitment: "buyer:8b2…91a",
  sellerCommitment: "seller:4c7…0ef",
  amount: 125n,
});

export function Demo() {
  const [escrow, setEscrow] = useState<Escrow>(initial);
  const [mode, setMode] = useState<"confirm" | "dispute">("confirm");
  const [notice, setNotice] = useState("Demo only: no wallet, proof, contract, or funds are used.");
  const steps = useMemo(() => [
    ["Private deposit", escrow.status !== "funded" ? "complete" : "active"],
    ["Delivery commitment", escrow.deliveryCommitment ? "complete" : "waiting"],
    [mode === "confirm" ? "Buyer confirmation" : "ZK outcome", ["settled", "refunded"].includes(escrow.status) ? "complete" : "waiting"],
    ["Private-note claim", escrow.sellerClaimed || escrow.buyerClaimed ? "complete" : "waiting"],
  ], [escrow, mode]);

  const act = (operation: () => Escrow, message: string) => {
    try { setEscrow(operation()); setNotice(message); } catch (error) { setNotice(error instanceof Error ? error.message : "ACTION_FAILED"); }
  };
  const reset = () => { setEscrow(initial()); setNotice("Demo reset. The state machine has no persistence."); };

  return <section className="demo" aria-label="Z escrow walkthrough">
    <div className="demo-top"><div><p className="eyebrow">Must-ship demo</p><h2>Private milestone settlement</h2></div><button className="secondary" onClick={reset}>Reset</button></div>
    <div className="roles"><span>Buyer commitment: <b>{escrow.buyerCommitment}</b></span><span>Seller commitment: <b>{escrow.sellerCommitment}</b></span><span>Amount: <b>not sent</b></span></div>
    <div className="step-grid">{steps.map(([name, state]) => <div key={name} className={`step ${state}`}><i />{name}<small>{state}</small></div>)}</div>
    <div className="controls">
      <label>Resolution path<select value={mode} onChange={(event) => setMode(event.target.value as "confirm" | "dispute")}><option value="confirm">Buyer confirms delivery</option><option value="dispute">Dispute and ZK settlement outcome</option></select></label>
      <button onClick={() => act(() => submitDelivery(escrow, "delivery:2f1…9bb"), "Delivery commitment recorded; the delivery content remains off-chain.")}>1. Submit delivery</button>
      {mode === "confirm" ? <button onClick={() => act(() => settle(escrow, "seller"), "Buyer confirmation settled the seller outcome.")}>2. Confirm delivery</button> : <><button onClick={() => act(() => openDispute(escrow), "Dispute opened; no outcome selected.")}>2. Open dispute</button><button onClick={() => act(() => settle(escrow, "seller"), "Simulated ZK result selected seller; Oyster receipt is optional evidence.")}>3. Resolve to seller</button><button onClick={() => act(() => settle(escrow, "buyer"), "Simulated ZK result selected buyer; Oyster receipt is optional evidence.")}>3. Resolve to buyer</button></>}
      <button onClick={() => act(() => claimPrivateNote(escrow, escrow.status === "settled" ? "seller" : "buyer"), "Private-note claim accepted. A second attempt will fail.")}>Final. Claim note</button>
    </div>
    <p className="notice" role="status">{notice}</p>
  </section>;
}
