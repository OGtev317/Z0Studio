export type RoomAccessLevel = "public" | "member" | "paid-drop";
export type RoomTemplateId = "starter-room" | "paid-cohort" | "studio-drop-room";
export type ReceiptPolicyId = "preview-pass" | "monthly-room-pass" | "studio-member-pass" | "locked-drop-receipt";

export type CreatorRoom = {
  id: string;
  creator: string;
  handle: string;
  theme: string;
  entryPrice: string;
  members: number;
  feedTitle: string;
  feedBody: string;
  lockedDrops: readonly LockedDrop[];
};

export type LockedDrop = {
  id: string;
  title: string;
  price: string;
  access: RoomAccessLevel;
};

export type CreatorRoomTemplate = {
  id: RoomTemplateId;
  name: string;
  audience: string;
  defaultEntryPrice: string;
  defaultAccessTier: RoomPass["tier"];
  receiptPolicyId: ReceiptPolicyId;
  roomPolicy: {
    requiresReceipt: boolean;
    receiptScope: "room-entry" | "room-entry-and-drops";
    passDurationDays: number;
    agentDecision: "allow-public-preview" | "require-valid-room-pass" | "require-valid-room-pass-and-drop-receipt";
  };
  includedDrops: readonly LockedDrop[];
  blockedLiveActions: readonly string[];
};

export type RoomPass = {
  roomId: string;
  viewerId: string;
  tier: "visitor" | "member" | "studio";
  paidDropIds: readonly string[];
  expiresAt: number;
};

export const z0StudioRooms = [
  {
    id: "zero-studio-room",
    creator: "Zero Studio",
    handle: "zero-studio",
    theme: "build notes and studio life",
    entryPrice: "$9/month",
    members: 142,
    feedTitle: "Studio member feed",
    feedBody: "Members see launch notes, new drops, polls, and replies from the studio.",
    lockedDrops: [
      { id: "drop-alpha", title: "Prototype breakdown", price: "$4", access: "paid-drop" },
      { id: "drop-room", title: "Member Q&A replay", price: "included", access: "member" },
    ],
  },
  {
    id: "proof-cafe-room",
    creator: "Proof Cafe",
    handle: "proof-cafe",
    theme: "research and weekly notes",
    entryPrice: "$5/month",
    members: 208,
    feedTitle: "Supporter room",
    feedBody: "Supporters get room-only threads, useful research notes, and deeper conversations.",
    lockedDrops: [
      { id: "drop-deep-dive", title: "Research deep dive", price: "$7", access: "paid-drop" },
      { id: "drop-notes", title: "Weekly notes", price: "included", access: "member" },
    ],
  },
  {
    id: "night-mode-room",
    creator: "Night Mode Labs",
    handle: "night-mode",
    theme: "research logs and build sessions",
    entryPrice: "$12/month",
    members: 61,
    feedTitle: "Night Mode room",
    feedBody: "Members follow research logs, working sessions, and the ideas still taking shape.",
    lockedDrops: [
      { id: "drop-session", title: "Build session archive", price: "$6", access: "paid-drop" },
      { id: "drop-log", title: "Research log", price: "included", access: "member" },
    ],
  },
] as const satisfies readonly CreatorRoom[];

export const blockedRoomTemplateLiveActions = [
  "wallet-signing",
  "paid-checkout-activation",
  "strk20-transaction",
  "thirdweb-checkout",
  "database-write",
  "cloudflare-deployment",
] as const;

export const creatorRoomTemplates = [
  {
    id: "starter-room",
    name: "Starter private room",
    audience: "Free creator preview",
    defaultEntryPrice: "$0 demo",
    defaultAccessTier: "visitor",
    receiptPolicyId: "preview-pass",
    roomPolicy: {
      requiresReceipt: true,
      receiptScope: "room-entry",
      passDurationDays: 7,
      agentDecision: "allow-public-preview",
    },
    includedDrops: [
      { id: "starter-welcome", title: "Welcome thread preview", price: "included", access: "public" },
      { id: "starter-room-post", title: "First member post", price: "upgrade", access: "member" },
    ],
    blockedLiveActions: blockedRoomTemplateLiveActions,
  },
  {
    id: "paid-cohort",
    name: "Paid cohort room",
    audience: "Solo Pro creators",
    defaultEntryPrice: "$19/month",
    defaultAccessTier: "member",
    receiptPolicyId: "monthly-room-pass",
    roomPolicy: {
      requiresReceipt: true,
      receiptScope: "room-entry",
      passDurationDays: 30,
      agentDecision: "require-valid-room-pass",
    },
    includedDrops: [
      { id: "cohort-weekly-drop", title: "Weekly room-only drop", price: "included", access: "member" },
      { id: "cohort-paid-replay", title: "Paid replay archive", price: "$5", access: "paid-drop" },
    ],
    blockedLiveActions: blockedRoomTemplateLiveActions,
  },
  {
    id: "studio-drop-room",
    name: "Studio drop room",
    audience: "Teams and paid communities",
    defaultEntryPrice: "$79/month",
    defaultAccessTier: "studio",
    receiptPolicyId: "studio-member-pass",
    roomPolicy: {
      requiresReceipt: true,
      receiptScope: "room-entry-and-drops",
      passDurationDays: 30,
      agentDecision: "require-valid-room-pass-and-drop-receipt",
    },
    includedDrops: [
      { id: "studio-briefing", title: "Studio briefing feed", price: "included", access: "member" },
      { id: "studio-premium-drop", title: "Premium launch file", price: "$15", access: "paid-drop" },
    ],
    blockedLiveActions: blockedRoomTemplateLiveActions,
  },
] as const satisfies readonly CreatorRoomTemplate[];

export function canEnterRoom(pass: RoomPass, roomId: string, now: number): boolean {
  return pass.roomId === roomId && pass.expiresAt > now && (pass.tier === "member" || pass.tier === "studio");
}

export function canUnlockDrop(pass: RoomPass, roomId: string, drop: LockedDrop, now: number): boolean {
  if (drop.access === "public") return true;
  if (!canEnterRoom(pass, roomId, now)) return false;
  if (drop.access === "member") return true;
  return pass.paidDropIds.includes(drop.id);
}

export function findRoomForCreator(handle: string): CreatorRoom | undefined {
  return z0StudioRooms.find((room) => room.handle === handle);
}

export function templateRequiresSeparateDropReceipt(template: CreatorRoomTemplate): boolean {
  return template.roomPolicy.receiptScope === "room-entry-and-drops" || template.includedDrops.some((drop) => drop.access === "paid-drop");
}

export function templateAllowsTier(template: CreatorRoomTemplate, tier: RoomPass["tier"]): boolean {
  if (template.defaultAccessTier === "visitor") return tier === "visitor" || tier === "member" || tier === "studio";
  if (template.defaultAccessTier === "member") return tier === "member" || tier === "studio";
  return tier === "studio";
}

export const demoRoomPass: RoomPass = {
  roomId: "zero-studio-room",
  viewerId: "subscriber-8f2",
  tier: "member",
  paidDropIds: ["drop-alpha"],
  expiresAt: 1893456000000,
};
