# Oyster pin: independently verifiable receipt v1

Gigstark's optional TEE receipt lane uses Marlin Oyster CVMs. The reviewed
Apple Silicon CLI artifact on 24 August 2026 is:

- CLI: `oyster-cvm 5.0.1`
- artifact: `oyster-cvm_latest_darwin_arm64`
- SHA-256: `f1438044b90dfbf1d847cde869f779b99265bf8f2ac455bae96337bcaecca9a5`
- workload architecture: `linux/amd64`
- maximum receipt age at verification: `300000` milliseconds

The upstream `latest` URL is mutable. The version and digest above are the pin;
if the downloaded bytes differ, stop and review the new release instead of
silently accepting it.

An acceptable receipt must verify the AWS Nitro root, recency, image ID,
architecture, and exact `user_data` binding. Checking only that an attestation
has a valid certificate chain is insufficient. Store the raw attestation
outside source control and put only its SHA-256 commitment in the Starknet
result.

Oyster does not receive a STRK20 spending key, viewing key, wallet note state,
or identity document. ZK proof verification remains the only enforceable
settlement path.
