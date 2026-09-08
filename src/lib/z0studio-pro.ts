export const zeeroStreamProPlans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "demo",
    audience: "Creator preview",
    features: ["Public profile", "Local receipt demo", "One private room preview"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    cadence: "per month",
    audience: "Solo creators",
    features: ["Private rooms", "Receipt-bound access", "ZeeroAgent access rules"],
  },
  {
    id: "studio",
    name: "Studio",
    price: "$79",
    cadence: "per month",
    audience: "Teams and paid communities",
    features: ["Multiple rooms", "Supporter tiers", "Exportable access evidence"],
  },
] as const;

export const zeeroStreamProPaymentLanes = [
  {
    id: "card",
    label: "Card checkout",
    status: "ready-to-wire",
    provider: "thirdweb Payments or Stripe checkout",
    boundary: "Revenue lane only; does not create Zeero L1 currency or settlement evidence.",
  },
  {
    id: "zpro",
    label: "ZPRO app credit",
    status: "design-gated",
    provider: "thirdweb ERC-20 tooling candidate",
    boundary: "App credit only; not the Zeero L1 native asset and no migration promise.",
  },
  {
    id: "privacy",
    label: "STRK20 private checkout",
    status: "explicit-approval-required",
    provider: "Existing guarded wallet flow",
    boundary: "Wallet-controlled and separate from Pro subscription checkout.",
  },
] as const;

export const zeeroStreamProBuildGates = [
  "Hackathon deployment remains frozen until judging results are announced on September 11, 2026.",
  "This Z0Studio copy may use thirdweb for login and checkout UX, but thirdweb is not Zeero consensus, proof, DA, settlement, or L1 monetary policy.",
  "No wallet signing, token deployment, paid checkout activation, Cloudflare account mutation, or mainnet action is wired in this local build.",
  "Any Zeero L1 currency remains governed by Zeero L1 tokenomics, operator, network, verifier, DA, and economics evidence.",
] as const;
