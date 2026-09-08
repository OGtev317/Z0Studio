# Oyster receipt lane

Oyster is an optional, independently verifiable execution receipt for the
Gigstark dispute program. It is deliberately not a settlement authority.
`GigstarkComputeVerifier` settles only after the pinned Groth16 verifier accepts
the proof and all eight public signals match.

The optional onchain `oyster_receipt_commitment` is the SHA-256 commitment to a
raw Oyster attestation bundle. When it is non-zero, Cairo emits it together
with `expected_user_data_binding`. A reviewer verifies the raw attestation
offchain against:

- the AWS Nitro certificate root;
- a fresh timestamp;
- the reviewed Oyster image ID (PCR16/application measurement);
- the expected architecture and base-image measurements; and
- `user_data`, encoded as the 32-byte big-endian form of Cairo's binding felt.

The binding covers the Starknet chain, compute-verifier address, policy,
escrow audience, job, disputed input, evidence commitment, result commitment,
outcome, and expiry. A receipt for another chain, contract, job, or result is
therefore not interchangeable.

## Mac-first workflow

Apple Silicon can run the existing deterministic workload and proof checks:

```sh
npm run compute:verify
```

Oyster publishes a native `darwin_arm64` CLI. This repository pins the reviewed
CLI artifact in [`OYSTER_PIN.md`](../OYSTER_PIN.md); verify its version and
SHA-256 before use. Deployment is intentionally separate because it creates a
paid Oyster job and requires a funded user-controlled wallet.

To prepare a deployable image without placing credentials in the repository:

1. Build and test `compute/enclave/Dockerfile` for `linux/amd64`.
2. Publish the exact image to a registry and replace
   `GIGSTARK_OYSTER_IMAGE` with its immutable `@sha256:` reference.
3. Compute and independently record the image ID from
   `docker-compose.example.yml`.
4. Only after explicit approval, deploy it as an AMD64 Oyster CVM.
5. Have the workload-controlled adapter derive the Cairo binding from the
   completed computation and request the raw NSM attestation with that exact
   value in `user_data`.
6. Verify the saved receipt offline with `verify-receipt.sh`.

The current repository implements the Cairo receipt commitment and independent
verification side, not the in-enclave receipt-production adapter. The workload
exposes a vsock interface designed for a Nitro parent. An Oyster-facing adapter
must add authenticated encrypted input and must itself derive `user_data` from
the computed result before requesting an NSM attestation. A generic attestation
endpoint that signs caller-supplied user data would prove only that the image
was running, not that it computed the claimed result, and is not acceptable.
A synthetic fixture may be used while building that adapter; production
evidence must not be sent over an unauthenticated plaintext endpoint.

## Offline verification

```sh
compute/oyster/verify-receipt.sh \
  path/to/attestation.hex \
  64_HEX_CHARACTER_IMAGE_ID \
  64_HEX_CHARACTER_CAIRO_BINDING
```

The script invokes Oyster's verifier with the raw attestation file, image ID,
user data, AMD64 architecture, and a five-minute age bound. It prints the
SHA-256 receipt commitment only after those checks pass. Do not commit raw
attestations containing private or identifying fields.

No Oyster deployment, wallet operation, image publication, or payment is
performed by repository verification scripts.
