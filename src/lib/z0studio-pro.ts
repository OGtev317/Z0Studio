export const zeeroStreamProPlans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "demo",
    audience: "Creator preview",
    features: ["Public profile", "Starter room preview", "Creator updates"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    cadence: "per month",
    audience: "Solo creators",
    features: ["Member rooms", "Room access", "Member updates"],
  },
  {
    id: "studio",
    name: "Studio",
    price: "$79",
    cadence: "per month",
    audience: "Teams and paid communities",
    features: ["Multiple rooms", "Member tiers", "Content drops"],
  },
] as const;

export const zeeroStreamProPaymentLanes = [
  {
    id: "privacy",
    label: "STRK20 shielded checkout",
    status: "primary",
    provider: "Starknet Wallet API",
    boundary: "Wallet-controlled privacy lane for room entry, locked drops, and creator payments.",
  },
  {
    id: "zpass",
    label: "Z0Pass access receipt",
    status: "local-review",
    provider: "Receipt-bound access policy",
    boundary: "Access evidence only; not a wallet secret, viewing key, note, or proof witness.",
  },
  {
    id: "social",
    label: "Optional social login",
    status: "non-core",
    provider: "thirdweb candidate",
    boundary: "Convenience lane only; not required for shielded checkout or Zeero security.",
  },
] as const;

export const zeeroStreamProBuildGates = [
  "Hackathon deployment remains frozen until judging results are announced on September 11, 2026.",
  "STRK20 shielded payments are the primary checkout direction; thirdweb checkout is not required.",
  "No wallet signing, token deployment, paid checkout activation, Cloudflare account mutation, or mainnet action is wired in this local build.",
  "Any Zeero L1 currency remains governed by Zeero L1 tokenomics, operator, network, verifier, DA, and economics evidence.",
] as const;
