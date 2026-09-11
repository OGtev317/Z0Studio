# Z0C Tokenomics Decision

Status: partially inherited from the local Zeero L1 handoff. This document does
not create a token policy or launch an asset. It records the remaining decisions
before local Cairo ERC-20 drafting can begin.

## Decisions Required

| Decision | Allowed choices | Current value |
| --- | --- | --- |
| Canonical asset | Starknet ERC-20 or Zeero-native asset | Zeero-native, local design candidate |
| Supply policy | Fixed, capped, or governed | Fixed 50,000,000 ZEERO hard cap |
| Issuance authority | None, earned protocol issuance, or timelocked governance | Earned protocol issuance |
| Treasury custody | No premine/reserve, multisig, or timelocked governance | No premine or insider reserve |
| Migration policy | Burn-and-mint or lock-and-mint | Not selected |
| Starknet network | Sepolia or Mainnet | Not selected |
| Allocation policy | Separate reviewed document | `docs/Z0C_ALLOCATION_POLICY.md` |
| Audit plan | Separate reviewed document | Not selected |

## Interpretation

- **Zeero-native canonical:** the local L1 envelope names ZEERO as the
  intended canonical asset. A future Starknet ERC-20 is only a representation
  and cannot claim independent supply.
- **Fixed supply:** the inherited L1 envelope caps total ZEERO at 50,000,000.
  Candidate issuance is earned protocol issuance, not a discretionary ERC-20
  mint authority.
- **Capped or governed supply:** any issuance authority must be constrained by
  a reviewed, time-delayed governance policy.
- **Burn-and-mint:** one representation is destroyed before the other is
  created. **Lock-and-mint:** one representation is held under reviewed bridge
  controls while the other is created. Neither is implemented by this project.

## Contract-Drafting Gate

The local `z0c-tokenomics` validator has the inherited L1 envelope prefilled.
It still rejects Cairo contract drafting until migration, target network, and
audit plan are reviewed and the fixed-supply representation remains consistent.

The broader contract-drafting gate is `docs/Z0C_MIGRATION_READINESS_REVIEW.md`.
It adds STRK20 freshness, pool compatibility, Wallet API compatibility,
private-transfer compatibility, disclosure/screening review, and contract
authority review before any local Cairo representation draft can start.

This gate does not authorize token declaration, deployment, minting, wallet
signing, STRK20 use, a bridge, or a database write.
