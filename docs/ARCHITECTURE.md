# ZeeroStream architecture and integration boundary

## Scope

ZeeroStream is a Starknet/STRK20 project. It does not use, call, deploy to, or anchor anything on Athera L1 or L3. The receipt-anchor idea is intentionally deferred; it must not become a pretext for storing identities, amounts, delivery content, or evidence on another chain.

## Strategic center: ZK settlement plus an Oyster receipt

The two verification systems have deliberately unequal authority:

```text
private witness + public escrow statement
                  |
                  v
        canonical dispute circuit
                  |
          BN254 Groth16 proof
                  |
                  v
     policy-pinned Garaga verifier
                  |
       exact eight-signal comparison
                  |
       replay-safe Cairo settlement
                  |
                  v
       GigstarkEscrow -> STRK20 note

optional parallel evidence lane:
same workload -> Oyster CVM -> raw Nitro attestation
             -> image ID + recency + user_data verification
             -> hash-only receipt reference on Starknet
```

The ZK proof is the only authority that selects buyer or seller. The Oyster
lane supplies a hardware-rooted, independently verifiable claim about the
program image and bound result, but the receipt is optional and cannot block,
authorize, or override settlement. This avoids turning Oyster availability or
AWS Nitro operations into consensus for the hackathon contract.

The policy pins the audience, program commitment, computation-policy hash,
score threshold, validity window, and Groth16 verifier contract. The result
contains job/input/evidence/result commitments, outcome, expiry, and an optional
raw-attestation bundle commitment. Cairo derives its replay nullifier from the
result fields and compares every returned public input before mutating state.

For Oyster review, Cairo computes `GIG_OYSTER_BIND_V1` over the chain, verifier,
policy, audience, job, input, evidence, result, outcome, and expiry. That felt is
encoded as 32-byte big-endian `user_data` in the attestation. Offchain review
must verify the AWS Nitro root, recency, expected Oyster image ID/measurements,
architecture, and exact user data before accepting the raw bundle hash.

Neither lane receives a STRK20 spending key, viewing key, wallet note state, or
identity document. Only commitments, outcome, expiry, proof calldata, derived
nullifier, and any optional receipt reference are public.

## First demo: escrow

```text
buyer STRK20 wallet
  -> private action: pool withdraws funds to GigstarkEscrow
  -> GigstarkEscrow stores only commitments and settlement state
  -> delivery commitment
  -> buyer confirmation OR ZK compute outcome OR time-based refund
  -> pool credits exactly one open note
```

`GigstarkEscrow` is a **stateful Cairo anonymizer draft**, not an ordinary
public escrow. Its `privacy_invoke` route is callable only by a constructor-
pinned STRK20 privacy pool. Each escrow records role commitments, a delivery
commitment, token, amount, expiry, outcome, action nonce, and two consumed claim
flags. Token and amount are required for settlement and remain observable at
the helper boundary. No raw identity, wallet address, delivery bytes, evidence,
viewing key, spending key, or private witness belongs in helper state.

The Wallet API draft uses two explicit action shapes. A private deposit is
`withdraw -> invoke`, which sends the selected private input to the escrow and
then records it. A winner claim is `open transfer -> invoke`, passing the
wallet-provided open-note placeholder into the helper. The helper approves the
pool to pull the winner's balance and returns exactly one `OpenNoteDeposit`; it
never transfers output directly. Amount is observable at the helper boundary
and must not be described as hidden.

Required pre-deploy checks:

1. Exact Sepolia privacy-pool address and ABI are freshly verified.
2. Wallet capability checks require a supported Wallet API version without asking for private balances as a probe.
3. `strk20PrepareInvoke` succeeds for every action shape before an actual user submission.
4. Cairo unit/property tests cover authorization, expiry, duplicate delivery,
   compute-result binding, replays, single settlement, and both double-claim
   paths.
5. The ZK circuit, verifying key, public-signal order, Oyster image/receipt
   expectations, and policy administration are independently reviewed.
6. Independent Cairo/security review and a scoped operational/dispute policy are complete.

The first integration pin is recorded in `contracts/STRK20_SEPOLIA_PIN.md`.
The project compiles with Cairo 2.17.0 and has non-empty contract artifacts plus
36 passing Starknet Foundry tests. The live Sepolia pool class does not match
either of the source-built, reviewed upstream class hashes, so Wallet API
preparation fails closed and declaration/deployment remain blocked.

Preparation and submission read the current chain ID and pool class through the
provider immediately before reaching the wallet. A caller cannot unlock the
flow by passing the reviewed hash as ordinary input while the deployed class is
different.

## Second demo: subscriptions and tier proof

