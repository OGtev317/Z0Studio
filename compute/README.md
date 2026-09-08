# Gigstark verifiable-compute specimen

This directory contains one synthetic, end-to-end dispute specimen:

1. `enclave/` implements the canonical private dispute computation as a static
   Rust binary and reproducible container.
2. `zk/` proves the same comparison and Poseidon commitments with a BN254
   Groth16 circuit.
3. `cairo-verifier/` verifies that proof with Garaga, asserts the exact eight
   public signals, and passes the real proof through `GigstarkComputeVerifier`.
4. `oyster/` defines the optional receipt lane: an Oyster attestation can bind
   the same result in `user_data`, while ZK remains the sole settlement authority.

Run `npm run compute:verify` with the pinned Cairo tools to rebuild the
container, compare its output to the fixture, verify the Groth16 proof, and run
the Cairo valid-proof, tampered-signal, and end-to-end settlement tests.

This is a real proof over a synthetic witness. The proving ceremony is
deliberately local and test-only. It is not a production proving key. The
container build is reproducible and pinned. The Mac-native Oyster CLI and its
verification boundary are also pinned, but no paid Oyster job, immutable
published workload image, image ID, or raw hardware attestation exists yet.
Those remain explicit receipt-lane exit gates and do not block local ZK
settlement verification.

No private evidence, witness, identity document, viewing key, spending key, or
wallet note state may be supplied to repository scripts or committed here.
