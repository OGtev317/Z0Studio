# Z0C Migration Readiness Review

Status: local review artifact only. No Z0C contract, bridge, checkout,
wallet connection, STRK20 transaction, database write, or deployment is
authorized by this document.

## Purpose

This review is the gate between Z0C tokenomics and any future Cairo ERC-20
representation drafting. It requires the migration mechanism, Starknet target
network, STRK20 compatibility evidence, contract control model, and audit plan
to be reviewed before Z0Studio treats Z0C as contract-draft-ready.

## Current Result

The current local template is **not ready** for Cairo contract drafting.

Blocked items:

- Migration policy is not selected.
- Starknet target network is not selected.
- STRK20 freshness is not current; the 2026-09-10 quick check reported version
  and page drift, so primary sources must be re-read before changing pins or
  wallet/API status.
- STRK20 pool, Wallet API, private-transfer, disclosure, and screening
  compatibility are not reviewed.
- Contract mint, burn, pause, and upgrade authority are not reviewed.
- Audit plan is not attached to the active tokenomics decision.

## Migration Options

### Burn And Mint

Best fit for preserving supply because one representation must be destroyed
before another exists. It still needs a reviewed Zeero L1 burn proof or finality
signal, exact replay domain, mint cap tied to burned L1 atomic units, and
redemption failure handling.

### Lock And Mint

Useful only if reversible movement between Zeero L1 and Starknet is required.
It adds custody and bridge-control risk, so it needs audited lock custody,
unlock rules, proof that locked units equal outstanding Z0C units, and an
operator compromise and pause recovery plan.

## STRK20 Compatibility Boundary

Z0C would be a standard Starknet ERC-20 representation. STRK20 may later provide
wallet-controlled shielding and private transfers only after Z0Studio verifies:

- current STRK20 source and package facts;
- compatible pool and target network;
- wallet Wallet API support;
- private transfer behavior for the ERC-20;
- deposit screening expectations;
- selective-disclosure expectations; and
- visible edges such as deposits, withdrawals, open-note amounts, and timing.

Z0Studio must not ask users for viewing keys, note material, private witnesses,
seed phrases, private keys, or wallet signing material.

## Local Code Gate

The local helper is `src/lib/z0c-migration-review.ts`.

It exposes:

- `z0cMigrationReadinessReviewTemplate`;
- `z0cMigrationRouteSummaries`;
- `validateZ0CMigrationReadinessReview`;
- `getZ0CMigrationMechanismRecommendation`; and
- `getZ0CRepresentationContractDraftReadiness`.

The full readiness gate can unlock only local Cairo representation drafting.
Deployment, minting, wallet signing, STRK20 transactions, bridge deployment,
database writes, and checkout activation remain blocked.
