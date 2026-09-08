# Gigstark Groth16 verifier specimen

This standalone Cairo package was generated from
`../zk/fixtures/verification_key.json` by Garaga `1.1.0`. It verifies the real
BN254 Groth16 proof in `../zk/fixtures/proof.json`. The Starknet calldata in
`tests/proof_calldata.txt` was generated from that proof and the eight public
signals in `../zk/fixtures/public.json`.

The generated package remains separate from `contracts/`, while its test-only
dependency imports the reviewed Gigstark contract. This lets the fixture prove
that the actual Garaga verifier can authorize `GigstarkComputeVerifier` without
adding Garaga to the escrow package's production dependency graph.

## Verify

Install the versions in `.tool-versions`, then run:

```sh
scarb build
snforge test
```

The test uses a read-only Starknet Sepolia fork because the generated verifier
calls Garaga's declared ECIP operations library at class hash
`0x396d5915ecf475aab117bb25a0272b261e9e25ffe1c0ce05a51a3f77489c89e`.
It performs no deployment or transaction. Three tests assert all eight returned
public signals, reject a tampered signal, and pass the real proof through the
actual Gigstark settlement verifier, including replay consumption.

## Reproduce the generated source and calldata

In a clean Linux or compatible Python environment with Garaga `1.1.0`:

```sh
garaga gen --system groth16 --vk ../zk/fixtures/verification_key.json
garaga calldata \
  --system groth16 \
  --vk ../zk/fixtures/verification_key.json \
  --proof ../zk/fixtures/proof.json \
  --public-inputs ../zk/fixtures/public.json \
  --format snforge \
  --output-path tests
```

The generated verifier source remains marked as generated. Review and pin its
verifying key before any deployment. The current proving key comes from a
deterministic test-only ceremony and is not production-safe.
