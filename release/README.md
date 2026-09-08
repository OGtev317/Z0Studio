# Gigstark release review package

Start an independent Mainnet review with
[`MAINNET_INDEPENDENT_REVIEW_CHECKLIST.md`](MAINNET_INDEPENDENT_REVIEW_CHECKLIST.md).

`gigstark-sepolia-review.json` and `gigstark-mainnet-review.json` are generated
by:

```zsh
npm run verify:cairo-release
```

The command refuses uncommitted compiler inputs under `contracts/`, archives
the last commit that changed those inputs, downloads the official Scarb 2.17.0
and Starknet Foundry 0.59.0 release archives for the current macOS or Linux
architecture, checks their pinned SHA-256 digests, and uses an isolated cache
and target directory. It performs a release-profile build, runs all 37 Cairo
tests, checks that `Scarb.lock` did not change, fingerprints the normalized
package graph, and computes each Sierra and compiled-class hash.

The JSON files are review artifacts, not deployment files. Constructor values
remain unset. The command does not contact a Starknet RPC, invoke Starkli or
`sncast`, declare or deploy a class, submit a transaction, or move funds.

`gigstark-mainnet-deployment-inputs.example.json` is the public-input template
for the next gate. Copy it to the ignored
`gigstark-mainnet-deployment-inputs.local.json`, fill only reviewed public
addresses, class hashes, artifact hashes, and review metadata, then run:

```zsh
npm run review:mainnet-deployment -- release/gigstark-mainnet-deployment-inputs.local.json
```

The command rejects private, viewing, spending, seed, witness, and API-key
fields. It exits nonzero while any independent-review, governance, production
proof, attestor, deployer, or fee input is unresolved. Even a passing result is
explicitly no-broadcast and still requires review of the current nonce, fees,
deployment order, constructor calldata, and every wallet signature request.
`maximumTotalFeeFri` is the total deployment budget ceiling in fri
(`1 STRK = 10^18 fri`); it is not an ETH-denominated wei value.
