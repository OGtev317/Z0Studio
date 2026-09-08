# Gigstark Mainnet independent review checklist

Status: `REVIEW_REQUEST_NO_KEY_NO_BROADCAST`

This is the authoritative review entrypoint for the Gigstark Cairo contracts.
It requests independent review only. It does not approve a class declaration,
contract deployment, wallet signature, STRK20 transaction, or fund movement.

## Exact review target

| Item | Pinned value |
| --- | --- |
| Repository | `https://github.com/OGtev317/Gigstark` |
| Compiled-contract source commit | `36dca38d94a2cf6e287646804af8ed73000b1b99` |
| Generated-manifest commit | `39f23a96847b8a517f608f38c4a2c0f1a931c3b6` |
| Mainnet manifest | `release/gigstark-mainnet-review.json` |
| Mainnet manifest SHA-256 | `d557a14c860fb05b03c404368679bd3b2e4b3ef171ff33d087f6358a0b3b2e9d` |
| Contracts tree | `79c49d1ded6f60cec272f5ee541ece3500409d27` |
| Network | Starknet Mainnet, `SN_MAIN` |
| Pinned STRK20 pool | `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a` |
| Pinned pool class | `0x067dddd89d80fedadc06b6f160798f94800a4a70164e5a24301cd0d6076b554d` |
| Pinned pool version | `2.0` |
| Pinned pool ABI SHA-256 | `82048b31b314b22d58ef6c72064ff6ce9ba554ea6b924f9eac7cd032bac9848f` |

Review these five compiled contracts and their tests:

- `GigstarkEscrow`
- `GigstarkSubscriptions`
- `GigstarkPassportVerifier`
- `GigstarkComputeVerifier`
- `GigstarkTierGate`

The manifest contains the exact Sierra class hash, compiled-class hash,
artifact SHA-256, constructor shape, and artifact length for each contract.
Constructor values remain deliberately unset and unreviewed.

## Reproduce before reviewing

Use a fresh checkout. Do not substitute a different commit, package lock, or
locally installed Cairo toolchain.

```zsh
git clone https://github.com/OGtev317/Gigstark.git
cd Gigstark
git checkout 36dca38d94a2cf6e287646804af8ed73000b1b99
npm ci
npm run verify:cairo-release
shasum -a 256 release/gigstark-mainnet-review.json
npm test
npm run typecheck
npm run build
```

Expected results:

- checksum-pinned Scarb `2.17.0` and Starknet Foundry `0.59.0`;
- release-profile Cairo build and 37/37 Cairo tests;
- unchanged `contracts/Scarb.lock`;
- Mainnet manifest SHA-256 exactly
  `d557a14c860fb05b03c404368679bd3b2e4b3ef171ff33d087f6358a0b3b2e9d`;
- 53/53 TypeScript tests, successful typecheck, and successful production build;
- no RPC submission, Starkli or `sncast` invocation, wallet request, or funds.

Stop and report a reproduction failure if any expected hash, test count,
toolchain version, package graph, or lock state differs.

## Required Cairo and protocol review

Record a finding for every unchecked item. Critical and high findings must be
closed before this review can be approved.

### STRK20 helper boundary

- [ ] Every stateful `privacy_invoke` path authenticates the exact pinned pool
      as caller.
- [ ] Every path returns exactly `Span<OpenNoteDeposit>` with no incompatible
      return data.
- [ ] Deposit or state-transition-only paths return an empty span; successful
      claims return exactly one intended note.
- [ ] Claims approve the pool to pull the exact accounted output instead of
      transferring it directly.
- [ ] State, replay, and liability accounting are updated before approval, and
      a failed pool pull reverts the entire Starknet transaction atomically.
- [ ] Token addresses and `u128` amounts cannot create unbounded or
      under-accounted liabilities; direct excess token transfers cannot inflate
      escrow credit.
- [ ] External-call and action ordering respects STRK20's single phase-7 invoke
      budget.

### Escrow and subscription state machines

- [ ] Only the intended buyer, seller, winner, or creator role can advance each
      transition or receive the resulting note.
- [ ] Delivery, confirmation, dispute, result consumption, timeout refund, and
      winner claim are correctly ordered and cannot be replayed or double paid.
- [ ] Expiry and timeout boundaries cannot strand funds or permit premature
      refund/claim paths.
- [ ] Subscription prepayment is capped, cancellation blocks new prepayment,
      and each paid period permits at most one creator claim.
- [ ] The documented rule that cancellation does not claw back already paid
      periods is represented consistently in code and tests.
- [ ] There is no autonomous recurring charge, unrestricted allowance, or
      exported spending/viewing key.

### Passport and compute authorization