`GigstarkSubscriptions` begins with one user-authorized period. It supports no
more than three paid periods total, cancellation, expiry, and a one-time private
creator claim per paid period. Creator claims unlock at payment. It has no
autonomous recurring charge mechanism.

Tier access is separate from a wallet scan. `GigstarkTierGate` consumes an
audience-bound passport receipt that binds the viewer commitment, exact tier,
access scope, audience, expiry, credential class, and one scoped nullifier.

## Passport patterns adapted locally

ZeeroStream borrows protocol patterns—not code, deployed contracts, trust, or network state—from the Athera Passport selective-disclosure design:

- a bounded, revocable policy for a specific audience and tier;
- a receipt bound to that policy, audience, and an expiration time;
- one anti-replay value scoped to the ZeeroStream policy; and
- proof/disclosure digests rather than private witnesses or user identity data.

The earlier TypeScript checker remains a browser simulation. The Cairo
`GigstarkPassportVerifier` now enforces these bindings cryptographically using
a policy-pinned Stark attestor key and canonical signatures. It verifies an
attested acceptance receipt, not the underlying ZK proof. Issuance, off-chain
proof verification, attestor governance, and an independent audit remain open.

## ZeeroStreamPassport

`contracts/src/gigstark_passport.cairo` is a separately written Gigstark
proof-receipt verifier. It binds an opaque proof commitment to a ZeeroStream-only
policy, credential class, purpose, audience contract, chain, verifier, exact
action statement, unlinkable role/viewer commitment, validity window, and
scope-specific nullifier. It stores no identity, wallet address, witness,
document, or amount.

It does not import or adapt Athera source code, call Athera L1/L3, verify a
Groth16 proof, or issue a credential. It uses only the high-level minimum-
disclosure, audience-binding, expiry, revocation, and anti-replay patterns. The
future ZK issuer/verifier boundary requires a Starknet-specific design, audit,
and testnet-only review.

## ZeeroStreamComputeVerifier

`contracts/src/compute_verifier.cairo` is a clean-room, Starknet-native direct
Groth16 settlement verifier. A policy pins the audience contract, program
commitment, computation-policy hash, threshold, validity window, and exact
verifier contract. The verifier returns eight BN254 public inputs; Cairo checks
every one against the expected dispute result before consuming a deterministic
nullifier and returning the buyer/seller outcome.

The browser TypeScript model mirrors the public binding and replay rules. Its
`proofAccepted` argument represents the onchain verifier response and is not a
browser cryptographic check. The generated Garaga package supplies the real
proof verification, including an integration test through this contract.

An optional `oyster_receipt_commitment` emits a hash-only pointer plus Cairo's
expected attestation `user_data`. Receipt validation stays independent and
offchain. The pinned Mac workflow checks Oyster CLI provenance, raw-attestation
certificate chain, recency, image ID, architecture, and user data. Missing or
invalid Oyster evidence cannot change a valid ZK settlement.

Before release, the project must still specify:

- a production circuit ceremony and independently reviewed verifying key;
- verifier-contract and compute-policy governance, rotation, and revocation;
- an immutable Oyster workload image and independently reproduced image ID;
- a real raw attestation bound to the same synthetic dispute result;
- encrypted evidence ingestion, deletion, availability, and appeal behavior;
  and
- proof calldata and verification-cost limits for the target Starknet release.

## Sources reviewed

- The STRK20 privacy repository documents the pool, helper/anonymizer model, and a compatibility matrix. Its published privacy-pool and Ekubo/Vesu helper class hashes are references, not ZeeroStream deployment approvals.
- The STRK20 Wallet API route keeps viewing keys, note discovery, proof generation, and submission inside the privacy-enabled user wallet. It requires explicit capability detection and uses an open-note-plus-invoke flow for helper interactions.
- Oyster documents a native Apple Silicon CLI and independent attestation
  verification against image ID, AWS Nitro root, recency, and exact user data:
  <https://docs.marlin.org/oyster/build-cvm/quickstart> and
  <https://docs.marlin.org/oyster/build-cvm/guides/verify-attestations-oyster-cvm>.
- Starknet documents both Cairo/STARK provable computation through SHARP and
  SNARK verification in Cairo contracts. These establish feasible proof paths,
  not an audit or approval of ZeeroStream's future circuit:
  <https://docs.starknet.io/learn/protocol/sharp> and
  <https://docs.starknet.io/build/starknet-by-example/advanced/verify-proofs>.

## Non-goals

- No autonomous charges or session authority before a separate key-exposure review.
- No claim that an Oyster receipt authorizes settlement or that a browser model
  verifies either a hardware attestation or Groth16 proof.
- No TEE custody of STRK20 spending keys, viewing keys, or wallet note state.
- No public registry modification, contract deployment, funds, tokens, Athera receipt anchor, or claim of cryptographic amount privacy.
