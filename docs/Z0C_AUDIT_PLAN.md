# Z0C Audit Plan

Status: local draft plan only. This is not an independent audit, deployment
approval, security certification, token launch approval, or STRK20 compatibility
approval.

## Scope Before Cairo Contract Drafting

- Z0C ERC-20 representation source and dependency lock.
- Fixed-supply invariant inherited from the Zeero L1 monetary envelope.
- Decimal conversion from 8-decimal ZEERO L1 atomic units to 18-decimal Z0C
  units.
- Migration policy: burn-and-mint or lock-and-mint.
- Mint, burn, pause, upgrade, and admin authority.
- Replay protection for migration proofs or lock receipts.
- STRK20 pool and Wallet API compatibility for the selected target network.
- Deposit screening, selective disclosure, visible edge cases, and user-facing
  privacy copy.
- Failure handling for partial migration, duplicate migration, paused
  migration, and stale proof evidence.

## Required Review Outputs

- Reviewed threat model.
- Reviewed contract specification.
- Reviewed test plan.
- Reviewed source pins and package versions.
- Static analysis and unit test report.
- Migration invariant test report.
- STRK20 compatibility report.
- Manual wallet-flow review report before any user-facing checkout.
- Final independent-auditor report before deployment or minting.

## Explicitly Not Authorized

- Contract declaration or deployment.
- Token minting, transfers, approvals, or fees.
- Wallet connection, signing, balance reads, or transaction preparation.
- STRK20 shielding or private transfer.
- Bridge or migration deployment.
- Persistent checkout or room-access writes.
