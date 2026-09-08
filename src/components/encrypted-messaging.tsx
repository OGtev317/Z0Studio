"use client";

import { useState } from "react";
import { createMessagingIdentity, decryptMessage, encryptMessage, type EncryptedEnvelope, type MessagingIdentity } from "../lib/encrypted-messaging";

type LocalMessage = { envelope: EncryptedEnvelope; recipient: "creator" | "member"; plaintext?: string };

export function EncryptedMessaging() {
  const [creator, setCreator] = useState<MessagingIdentity | null>(null);
  const [member, setMember] = useState<MessagingIdentity | null>(null);
  const [recipient, setRecipient] = useState<"creator" | "member">("creator");
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [notice, setNotice] = useState("Create session-only creator and member identities to compose an encrypted envelope. No message is published or persisted.");
  async function createIdentities() {
    try { const [nextCreator, nextMember] = await Promise.all([createMessagingIdentity("creator"), createMessagingIdentity("member")]); setCreator(nextCreator); setMember(nextMember); setMessages([]); setNotice("Session-only encryption identities created. Their private keys cannot be exported or sent to a chain."); } catch (error) { setNotice(error instanceof Error ? error.message : "MESSAGE_IDENTITY_FAILED"); }
  }
  async function compose(event: React.FormEvent) {
    event.preventDefault();
    if (!creator || !member) return;
    const target = recipient === "creator" ? creator : member;
    const sender = recipient === "creator" ? member : creator;
    try { const envelope = await encryptMessage({ id: `message-${crypto.randomUUID()}`, threadCommitment: "zeerostream:creator-member:demo", sender, recipientPublicKey: target.publicKey, plaintext: body }); setMessages((current) => [{ envelope, recipient }, ...current]); setBody(""); setNotice("Encrypted envelope prepared locally. Its SHA-256 anchor is visible; plaintext and private keys are not included."); } catch (error) { setNotice(error instanceof Error ? error.message : "MESSAGE_ENCRYPTION_FAILED"); }
  }
  async function reveal(message: LocalMessage) {
    const identity = message.recipient === "creator" ? creator : member;
    if (!identity) return;
    try { const plaintext = await decryptMessage(identity, message.envelope); setMessages((current) => current.map((entry) => entry.envelope.id === message.envelope.id ? { ...entry, plaintext } : entry)); setNotice("Recipient decrypted this session-local envelope in the browser."); } catch (error) { setNotice(error instanceof Error ? error.message : "MESSAGE_DECRYPTION_FAILED"); }
  }
  return <section id="messaging" className="encrypted-messaging" aria-labelledby="messaging-title"><div><p className="eyebrow">Encrypted creator messaging</p><h2 id="messaging-title">Ciphertext can travel. Plaintext stays local.</h2><p>Creator–member threads are a separate product primitive for private subscriptions and delivery discussion. A future reviewed transport may anchor a ciphertext envelope, routing tag, replay nullifier, and digest on Starknet; it must never accept plaintext, wallet keys, viewing keys, or private evidence.</p></div><div className="message-controls"><button onClick={() => void createIdentities()}>{creator && member ? "Rotate session identities" : "Create session identities"}</button><form onSubmit={(event) => void compose(event)}><select value={recipient} onChange={(event) => setRecipient(event.target.value as "creator" | "member")} disabled={!creator || !member}><option value="creator">Send to creator</option><option value="member">Send to member</option></select><input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Compose private message" disabled={!creator || !member} autoComplete="off"/><button disabled={!creator || !member || !body.trim()}>Encrypt envelope</button></form></div><p className="notice" role="status">{notice}</p><div className="message-list">{messages.length === 0 ? <p className="muted">No encrypted envelopes in this session.</p> : messages.map((message) => <article key={message.envelope.id}><b>To {message.recipient} · encrypted envelope</b><span>anchor {message.envelope.anchorDigest.slice(0, 26)}… · recipient key {message.envelope.recipientKeyId}</span>{message.plaintext ? <p>{message.plaintext}</p> : <button className="secondary" onClick={() => void reveal(message)}>Decrypt as recipient</button>}</article>)}</div><p className="wallet-blocked">Transport gate: no messaging contract, relay, indexing service, or chain transaction is wired. This is a local ECDH/AES-GCM envelope demonstration, not a claim of private on-chain messaging.</p></section>;
}
