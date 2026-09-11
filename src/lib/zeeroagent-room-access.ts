import { decideZSocialAccess } from "./z-social-graph-demo";
import {
  canEnterRoom,
  canUnlockDrop,
  type CreatorRoom,
  type LockedDrop,
  type RoomPass,
} from "./z0studio-rooms";

export type Z0StudioRoomAccessStatus = "available" | "join-required" | "review-required" | "unavailable";

export type Z0StudioRoomAccessDecision = {
  status: Z0StudioRoomAccessStatus;
  canViewRoom: boolean;
  canViewDrop: boolean;
  message: string;
  policyVersion: "z0studio-room-access-v1";
  mode: "local-policy-adapter";
};

export type Z0StudioRoomAccessInput = {
  viewerId: string;
  room: CreatorRoom;
  pass?: RoomPass;
  drop?: LockedDrop;
  now: number;
};

const INVALID_ACCESS = {
  status: "unavailable",
  canViewRoom: false,
  canViewDrop: false,
  message: "We could not confirm access to this room.",
  policyVersion: "z0studio-room-access-v1",
  mode: "local-policy-adapter",
} as const satisfies Z0StudioRoomAccessDecision;

function isViewerAlias(value: string): boolean {
  return /^[a-zA-Z0-9-]{1,64}$/.test(value);
}

function hasEligibleRoomPass(viewerId: string, roomId: string, pass: RoomPass | undefined, now: number): pass is RoomPass {
  return Boolean(pass && pass.viewerId === viewerId && canEnterRoom(pass, roomId, now));
}

export function evaluateZ0StudioRoomAccess(input: Z0StudioRoomAccessInput): Z0StudioRoomAccessDecision {
  const viewerId = input.viewerId.trim().toLowerCase();
  if (!isViewerAlias(viewerId)) return INVALID_ACCESS;

  const agentDecision = decideZSocialAccess(viewerId);
  if (agentDecision.status === "blocked") {
    return {
      ...INVALID_ACCESS,
      message: "This room is not available to this account.",
    };
  }

  const roomPass = hasEligibleRoomPass(viewerId, input.room.id, input.pass, input.now) ? input.pass : undefined;
  if (agentDecision.status !== "allowed") {
    return {
      status: "review-required",
      canViewRoom: false,
      canViewDrop: false,
      message: roomPass ? "Your access needs creator review." : "Join this room to request access.",
      policyVersion: "z0studio-room-access-v1",
      mode: "local-policy-adapter",
    };
  }

  if (!roomPass) {
    return {
      status: "join-required",
      canViewRoom: false,
      canViewDrop: false,
      message: "Member posts and replies open when you join this room.",
      policyVersion: "z0studio-room-access-v1",
      mode: "local-policy-adapter",
    };
  }

  const canViewDrop = input.drop ? canUnlockDrop(roomPass, input.room.id, input.drop, input.now) : false;
  return {
    status: "available",
    canViewRoom: true,
    canViewDrop,
    message: "",
    policyVersion: "z0studio-room-access-v1",
    mode: "local-policy-adapter",
  };
}
