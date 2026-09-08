export type RoomAccessLevel = "public" | "member" | "paid-drop";

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
    theme: "private build logs",
    entryPrice: "$9/month",
    members: 142,
    feedTitle: "Studio member feed",
    feedBody: "Members see launch notes, private drops, polls, and creator replies after ZeeroAgent validates room access.",
    lockedDrops: [
      { id: "drop-alpha", title: "Prototype breakdown", price: "$4", access: "paid-drop" },
      { id: "drop-room", title: "Member Q&A replay", price: "included", access: "member" },
    ],
  },
  {
    id: "proof-cafe-room",
    creator: "Proof Cafe",
    handle: "proof-cafe",
    theme: "private proof explainers",
    entryPrice: "$5/month",
    members: 208,
    feedTitle: "Supporter proof room",
    feedBody: "Supporters get room-only threads, compact research notes, and unlockable deep dives.",
    lockedDrops: [
      { id: "drop-deep-dive", title: "Nullifier deep dive", price: "$7", access: "paid-drop" },
      { id: "drop-notes", title: "Weekly notes", price: "included", access: "member" },
    ],
  },
] as const satisfies readonly CreatorRoom[];

export function canEnterRoom(pass: RoomPass, roomId: string, now: number): boolean {
  return pass.roomId === roomId && pass.expiresAt > now && (pass.tier === "member" || pass.tier === "studio");
}

export function canUnlockDrop(pass: RoomPass, roomId: string, drop: LockedDrop, now: number): boolean {
  if (drop.access === "public") return true;
  if (!canEnterRoom(pass, roomId, now)) return false;
  if (drop.access === "member") return true;
  return pass.paidDropIds.includes(drop.id);
}

export const demoRoomPass: RoomPass = {
  roomId: "zero-studio-room",
  viewerId: "subscriber-8f2",
  tier: "member",
  paidDropIds: ["drop-alpha"],
  expiresAt: 1893456000000,
};
