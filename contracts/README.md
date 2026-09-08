# GigstarkEscrow Cairo draft

This is a **Sepolia-only app-team draft**. It has not been declared, deployed,
linked to the live STRK20 pool, or used with a wallet or funds. It is not an
official StarkWare escrow package.

The package builds stateful `GigstarkEscrow` and `GigstarkSubscriptions`
contracts, a `GigstarkPassportVerifier`, and an audience-bound
`GigstarkTierGate`. The package also builds `GigstarkComputeVerifier`, the
direct-ZK result-verification boundary with an optional Oyster receipt. The escrow constructor pins the
privacy pool, compute verifier, and an external action-
authorization verifier. The pool-only `privacy_invoke` route covers deposit,
delivery, buyer confirmation, dispute opening, timeout refund, and one winner
claim. Deposits return an empty span; claims approve the pool and return exactly
one `privacy::objects::OpenNoteDeposit`.

Deposits fail unless the helper's actual token balance covers the previously
accounted balance plus the requested escrow amount. Excess tokens sent directly
to the helper remain unaccounted and cannot block or inflate an escrow.

The helper records token and amount because both are required to settle the
winner note. They are public at the helper boundary and are not described as
cryptographically hidden. User wallet addresses, private witnesses, delivery
contents, and dispute evidence are not stored.

`GigstarkPassportVerifier` consumes Stark-curve signed, action-bound proof
receipts under an audience-specific policy. It rejects wrong audiences, roles,
expiry, revoked policies, and scoped nullifier replay. It is clean-room
Gigstark code and imports no Athera contract, root, trust, or network state. It
is a signed receipt verifier for an opaque proof accepted off-chain, not a
direct ZK circuit verifier. New policies are staged inactive, policy IDs are
immutable after configuration, and activation/deactivation is an explicit
admin action. Attestor rotation therefore uses a new reviewed policy ID rather
than overwriting an active key in place.

`GigstarkComputeVerifier` calls the Groth16 verifier address pinned by the
active policy. It requires exactly eight returned public inputs to match the
expected escrow input, policy, program, score threshold, evidence/result
commitments, binary outcome, and expiry. Its one-use nullifier is derived from
the result instead of supplied by the caller, and configured policy IDs cannot
be overwritten with different verification rules. An optional Oyster attestation
bundle hash can be emitted beside the exact expected `user_data` binding, but
that hash is not checked as a settlement prerequisite and cannot alter the ZK
outcome. The escrow derives its dispute input from chain, contract, escrow
state, and action nonce before consuming the result.

Subscriptions support one initial period, at most three total prepaid periods,
cancellation, expiry, and one creator note per paid period. Claims unlock when
the period is paid; cancellation blocks new prepayment but does not claw back
already paid creator claims. There is no autonomous charging.

Run:

```zsh
cd ..
npm run verify:cairo-release
```

This checksum-pins official Scarb 2.17.0 and Starknet Foundry 0.59.0 archives,
uses an isolated clean source archive and package cache, builds the release
profile, and runs the tests without changing global tools. The dependency lock
must remain checked in. Thirty-six contract tests pass locally with the pinned
toolchain, but this is not a deployment approval.

The exact upstream release, live pool mismatch, and deployment gate are in
`STRK20_SEPOLIA_PIN.md`.
