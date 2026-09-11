export type MemberPassState = "pending" | "active" | "blocked" | "removed";

export type MemberPassStateDetails = {
  badge: string;
  label: string;
  explanation: string;
  actionLabel: string;
};

const stateDetails: Record<MemberPassState, MemberPassStateDetails> = {
  pending: {
    badge: "WAIT",
    label: "Request pending",
    explanation: "Your request is waiting for the creator to review it.",
    actionLabel: "View request",
  },
  active: {
    badge: "PASS",
    label: "Access active",
    explanation: "You can open this room and read member posts.",
    actionLabel: "Open room",
  },
  blocked: {
    badge: "HOLD",
    label: "Access unavailable",
    explanation: "This room is not available to this account.",
    actionLabel: "View room",
  },
  removed: {
    badge: "PAST",
    label: "Access removed",
    explanation: "Your previous room access has been removed.",
    actionLabel: "View room",
  },
};

export function getMemberPassStateDetails(state: MemberPassState): MemberPassStateDetails {
  return stateDetails[state];
}
