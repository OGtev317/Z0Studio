export const ENCRYPTED_ENVELOPE_VERSION = 1;

export type MessagingIdentity = {
  label: string;
  keyId: string;
  publicKey: string;
  privateKey: CryptoKey;
};

export type EncryptedEnvelope = {
  version: typeof ENCRYPTED_ENVELOPE_VERSION;
  id: string;
  threadCommitment: string;
  senderKeyId: string;
  recipientKeyId: string;
  createdAt: number;
  iv: string;
  ephemeralPublicKey: string;
  ciphertext: string;
  anchorDigest: string;
};

export async function createMessagingIdentity(label: string): Promise<MessagingIdentity> {
  if (!label.trim()) throw new Error("MESSAGE_IDENTITY_LABEL_REQUIRED");
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  const publicKey = encodeJson(await crypto.subtle.exportKey("jwk", pair.publicKey));
  return { label: label.trim(), keyId: await keyId(publicKey), publicKey, privateKey: pair.privateKey };
}

export async function encryptMessage(input: {
  id: string;
  threadCommitment: string;
  sender: MessagingIdentity;
  recipientPublicKey: string;
  plaintext: string;
  createdAt?: number;
}): Promise<EncryptedEnvelope> {
  const plaintext = input.plaintext.trim();
  if (!input.id || !input.threadCommitment || !plaintext) throw new Error("MESSAGE_CONTENT_REQUIRED");
  const recipient = await importPublicKey(input.recipientPublicKey);
  const recipientKeyId = await keyId(input.recipientPublicKey);
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  const encryptionKey = await crypto.subtle.deriveKey({ name: "ECDH", public: recipient }, ephemeral.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, encryptionKey, new TextEncoder().encode(plaintext));
  const draft = {
    version: ENCRYPTED_ENVELOPE_VERSION as typeof ENCRYPTED_ENVELOPE_VERSION,
    id: input.id,
    threadCommitment: input.threadCommitment,
    senderKeyId: input.sender.keyId,
    recipientKeyId,
    createdAt: input.createdAt ?? Date.now(),
    iv: encodeBytes(iv),
    ephemeralPublicKey: encodeJson(await crypto.subtle.exportKey("jwk", ephemeral.publicKey)),
    ciphertext: encodeBytes(new Uint8Array(ciphertext)),
  };
  return { ...draft, anchorDigest: await digest(JSON.stringify(draft)) };
}

export async function decryptMessage(identity: MessagingIdentity, envelope: EncryptedEnvelope): Promise<string> {
  validateEncryptedEnvelope(envelope);
  if (identity.keyId !== envelope.recipientKeyId) throw new Error("MESSAGE_NOT_FOR_IDENTITY");
  const ephemeralPublicKey = await importPublicKey(envelope.ephemeralPublicKey);
  const decryptionKey = await crypto.subtle.deriveKey({ name: "ECDH", public: ephemeralPublicKey }, identity.privateKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBytes(envelope.iv).buffer as ArrayBuffer }, decryptionKey, decodeBytes(envelope.ciphertext).buffer as ArrayBuffer);
    return new TextDecoder().decode(plaintext);
  } catch { throw new Error("MESSAGE_DECRYPTION_FAILED"); }
}

export async function validateEncryptedEnvelope(envelope: EncryptedEnvelope): Promise<void> {
  if (envelope.version !== ENCRYPTED_ENVELOPE_VERSION || !envelope.id || !envelope.threadCommitment || !envelope.senderKeyId || !envelope.recipientKeyId || !Number.isSafeInteger(envelope.createdAt) || !envelope.iv || !envelope.ephemeralPublicKey || !envelope.ciphertext || !envelope.anchorDigest) throw new Error("INVALID_ENCRYPTED_ENVELOPE");
  const { anchorDigest, ...draft } = envelope;
  if (anchorDigest !== await digest(JSON.stringify(draft))) throw new Error("ENCRYPTED_ENVELOPE_TAMPERED");
}

async function importPublicKey(encoded: string): Promise<CryptoKey> {
  try { return await crypto.subtle.importKey("jwk", decodeJson(encoded), { name: "ECDH", namedCurve: "P-256" }, true, []); } catch { throw new Error("INVALID_MESSAGE_PUBLIC_KEY"); }
}

async function keyId(publicKey: string): Promise<string> { return (await digest(publicKey)).slice(0, 24); }
async function digest(value: string): Promise<string> { return encodeBytes(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))); }
function encodeJson(value: JsonWebKey): string { return encodeBytes(new TextEncoder().encode(JSON.stringify(value))); }
function decodeJson(value: string): JsonWebKey { return JSON.parse(new TextDecoder().decode(decodeBytes(value))) as JsonWebKey; }
function encodeBytes(value: Uint8Array): string { let text = ""; value.forEach((byte) => { text += String.fromCharCode(byte); }); return btoa(text); }
function decodeBytes(value: string): Uint8Array { const text = atob(value); return Uint8Array.from(text, (character) => character.charCodeAt(0)); }
