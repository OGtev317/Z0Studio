"use client";

import { useMemo, useState } from "react";
import {
  buildCreatorReceiptRoom,
  createAccessDisclosurePass,
  type AccessDisclosurePass,
  type ReceiptRoomCard,
} from "../lib/private-creator-room";

function shortHash(value: string): string {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function formatTime(value: number): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function PrivateCreatorReceiptRoom() {
  const room = useMemo(() => buildCreatorReceiptRoom(), []);
  const [selectedHash, setSelectedHash] = useState(room.cards[2]?.hash ?? room.cards[0]?.hash ?? "");
  const [tier, setTier] = useState<"Supporter" | "Studio" | "Patron">("Studio");
  const [pass, setPass] = useState<AccessDisclosurePass | null>(null);
  const [notice, setNotice] = useState("Select a receipt and generate a local access pass.");

  const selectedReceipt = room.cards.find((card) => card.hash === selectedHash) ?? room.cards[0];

  async function generatePass(receipt: ReceiptRoomCard) {
    try {
      const now = Date.now();
      const nextPass = await createAccessDisclosurePass({
        receiptHash: receipt.hash,
        tier,
        audience: "zero-studio-feed",
        issuedAt: now,
        expiresAt: now + 1000 * 60 * 45,
      });
      setPass(nextPass);
      setNotice("Local access pass generated. It discloses tier, audience, expiry, and receipt binding only.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to generate access pass.");
    }
  }

  async function copyEvidencePack() {
    const payload = {
      demo_url: room.demoUrl,
      demo_video: room.demoVideoUrl,
      manifest: room.manifestUrl,
      receipts: room.cards.map(({ role, hash, status }) => ({ role, hash, status })),
      claims: {
        live: "STRK20 Mainnet private checkout with three verified pool receipts",
        local: "Encrypted memo inbox and access pass demo",
        not_claimed: "No live autonomous subscriptions, helper-contract mail storage, or production analytics",
      },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setNotice("Public evidence pack copied. It contains no keys, viewing keys, private notes, or memo plaintext.");
    } catch {
      setNotice("Clipboard unavailable. Open the public manifest or individual receipt links instead.");
    }
  }

  return (
    <section id="receipt-room" className="receipt-room" aria-labelledby="receipt-room-title">
      <div className="receipt-room-heading">
        <div>
          <p className="eyebrow">Private creator receipt room</p>
          <h2 id="receipt-room-title">Public receipt evidence. Minimum-disclosure access demo.</h2>
          <p>Judges can inspect the public evidence pack, while the product demo shows the creator workflow: verified receipts, ciphertext-only memo handling, and minimum-disclosure access.</p>
        </div>
        <button type="button" className="secondary" onClick={() => void copyEvidencePack()}>Copy evidence pack</button>
      </div>

      <div className="receipt-room-grid">
        <div className="receipt-stack" aria-label="Verified STRK20 receipt cards">
          {room.cards.map((receipt) => (
            <button
              type="button"
              className={`receipt-room-card ${receipt.hash === selectedReceipt.hash ? "active" : ""}`}
              key={receipt.hash}
              onClick={() => {
                setSelectedHash(receipt.hash);
                setPass(null);
                setNotice(`${receipt.role} selected.`);
              }}
            >
              <span>{receipt.step}</span>
              <b>{receipt.role}</b>
              <small>{receipt.detail}</small>
              <code>{shortHash(receipt.hash)}</code>
            </button>
          ))}
        </div>

        <article className="receipt-inspector">
          <div className="inspector-top">
            <div>
              <p className="eyebrow">Receipt inspector</p>
              <h3>{selectedReceipt.role}</h3>
            </div>
            <a href={`https://voyager.online/tx/${selectedReceipt.hash}`} target="_blank" rel="noreferrer">Voyager</a>
          </div>
          <dl>
            <div><dt>Status</dt><dd>{selectedReceipt.status}</dd></div>
            <div><dt>Hash</dt><dd><code>{selectedReceipt.hash}</code></dd></div>
            <div><dt>Visible</dt><dd>{selectedReceipt.visibleFields.join(", ")}</dd></div>
            <div><dt>Hidden</dt><dd>{selectedReceipt.hiddenFields.join(", ")}</dd></div>
          </dl>
        </article>

        <article className="access-pass-panel">
          <p className="eyebrow">Selective access pass</p>
          <h3>Reveal the right fact, not the wallet.</h3>
          <label>
            Tier to disclose
            <select value={tier} onChange={(event) => { setTier(event.target.value as typeof tier); setPass(null); }}>
              <option>Supporter</option>
              <option>Studio</option>
              <option>Patron</option>
            </select>
          </label>
          <button type="button" onClick={() => void generatePass(selectedReceipt)}>Generate local pass</button>
          <p>Demo only: a public receipt and self-selected tier do not prove payment ownership or grant protected access.</p>
          <p role="status">{notice}</p>
          {pass ? (
            <div className="access-pass">
              <b>{pass.tier} access</b>
              <span>{pass.audience} · expires {formatTime(pass.expiresAt)}</span>
              <code>{pass.disclosureDigest.slice(0, 24)}...</code>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
