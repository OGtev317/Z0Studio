# ZeeroStream internal security review

Last reviewed: 2026-08-25

This is an app-team review of the local draft, not an independent audit or a
deployment approval. No contract has been declared or deployed and no wallet
action or fund movement was performed.

## Reviewed boundary

- `GigstarkEscrow`, `GigstarkSubscriptions`, `GigstarkPassportVerifier`,
  `GigstarkComputeVerifier`, and `GigstarkTierGate`;
- pool-only `privacy_invoke` routing and `OpenNoteDeposit` returns;
- role, action, purpose, audience, expiry, policy, and nullifier binding;
- token accounting, exact approvals, claim consumption, cancellation, and
  expiry transitions; and
- Wallet API capability detection, calldata construction, provider checks,
  preparation, and explicit submission separation.

## Hardening completed

- The wallet runtime reads the provider chain and latest class at the exact
  pool address instead of trusting caller-supplied metadata. Sepolia remains
  fail-closed on its unreproduced class. Mainnet V2 has a library-only dry-run
  preparation path, while the existing submission path explicitly rejects
  Mainnet.
- Escrow, subscription, and tier consumers enforce separate Passport purposes
  before calling the shared verifier.
- Receipt signatures bind chain, verifier, audience, policy, purpose,
  credential class, role/viewer commitment, exact action statement, validity,
  opaque proof commitment, and scoped nullifier.
- Policies and receipts have independent validity windows; policies can be
  revoked; receipt issuance cannot predate the policy.
- Stark signatures reject non-canonical high-`s` values and nullifiers are
  consumed atomically with the authorized action.
- Escrow and subscription claims update accounting and claim state before the
  exact pool approval. Any later pool pull failure reverts the whole Starknet
  transaction.
- TypeScript builders enforce Cairo-sized `u8`, `u64`, and `u128` fields before
  asking a wallet to prove an action.
- The deposit review screen checks the connected wallet's advertised Starknet
  Sepolia chain, displays helper/token/amount/deadline fields, dry-runs first,
  and requires a separate acknowledgement before enabling submission.
- Wallet rejection and wrong-chain states use fail-closed messages and never
  imply that a rejected request produced a transaction.
- Compute policies pin an exact Groth16 verifier. Cairo accepts only eight
  public inputs in the canonical order and compares input, policy, program,
  threshold, evidence, result, outcome, and expiry before settlement. A
  configured policy ID cannot be reconfigured; it can only be deactivated or
  reactivated by the current admin.
- Compute results reject failed proofs, substituted public signals, wrong job or
  expected input, inactive policy, expiry, and deterministic-nullifier replay.
- An Oyster receipt commitment is optional and excluded from settlement
  authority. If present, Cairo emits the exact expected chain/contract/result
  `user_data` binding for independent certificate, image-ID, and freshness
  verification.
- Escrow dispute resolution derives its expected input commitment from the
  chain, escrow contract, escrow fields, and current action nonce, then consumes
  exactly one compute result. No direct binary arbitrator call remains.
- A Starknet SDK health gate compares two distinct providers at exact common
  blocks, requires recent accepted and advancing heads, recomputes the live
  Sierra class hash, fingerprints the ABI, and calls pool configuration views.
  Sepolia and Mainnet use separate exact chain, pool, ABI, version, and class
  expectations; Mainnet additionally requires the source-reproduced V2 class.
- The current class declaration and activation blocks and successful receipts
  are checked independently from the source-reproduction decision.

## Open deployment blockers

1. **Sepolia provenance remains unresolved.** The live Sepolia class's complete ABI and
   declaration timing match StarkWare commit `5bf8aae`, but the commit's clean
   dev and release artifacts do not reproduce the live Sierra class hash.
   RC.4 and RC.5 of `@starkware-libs/starknet-privacy-sdk` both reproduce the
   live ABI fingerprint, but not the deployed class. Every public PR revision
   was also rebuilt, and the merge result was identical on ARM64 macOS and
   x86_64 Linux. The remaining difference is an unpublished build profile,
   dependency state, or source change; source-level correlation and ABI package
   identity are not artifact provenance. This keeps the Sepolia lane blocked
   through upstream issue #969; it does not invalidate the separately pinned,
   source-reproduced Mainnet V2 release lane.
2. **Attestor trust.** GigstarkPassport verifies a policy-pinned attestation
   receipt. It does not directly verify the underlying ZK proof. Issuance,
   proof-verifier operation, attestor key storage/rotation, and compromise
   response are not implemented.
3. **Production proving remains open; Oyster evidence is optional.** Direct Groth16
   verification works with a real synthetic fixture, but the deterministic
   test ceremony and placeholder commitments are not production-safe. The
   dispute path requires an independently reviewed production circuit, proving
   setup, verification key, and verifier. If the demo includes Oyster, it also
   requires an immutable published workload image, independently reproduced
   image ID, workload-controlled `user_data` adapter, and raw attestation bound
   to the result. Oyster is not required for settlement and cannot choose or
   alter the outcome.
4. **Single administrative roles.** Passport and compute policy administration
   are constructor-pinned single addresses in this draft. A reviewed
   multisig/timelock, key rotation, revocation, and emergency policy are
   required before public deployment.
5. **No independent Cairo audit.** The app-team tests and this review cannot
   replace independent review, property testing, or testnet adversarial drills.
6. **No live Mainnet Wallet API E2E.** Ready-wallet proving, rejection, timeout,
   relayer, RPC disagreement, note maturity, and transaction-resume behavior
   remain untested.

## Product and privacy risks

- Helper token, amount, calldata commitments, open-note amounts, timing, and
  the pool/helper interaction remain public.
- Oyster confidentiality depends on AWS Nitro, certificate-root and image-ID
  verification, build reproducibility, rollback/freshness controls, encrypted
  evidence transport, and resistance to side channels. A receipt hash alone is
  not hardware proof and never authorizes settlement.
- ZK correctness depends on the exact circuit/program, verification key, public
  signal order, proof system, and verifier implementation. Proving the wrong
  policy correctly is still a system failure.
- Public compute outcomes and distinctive timing can leak information even when
  evidence and witnesses remain private.
- Escrow and subscription identifiers must be unpredictable commitments. A
  guessable identifier permits a funded first-writer denial-of-service attempt.
- Subscription creator claims unlock when payment is made. Cancellation blocks
  future prepayment but does not refund or claw back already paid periods.
- A single global action nonce per escrow/subscription intentionally serializes
  competing actions. A receipt prepared before another valid action must be
  prepared again.
- The pool currently reports a zero-second upgrade delay. A reviewed class can
  therefore change without a timelock window, so the class must be checked
  immediately before both preparation and submission.
- The release health commands compare separately configured providers, but the
  connected wallet still relies on its selected provider at execution time.
  Provider disagreement must fail closed.
- The no-broadcast deployment-readiness command binds an independent approval
  to the exact compiled contract source commit, verifies the Mainnet manifest
  hash, rejects secret, viewing-key, spending-key, and witness fields, and
  requires explicit public governance, prover, attestor, deployer, and fee
  inputs. A passing review still cannot broadcast.

## Required next review

Do not declare or deploy on Mainnet until the production ZK setup and
verification path are fixed, every constructor role and class hash is reviewed,
a multisig/timelock and emergency policy are selected, an independent Cairo
review closes critical/high findings, the live Mainnet V2 gate passes again,
and an explicit Mainnet transaction review authorizes the exact account, chain,
nonce, fees, class hashes, deployment order, and constructor calldata. If
Oyster is included in the demo, its separate image and attestation-validation
requirements must also pass. Sepolia remains blocked on issue #969.
