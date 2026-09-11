import type { RoomCustomization } from "./z0studio-room-customization";
import type { Z0StudioRoomAccessStatus } from "./zeeroagent-room-access";

export type MemberRoomState = "none" | "pending" | "active" | "blocked" | "removed" | "owned";

export type RoomReadinessInput = {
  room: {
    creator: string;
    handle: string;
    name?: string;
    focus?: string;
    theme?: string;
    entryLabel?: string;
    entryPrice?: string;
    members?: number;
    feedTitle?: string;
    feedBody?: string;
    lockedDrops?: readonly { access?: string; price?: string; title?: string }[];
    customization?: Partial<Pick<RoomCustomization, "welcomeNote" | "postingCadence" | "roomRules">>;
  };
  memberState?: MemberRoomState;
  accessStatus?: Z0StudioRoomAccessStatus;
  ownsRoom?: boolean;
};

export type RoomReadinessPanel = {
  roomTitle: string;
  ownerLabel: string;
  contains: readonly string[];
  accessLabel: string;
  nextAction: string;
  canEnter: boolean;
  canRequestAccess: boolean;
};

function cleanText(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text.length > 0 ? text : fallback;
}

function hasPaidDrop(room: RoomReadinessInput["room"]): boolean {
  return (room.lockedDrops ?? []).some((drop) => drop.access === "paid-drop" || /^\$\d+/.test(String(drop.price ?? "")));
}

function roomContains(room: RoomReadinessInput["room"]): string[] {
  const contains = [
    cleanText(room.feedTitle ?? room.theme, "Member room"),
    cleanText(room.customization?.postingCadence, "Creator updates"),
  ];
  if (room.lockedDrops?.some((drop) => drop.access === "member")) contains.push("Member extras");
  if (hasPaidDrop(room)) contains.push("Locked drops");
  return [...new Set(contains)].slice(0, 4);
}

function accessLabel(memberState: MemberRoomState | undefined, accessStatus: Z0StudioRoomAccessStatus | undefined, ownsRoom: boolean): string {
  if (ownsRoom || memberState === "owned") return "Creator access";
  if (memberState === "active" || accessStatus === "available") return "Ready to enter";
  if (memberState === "pending") return "Request pending";
  if (memberState === "blocked" || accessStatus === "unavailable") return "Access unavailable";
  if (memberState === "removed") return "Access removed";
  if (accessStatus === "review-required") return "Creator review needed";
  return "Membership needed";
}

function nextAction(input: RoomReadinessInput, label: string): string {
  if (input.ownsRoom || input.memberState === "owned") return "Open the room and manage posts from your creator workspace.";
  if (input.memberState === "active" || input.accessStatus === "available") return "Open the room to read member posts and replies.";
  if (input.memberState === "pending") return "Wait for creator approval before opening the room.";
  if (input.memberState === "blocked" || input.accessStatus === "unavailable") return "Choose another room or contact support from your account.";
  if (input.memberState === "removed") return "Request a fresh invite before trying to rejoin.";
  if (input.accessStatus === "review-required") return "Request access so the creator can review your account.";
  return `Request access with ${label}.`;
}

export function buildMemberRoomReadinessPanel(input: RoomReadinessInput): RoomReadinessPanel {
  const room = input.room;
  const ownsRoom = Boolean(input.ownsRoom);
  const memberState = ownsRoom ? "owned" : input.memberState ?? "none";
  const entry = cleanText(room.entryLabel ?? room.entryPrice, "Request access");
  const label = accessLabel(memberState, input.accessStatus, ownsRoom);
  return Object.freeze({
    roomTitle: cleanText(room.name ?? room.creator, "Creator room"),
    ownerLabel: `${cleanText(room.creator, "Creator")} @${cleanText(room.handle, "creator")}`,
    contains: Object.freeze(roomContains(room)),
    accessLabel: label,
    nextAction: nextAction({ ...input, memberState }, entry),
    canEnter: ownsRoom || memberState === "active" || input.accessStatus === "available",
    canRequestAccess: !ownsRoom && memberState === "none" && input.accessStatus !== "unavailable",
  });
}
