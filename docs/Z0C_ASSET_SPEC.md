# Z0C Asset Specification

Status: local design artifact only. Z0C is not deployed, mintable, tradable,
bridgeable, or usable for checkout. It inherits the local Zeero L1 monetary
envelope; neither representation is launched.

## Identity

- Name: ZeeroCash
- Symbol: Z0C
- Display precision: 18 decimals
- Product role: future Z0Studio display and payment representation of ZEERO
- Starknet representation: planned standard ERC-20, with no selected contract
  address or target network
- Canonical monetary asset: ZEERO, a Zeero L1 design candidate
- Zeero representation: local design candidate, not launched

## Inherited Zeero L1 Envelope

Z0C inherits `ZEERO_L1_FIXED_SUPPLY_TOKENOMICS_V1` from the Zeero L1 handoff.
That local-only model sets a hard cap of **50,000,000 ZEERO**, with earned
protocol issuance, no premine, and no insider allocation. It models a candidate
210,000-block halving cadence. It does not authorize a token launch, genesis
mint, reward activation, or a live economics claim.

The core model uses 8 decimal atomic units. Z0C uses 18 display decimals for a
future Starknet ERC-20 representation, so one Zeero L1 atomic unit maps exactly
to `10,000,000,000` Z0C units in local arithmetic. This is a representation
rule only, not a bridge, redemption, or minting mechanism.

Any future Z0Studio payment intent must use a Z0C amount that maps exactly to a
Zeero L1 atomic unit. The local implementation also rejects an outstanding Z0C
representation amount that is not exactly backed by its declared Zeero L1
atomic-unit amount. These are pre-contract safety checks, not balance tracking
or proof of backing.

Z0C is not a separate STRK20 token type. The planned `Z0C-STRK` representation
would be a standard Starknet ERC-20. STRK20 may later provide wallet-controlled
shielding and private transfers after pool and wallet compatibility are verified.

## Canonical-Asset Rule

ZEERO is the intended canonical monetary asset under the local L1 model. A
future Starknet ERC-20 using the Z0C display symbol is non-canonical and must
not create independent supply, allocation, or issuance authority.

No bridge, redemption, contract mint authority, treasury custody, or fee policy
is implemented by this artifact. The migration mechanism, Starknet target,
compatibility evidence, and audit plan are still unselected or unverified.

## Z0Studio Payment Model

The intended payment sequence is:

1. A creator defines a room, locked drop, or tip price in Z0C.
2. The fan's compatible wallet prepares the privacy action; Z0Studio never
   receives viewing keys, private notes, or signing material.
3. Once the ERC-20 contract, pool compatibility, creator recipient, and wallet
   capability are reviewed, the wallet may request approval and a shielded
   transfer.
4. Z0Studio records an access outcome only after a separately reviewed payment
   confirmation design exists.

This sequence is design-only. The current application exposes no Z0C checkout,
wallet connect, token address, transaction preparation, signature request, or
database write.

## Privacy Boundaries

Private movement inside STRK20 is intended to hide the payer, recipient, token,
amount, and spent notes from public observers. Shielding and unshielding are
public ERC-20 edges, including timing. New tokens with limited use have a small
anonymity set; token creation alone does not create meaningful privacy.

Deposit screening and the protocol's selective-disclosure model still apply.
Z0Studio must describe the product as private by default and disclosable when
required, never as anonymous or untraceable.

## Required Before Contract Work

- Pass the local migration-readiness gate in
  `docs/Z0C_MIGRATION_READINESS_REVIEW.md`.
- Reviewed migration mechanism that preserves the inherited supply envelope.
- Target Starknet network and a verified compatible STRK20 pool.
- Contract mint, burn, pause, and upgrade authority model consistent with no
  independent Z0C issuance.
- Audit scope for the ERC-20 and future bridge or migration contract.
- Legal, compliance, and disclosure review.

## Explicitly Blocked

- Token deployment or declaration.
- Token minting, transfer, approval, or fee collection.
- Wallet connection, signing, balance reads, or transaction preparation.
- STRK20 shielding or private transfer.
- Bridge or migration deployment.
- Persistent checkout or access-state writes.