- [ ] Receipt signatures bind the chain, verifier, audience, policy, purpose,
      credential class, role or viewer commitment, exact action statement,
      validity, opaque proof commitment, and scoped nullifier.
- [ ] Receipt and policy time windows, low-`s` signature checks, purpose
      separation, and atomic nullifier consumption fail closed.
- [ ] A new Passport policy starts inactive, an existing policy ID cannot be
      overwritten, and activation/deactivation is a separate admin action.
- [ ] Attestor rotation requires a new policy ID and cannot replace a live key
      in place.
- [ ] Compute policies cannot be overwritten and pin one exact verifier.
- [ ] Exactly eight Groth16 public inputs are checked in canonical order, and
      the escrow derives the expected dispute input from current onchain state
      and action nonce.
- [ ] Optional Oyster evidence cannot authorize, block, choose, or alter the
      settlement result.

### Governance and operational safety

- [ ] Every constructor role and address is reviewed before it is populated.
- [ ] Passport and compute administration use the reviewed 2-of-3 Mainnet
      multisig policy; signer set, threshold, rotation, revocation, and
      emergency response are independently confirmed.
- [ ] The attestor operations document is approved against the exact production
      public key and a bounded maximum receipt lifetime.
- [ ] The pool's zero-second upgrade-delay risk is accepted, with exact class,
      ABI, version, and advancing-head checks required immediately before both
      wallet preparation and submission.
- [ ] Two independent Mainnet RPC providers agree on the exact common-block
      pool state and constructor-role account classes.
- [ ] The deployment sequence prevents partially configured or active policy
      states from being treated as production-ready.

### Privacy and product claims

- [ ] Public edges are described accurately: token, amount, helper interaction,
      open-note amount, nullifiers, withdrawals/deposits, and timing may remain
      visible.
- [ ] No claim attributes pool activity to the transaction sender; relayed
      submissions do not identify the user from the envelope.
- [ ] Channel-opening timing, distinctive amounts, and rapid in/out patterns are
      documented as anonymity-set risks.
- [ ] Deposit screening remains enforced by the upstream pool; Gigstark exposes
      no path intended to bypass it.
- [ ] No private viewing/spending key, witness, seed, identity document, or
      secret attestor scalar enters the repository, browser, logs, or review
      package.

## Production proof review is a separate required input

The repository's deterministic Groth16 fixture is synthetic and test-only. It
cannot satisfy production review. Before approval, independently bind all of
the following to the exact reviewed policy and verifier:

- production verifier Sierra class hash;
- production verifier compiled-class hash;
- production circuit SHA-256;
- production verification-key SHA-256;
- ceremony or setup review URL; and
- unresolved production-proof findings.

If Oyster is included, separately review the immutable workload image,
reproduced image ID, `user_data` adapter, certificate chain, freshness and
rollback controls, encrypted evidence transport, and raw attestation. Oyster
remains optional evidence and never settlement authority.

## Required reviewer response

Publish a durable review URL containing:

```text
reviewer: <name or organization>
reviewed source commit: 36dca38d94a2cf6e287646804af8ed73000b1b99
reviewed manifest SHA-256: d557a14c860fb05b03c404368679bd3b2e4b3ef171ff33d087f6358a0b3b2e9d
scope: <files, contracts, production-proof artifacts, and operational documents>
decision: APPROVED | CHANGES_REQUIRED
unresolved critical findings: <integer>
unresolved high findings: <integer>
findings: <durable links or identifiers>
attestor operations approved: true | false
exact production attestor public key reviewed: <public key or NOT_REVIEWED>
maximum receipt lifetime reviewed: <value or NOT_REVIEWED>
production proof lineage approved: true | false
```

An approval is usable by the deployment-readiness gate only when it targets the
exact source commit above, reports zero unresolved critical and high findings,
and includes the separately reviewed production-proof and attestor inputs.

## Inputs that remain operator decisions

Independent review does not choose the deployer, spend funds, or authorize a
wallet. After review, the operator must still set and separately approve:

- exact governance and deployer account addresses and live class hashes;
- the exact public attestor key (the secret is generated and retained outside
  the repository and browser);
- the maximum total deployment fee ceiling in fri;
- declaration/deployment order and constructor calldata; and
- the exact chain, account, nonce, current fees, and every wallet request.

The next automated checkpoint is only:

```zsh
npm run review:mainnet-deployment -- \
  release/gigstark-mainnet-deployment-inputs.local.json
```

Even a successful result is `NO_BROADCAST_DEPLOYMENT_REVIEW_READY` with
`broadcastAuthorized: false`. Declaration, deployment, policy activation,
wallet execution, and fund movement require separate explicit authorization.
