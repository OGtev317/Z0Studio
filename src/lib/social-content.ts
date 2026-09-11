import { ZEEROSTREAM_DEMO_RECEIPTS } from "./hackathon-evidence";

export const creatorProfiles = [
  {
    handle: "zero-studio",
    name: "Zero Studio",
    tier: "Studio",
    price: "10 STRK",
    bio: "Studio notes, member drops, and closer access for the people supporting the work.",
    stats: { posts: "18", receipts: "3", supporters: "142" },
  },
  {
    handle: "night-mode",
    name: "Night Mode Labs",
    tier: "Patron",
    price: "25 STRK",
    bio: "Research notes and build logs for a focused community of supporters.",
    stats: { posts: "9", receipts: "local", supporters: "61" },
  },
  {
    handle: "proof-cafe",
    name: "Proof Cafe",
    tier: "Supporter",
    price: "5 STRK",
    bio: "Short creator updates, community conversations, and supporter-only extras.",
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
    title: "Welcome to the new Zero Studio room",
    body: "A closer place for build notes, member conversations, and the work that does not fit in a public post.",
  },
  {
    author: "Zero Studio",
    handle: "zero-studio",
    createdAt: 1788266880000,
    source: "seed",
    time: "12m",
    visibility: "Members",
    title: "Behind the scenes this week",
    body: "We are sharing fresh build notes, early drafts, and a live question thread with the room.",
  },
  {
    author: "Proof Cafe",
    handle: "proof-cafe",
    createdAt: 1788265560000,
    source: "seed",
    time: "34m",
    visibility: "Supporters",
    title: "A new drop is ready",
    body: "The latest guide is available for supporters. Open the room to take a look.",
  },
] as const;

export const encryptedMessages = [
  {
    from: "subscriber-8f2",
    to: "Zero Studio",
    subject: "Custom delivery note",
    status: "New",
    receipt: ZEEROSTREAM_DEMO_RECEIPTS[2].hash,
    preview: "A supporter shared a note about their latest order.",
  },
  {
    from: "subscriber-41a",
    to: "Night Mode Labs",
    subject: "Research access request",
    status: "Room request",
    receipt: "local-only",
    preview: "A new supporter asked to join the next research session.",
  },
  {
    from: "subscriber-c70",
    to: "Proof Cafe",
    subject: "Tier upgrade question",
    status: "Question",
    receipt: ZEEROSTREAM_DEMO_RECEIPTS[1].hash,
    preview: "A supporter wants to know what comes with the next level.",
  },
] as const;

export const receiptSummaries = ZEEROSTREAM_DEMO_RECEIPTS.map((receipt) => ({
  ...receipt,
  visibility: "Public hash, private relationship",
  route: "Reviewed STRK20 Mainnet pool",
}));
