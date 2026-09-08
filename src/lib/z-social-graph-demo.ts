export type ZSocialGraphEventKind =
  | "follow-request"
  | "follow-accept"
  | "follow-block"
  | "permission-edge"
  | "feed-delivery";

export type ZSocialGraphEvent = {
  id: string;
  kind: ZSocialGraphEventKind;
  actor: string;
  target: string;
  label: string;
  visibleClaim: string;
};

export type ZSocialGraphSnapshot = {
  mode: "static-demo";
  source: "ZeeroAgentMVP z-social graph";
  publicSocialNetworkVerified: false;
  acceptedFollowers: number;
  blockedFollowers: number;
  feedDeliveries: number;
  hiddenFields: readonly string[];
  events: readonly ZSocialGraphEvent[];
};

export type ZSocialAccessDecision = {
  viewer: string;
  status: "allowed" | "blocked" | "review";
  reason: string;
  visibleFields: readonly string[];
  hiddenFields: readonly string[];
};

export const zSocialGraphEvents = [
  {
    id: "zsg-001",
    kind: "follow-request",
    actor: "subscriber-8f2",
    target: "zero-studio",
    label: "Supporter asks for Studio access",
    visibleClaim: "Access request exists; wallet identity stays hidden.",
  },
  {
    id: "zsg-002",
    kind: "follow-accept",
    actor: "zero-studio",
    target: "subscriber-8f2",
    label: "Creator accepts the supporter",
    visibleClaim: "Accepted audience edge can unlock the creator room.",
  },
  {
    id: "zsg-003",
    kind: "follow-block",
    actor: "zero-studio",
    target: "subscriber-c70",
    label: "Creator blocks one viewer",
    visibleClaim: "Blocked viewers are excluded before feed delivery.",
  },
  {
    id: "zsg-004",
    kind: "permission-edge",
    actor: "zero-studio",
    target: "studio-feed",
    label: "Receipt-bound Studio permission",
    visibleClaim: "Tier, audience, expiry, and receipt binding are enough.",
  },
  {
    id: "zsg-005",
    kind: "feed-delivery",
    actor: "studio-feed",
    target: "subscriber-8f2",
    label: "Private drop delivered",
    visibleClaim: "Delivery follows the accepted edge, not a public wallet scan.",
  },
] as const satisfies readonly ZSocialGraphEvent[];

export const zSocialGraphSnapshot = {
  mode: "static-demo",
  source: "ZeeroAgentMVP z-social graph",
  publicSocialNetworkVerified: false,
  acceptedFollowers: 1,
  blockedFollowers: 1,
  feedDeliveries: 1,
  hiddenFields: [
    "wallet address",
    "wallet history",
    "private notes",
    "memo plaintext",
    "proof witness",
    "raw graph signatures",
  ],
  events: zSocialGraphEvents,
} as const satisfies ZSocialGraphSnapshot;

export function deliveredTargets(events: readonly ZSocialGraphEvent[] = zSocialGraphEvents): string[] {
  return events.filter((event) => event.kind === "feed-delivery").map((event) => event.target);
}

export function blockedTargets(events: readonly ZSocialGraphEvent[] = zSocialGraphEvents): string[] {
  return events.filter((event) => event.kind === "follow-block").map((event) => event.target);
}

export function assertZSocialGraphDemoSafe(snapshot: ZSocialGraphSnapshot = zSocialGraphSnapshot): true {
  if (snapshot.publicSocialNetworkVerified !== false) throw new Error("PUBLIC_SOCIAL_NETWORK_CLAIM_FORBIDDEN");
  const delivered = new Set(deliveredTargets(snapshot.events));
  const blocked = blockedTargets(snapshot.events);
  if (blocked.some((viewer) => delivered.has(viewer))) throw new Error("BLOCKED_VIEWER_DELIVERED");
  if (!snapshot.hiddenFields.includes("raw graph signatures")) throw new Error("RAW_SIGNATURE_BOUNDARY_MISSING");
  if (!snapshot.hiddenFields.includes("proof witness")) throw new Error("PROOF_WITNESS_BOUNDARY_MISSING");
  return true;
}

export function decideZSocialAccess(viewer: string, snapshot: ZSocialGraphSnapshot = zSocialGraphSnapshot): ZSocialAccessDecision {
  assertZSocialGraphDemoSafe(snapshot);
  const normalizedViewer = viewer.trim().toLowerCase();
  const accepted = snapshot.events.some((event) => event.kind === "follow-accept" && event.target === normalizedViewer);
  const blocked = snapshot.events.some((event) => event.kind === "follow-block" && event.target === normalizedViewer);
  if (blocked) {
    return {
      viewer: normalizedViewer,
      status: "blocked",
      reason: "Creator block edge prevents feed delivery before any receipt check.",
      visibleFields: ["viewer alias", "blocked access state"],
      hiddenFields: snapshot.hiddenFields,
    };
  }
  if (accepted) {
    return {
      viewer: normalizedViewer,
      status: "allowed",
      reason: "Accepted graph edge can unlock receipt-bound creator access.",
      visibleFields: ["viewer alias", "accepted access state", "receipt-bound tier"],
      hiddenFields: snapshot.hiddenFields,
    };
  }
  return {
    viewer: normalizedViewer || "unknown-viewer",
    status: "review",
    reason: "No accepted or blocked edge exists in the demo graph.",
    visibleFields: ["viewer alias", "review state"],
    hiddenFields: snapshot.hiddenFields,
  };
}
