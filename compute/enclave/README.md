# Gigstark dispute workload

The enclave program accepts one length-bounded JSON dispute request, evaluates
the public threshold policy over a private score, and returns only commitments,
the winner outcome, and expiry. Local fixture generation uses `--stdio-once`;
the legacy direct-Nitro runtime listens on VSOCK port `5005`.

The builder is pinned to Rust `1.97.1`, Alpine `3.23`, `linux/amd64`, the exact
base-image digest in `Dockerfile`, and the dependency versions in `Cargo.lock`.
The final image is `scratch` plus one static non-root binary.

Local validation:

```sh
cargo test --locked
docker build --platform linux/amd64 --provenance=false \
  --tag gigstark-dispute-enclave:0.1.0 .
docker run --platform linux/amd64 --rm -i \
  gigstark-dispute-enclave:0.1.0 --stdio-once \
  < ../zk/fixtures/dispute-seller.request.json
```

The retained direct-AWS EIF recipe can run only on a Linux Nitro host and is no
longer the hackathon receipt path:

```sh
./build-eif.sh
./run-non-debug.sh
```

`run-non-debug.sh` deliberately omits `--debug-mode`. The selected optional TEE
path is the Mac-compatible [Oyster receipt lane](../oyster/README.md). Its
encrypted Oyster-facing request adapter is still open, so use only synthetic
fixture data today. Do not add credentials, wallet keys, note state, or real
dispute evidence to this image or repository.
