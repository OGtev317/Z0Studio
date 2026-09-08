# Gigstark dispute proof statement v1

The Groth16 verifier returns exactly eight BN254 public inputs in this order:

1. `disputeInputCommitment` — the Starknet/Cairo commitment derived from the
   exact disputed escrow state, chain, escrow contract, escrow ID, and action
   nonce.
2. `policyId` — the immutable dispute-policy identifier.
3. `programMeasurementCommitment` — a BN254 field commitment to the reviewed
   dispute program release. An Oyster image ID/PCR receipt may independently
   attest to that release, but is not itself a proof input authority.
4. `requiredScore` — the public policy threshold, restricted to `0..100`.
5. `evidenceCommitment` — Circom-compatible BN254 Poseidon of the private
   evidence score and private nonce.
6. `resultCommitment` — BN254 Poseidon of inputs 1, 2, 3, 5, the outcome, and
   expiry.
7. `outcome` — `1` for buyer or `2` for seller. The circuit produces seller
   when `evidenceScore >= requiredScore`, otherwise buyer.
8. `expiresAt` — the receipt expiry. Cairo remains responsible for comparing
   it with the Starknet block timestamp.

Private witness order is `evidenceScore`, then `evidenceNonce`. The committed
fixture uses synthetic values only, including placeholder dispute, policy, and
measurement commitments `1001`, `2001`, and `3001`. Real evidence, witnesses,
note state, viewing keys, and spending keys must never enter source control or
browser code.

Changing the order, hash construction, comparison rule, field encoding, or
meaning of an outcome requires a new circuit, verifying key, policy ID, program
commitment, and Oyster image review.
