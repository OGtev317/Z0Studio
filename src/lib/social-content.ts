import { ZEEROSTREAM_DEMO_RECEIPTS } from "./hackathon-evidence";

export const creatorProfiles = [
  {
    handle: "zero-studio",
    name: "Zero Studio",
    tier: "Studio",
    price: "10 STRK",
    bio: "Private drops, paid replies, encrypted payment notes, and local receipt review for subscribers.",
    stats: { posts: "18", receipts: "3", supporters: "142" },
  },
  {
    handle: "night-mode",
    name: "Night Mode Labs",
    tier: "Patron",
    price: "25 STRK",
    bio: "Research notes and build logs shared through private STRK20 support flows.",
    stats: { posts: "9", receipts: "local", supporters: "61" },
  },
  {
    handle: "proof-cafe",
    name: "Proof Cafe",
    tier: "Supporter",
    price: "5 STRK",
    bio: "Short creator updates with encrypted request memos and selective access passes.",
    stats: { posts: "27", receipts: "local", supporters: "208" },
  },
] as const;

export const socialPosts = [
  {
    author: "Zero Studio",
    handle: "zero-studio",
    createdAt: 1788267600000,
    source: "seed",
    time: "Pinned",
    visibility: "Public preview",
    title: "Paid creator requests without the public payment graph",
    body: "Subscribers can pay through STRK20, attach an encrypted note, and keep wallet keys and private notes inside their own wallet.",
  },
  {
    author: "Zero Studio",
    handle: "zero-studio",
    createdAt: 1788266880000,
    source: "seed",
    time: "12m",
    visibility: "Studio tier",
    title: "Behind-the-scenes delivery queue",
    body: "The creator sees receipt bindings and encrypted memo packages. The public chain sees the pool edge, not the subscriber relationship.",
  },
  {
    author: "Proof Cafe",
    handle: "proof-cafe",
    createdAt: 1788265560000,
    source: "seed",
    time: "34m",
    visibility: "Supporter tier",
    title: "Access pass ready",
    body: "A local pass can show tier, creator feed, expiry, and receipt binding without scanning wallet history.",
  },
] as const;

export const encryptedMessages = [
  {
    from: "subscriber-8f2",
    to: "Zero Studio",
    subject: "Custom delivery note",
    status: "Encrypted",
    receipt: ZEEROSTREAM_DEMO_RECEIPTS[2].hash,
    preview: "Ciphertext-only receipt package. Creator decrypts locally with session demo keys.",
  },
  {
    from: "subscriber-41a",
    to: "Night Mode Labs",
    subject: "Research access request",
    status: "Local demo",
    receipt: "local-only",
    preview: "Private content stays out of public chain data and browser export packs.",
  },
  {
    from: "subscriber-c70",
    to: "Proof Cafe",
    subject: "Tier upgrade question",
    status: "Encrypted",
    receipt: ZEEROSTREAM_DEMO_RECEIPTS[1].hash,
    preview: "Receipt binding is visible. Memo plaintext, wallet history, and notes remain hidden.",
  },
] as const;

export const receiptSummaries = ZEEROSTREAM_DEMO_RECEIPTS.map((receipt) => ({
  ...receipt,
  visibility: "Public hash, private relationship",
  route: "Reviewed STRK20 Mainnet pool",
}));
