# Z0C Representation Review

Status: local review artifact. No bridge, representation contract, wallet
action, balance, or migration state exists.

## Purpose

Z0C is planned as a non-canonical Starknet-facing representation of the local
ZEERO monetary envelope. This review keeps a future representation from
creating independent monetary supply.

## Required Invariants

- The source envelope is `ZEERO_L1_FIXED_SUPPLY_TOKENOMICS_V1`.
- ZEERO remains the intended canonical monetary asset.
- The maximum supply is 50,000,000 ZEERO, or 5,000,000,000,000,000 L1 atomic
  units.
- One L1 atomic unit maps to exactly 10,000,000,000 Z0C units.
- Outstanding Z0C units must equal the exact conversion of the declared L1
  backing amount and must not exceed the inherited cap.
- No Z0C amount used for future checkout may use fractional value below one L1
  atomic unit.
- The representation has no independent allocation or discretionary issuance.

## Still Required

1. Choose and review a supply-preserving migration mechanism: lock-and-mint or
   burn-and-mint.
2. Choose a Starknet target network.
3. Verify STRK20 compatibility for the reviewed ERC-20 implementation.
4. Audit the representation contract and its migration controls.
5. Obtain separate explicit authorization before any deployment, wallet action,
   transaction, or persistent state change.

The local `validateZ0CRepresentationSupplyInvariant` helper verifies only the
unit and supply arithmetic. It is not on-chain verification and cannot establish
that any supply is locked, burned, minted, or backed.

The full pre-contract gate is now `docs/Z0C_MIGRATION_READINESS_REVIEW.md` and
`src/lib/z0c-migration-review.ts`. That gate keeps local Cairo contract drafting
blocked until migration policy, target network, STRK20 compatibility, contract
authority, and audit-plan evidence are all reviewed.
