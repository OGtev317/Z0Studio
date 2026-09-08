# ZeeroStream Pro

ZeeroStream Pro is the paid creator product copy split from the hackathon
ZeeroStream artifact. The public hackathon deployment remains frozen until
results are announced on September 11, 2026. This workspace is for building the
Pro path: creator rooms, paid access, receipt-bound entitlements, ZeeroAgent
policy logic, and gated payment/login integrations.

Public demo: [zeerostream.pages.dev](https://zeerostream.pages.dev)

Local Pro route: `/pro`

## Product boundary

- thirdweb is a candidate for social login, embedded wallet UX, checkout, and
  optional ZPRO app-credit tooling.
- thirdweb is not Zeero consensus, proving, DA, settlement, verifier authority,
  L1 monetary policy, or decentralization evidence.
- ZPRO, if launched, is an app credit for ZeeroStream Pro only. It is not the
  Zeero L1 native currency and carries no migration promise.
- STRK20 wallet actions remain guarded and separate from Pro subscription
  checkout.
- This repository copy does not deploy, sign, create tokens, mutate Cloudflare
  account state, or process live payments without explicit operator action.

Operator guides: [Mainnet payment runbook](docs/MAINNET_PAYMENT_RUNBOOK.md) ·
[three-minute demo script](docs/DEMO_SCRIPT.md) ·
[private messaging and subscription plan](docs/PRIVATE_MESSAGING_SUBSCRIPTION_PLAN.md)

## Judge path

Start at the live demo, open the Receipt Room section, then inspect
`/strk20.json`. The receipt room is intentionally public and local-only: it
does not ask for viewing keys, private balances, note material, witness values,
or a new wallet signature. It packages the already-verified Mainnet evidence
into a creator-facing workflow so the privacy boundary is clear without
requiring judges to run a wallet.

The Home feed supports browser-local public posts for non-private creator
material. A globally shared live feed should add server-side storage,
moderation, rate limits, and the same private-material rejection before any
cross-user publishing is enabled.

This repository now includes the first backend step for that path:
`/api/feed` as a Cloudflare Pages Function and `migrations/0001_public_feed.sql`
for D1. Without a `ZEEROSTREAM_FEED_DB` binding, the function reports
`local-fallback` and serves seeded public posts while the UI keeps new posts
browser-local. Once a D1 database is created, bind it as
`ZEEROSTREAM_FEED_DB`, apply the migration, redeploy, and the same feed
composer will publish shared public posts through server-side filtering and a
per-handle rate limit.

## Competition MVP

- Wallet API capability detection without a private-balance probe.
- Strict `SN_MAIN` connection and reviewed STRK20 V2 pool/class verification.
- Pool-native shield, private-transfer, and withdrawal actions for STRK.
- Exact decimal parsing without JavaScript floating-point arithmetic.
- Optional `.stark` name resolution through Starknet.js. Wallet connection is
  the login; a public name is only a display and recipient alias.
- Mandatory wallet dry-run before the signature button is enabled.
- Exact network, pool, token, amount, recipient, and live-read pool-fee review.
- Explicit user acknowledgement and wallet-controlled Mainnet submission.
- Receipt verification requiring success and an event from the reviewed pool.
- Browser-local recovery that separates submitted hashes from receipts already
  confirmed as accepted, successful, and pool-touching by the configured RPC.
- Private Creator Receipt Room that turns the three Mainnet receipts into a
  judge-facing creator workflow: receipt inspector, public evidence pack, and a
  local selective access pass that discloses tier, audience, expiry, and receipt
  binding only.
- Public-only creator feed composer for non-private updates, with client-side
  rejection of keys, viewing keys, witness labels, private balances, and memo
  plaintext before local display.
- Optional Cloudflare Pages Function for `/api/feed` with D1-backed shared
  public posts. Server-side validation applies the same public-only rules before
  a post can be stored.
- A minimal three-receipt operating route: creator shield, client shield, then
  one private creator payment after note maturity.
- A root `strk20.json` and static Cloudflare Pages deployment.

The live Mainnet pool is
`0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`.
Deposits and withdrawals are public. Transfers inside the pool hide the
pool-side sender, recipient, amount, and spent notes; timing remains observable.

## Post-hackathon roadmap

The repository preserves experimental escrow, subscription, Passport, tier,
custom-ZK, encrypted-messaging, and Oyster/TEE work, but none of it is part of
the competition MVP or advertised as live. Custom contracts remain deployment-
gated pending independent review and production governance inputs.

The next product wedge is encrypted payment memos and private pool-participant
mail, followed by escrow negotiation and prepaid subscriptions. The staged
helper, indexer, SDK, wallet, and audit gates are captured in
[the private messaging and subscription plan](docs/PRIVATE_MESSAGING_SUBSCRIPTION_PLAN.md).

No Oyster job has been deployed. A future live TEE claim requires a reproducible
immutable workload image, matching image ID, a real Oyster job, raw Nitro
attestation verification including the AWS root and certificate chain,
measurements, freshness, and workload-bound `user_data`. Any TEE result remains
optional and non-authoritative for settlement.

The hosted Starknet ID API is not an authentication service and is not required
by Z. The wallet proves account control by approving the connection and
signs every transaction itself.

## Run locally

```zsh
npm install
npm test
npm run typecheck
npm run build
npm run verify:starknet-health
npm run verify:strk20-pool # expected to fail closed until source reproduction
npm run verify:strk20-mainnet # read-only Mainnet V2 health and class gate
npm run verify:hackathon-submission # fails until hashes and video are complete
npm run review:mainnet-deployment # expected to fail until public review inputs are complete
npm run proof:verify
# npm run compute:verify requires Scarb 2.17.0 and snforge 0.59.0
npm run dev
```

Open `http://localhost:3000`.

`npm run build` also writes the deployable static site to `out/`. The public
deployment includes `/strk20.json`; its empty transaction, contract, and video
fields are deliberate until verified Mainnet evidence exists.

To test the optional Pages Function locally after a build, run Wrangler Pages
against `out/` with a D1 binding. Create and bind the database only after
explicit operator approval because it changes Cloudflare account state:

```zsh
npx wrangler d1 create zeerostream-feed
npx wrangler d1 migrations apply zeerostream-feed
# Add the returned D1 binding to wrangler.jsonc as ZEEROSTREAM_FEED_DB.
npm run build
npx wrangler pages dev out --d1 ZEEROSTREAM_FEED_DB=<database_id>
```

## Contract direction

`contracts/` contains a stateful Cairo anonymizer draft with a
pool-only `privacy_invoke`, balance accounting, cryptographic receipt-based role
authorization, direct-ZK compute resolution, bounded prepaid subscriptions, tier
proof consumption, and one reviewed `OpenNoteDeposit` return per valid claim.
Thirty-six escrow-package contract tests run locally. The generated Garaga
verifier validates the synthetic dispute proof on a read-only Sepolia fork and
now drives the real `GigstarkComputeVerifier` in an integration test. Independent
review, production proving setup, an Oyster image/attestation receipt,
issuer/attestor governance, live Wallet API execution, and the live pool's
upgraded class source provenance remain unresolved. The live ABI and onchain
Sierra/CASM pair reproduce exactly, and the declaration timeline narrows the
source candidate to StarkWare commit `5bf8aae`, but its repository-defined build
profiles do not reproduce the on-chain class hash.
The interface itself is exactly mapped to
`@starkware-libs/starknet-privacy-sdk@0.14.3-rc.5`; that ABI-level result does
not unlock live submission without the matching reviewed Cairo source tree,
lockfile, and effective build profile.
Independent security review and fresh network verification are required before
any declaration or deployment.

`npm run verify:strk20-artifacts` uses an already-installed exact compiler when
available. On Intel or Apple Silicon macOS it otherwise downloads the official
`universal-sierra-compiler 2.8.0` release into a temporary directory and verifies
its pinned SHA-256 digest before execution.

`npm run verify:cairo-release` independently downloads checksum-pinned Scarb
2.17.0 and Starknet Foundry 0.59.0 archives, builds only committed contract
sources in a temporary release workspace, runs the Cairo tests, and writes a
deployment-disabled review manifest for each network lane to
`release/gigstark-sepolia-review.json` and
`release/gigstark-mainnet-review.json`. The Mainnet manifest pins the
source-reproduced V2 pool but deliberately leaves every constructor argument
unset and unreviewed.

Read [the architecture handoff](docs/ARCHITECTURE.md) before beginning that integration.
Track implementation status and release gates in the dedicated [Z roadmap](ROADMAP.md).
Review the [compute specimen](compute/README.md) and its explicit hardware and
test-ceremony boundaries before treating it as deployable.
Review the explicit trust assumptions and blockers in the
[internal security review](docs/SECURITY_REVIEW.md); it is not an independent audit.

## Repository hygiene

`.gitignore` excludes environment files and local agent/chat artifacts. This repository contains no conversation transcript and should not be used to store one.
