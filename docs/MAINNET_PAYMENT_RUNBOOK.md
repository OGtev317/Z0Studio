# ZeeroStream Mainnet payment runbook

This runbook completes the three wallet-signed STRK20 transactions required for
the Private Sprint. It never asks an operator to export a private key, viewing
key, seed phrase, note, or proof witness.

## Before the session

1. Use the live site at <https://zeerostream.pages.dev> and a wallet that reports
   Wallet API `0.10.3` or newer in the site's capability check.
2. Select Starknet Mainnet (`SN_MAIN`) in the wallet.
3. Prepare separate creator and client wallets. Fund each only with the reviewed
   amount needed for its shield, current pool fees, and any wallet-disclosed
   gas. The site reads the pool fee live.
4. Neither wallet needs a separate uncounted registration transaction: the
   wallet registers itself during its first shield when required.
5. Confirm the site displays pool
   `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`.
6. After connecting, confirm the site shows a live-read pool fee before choosing
   the shield amount. Leave enough STRK for the shield value, pool operations,
   and any wallet-disclosed gas.

## Transaction 1: creator onboarding shield

1. Connect the creator wallet, choose **Shield STRK**, and enter a reviewed
   amount. This pool transaction registers the creator when needed and counts
   as the first competition receipt.
2. Run **Prepare and dry-run**.
3. If the wallet returns `NOT_REGISTERED` during this first simulation, ZeeroStream
   stops before submission. Complete the first public shield in Ready X's own
   Privacy flow, preserve the pool-deposit hash, and reconnect ZeeroStream after
   the receipt is accepted. ZeeroStream does not bypass the wallet registration gate.
4. For already registered wallets, request the Mainnet signature. The wallet may first request an ERC-20
   approval and then the pool deposit. The approval does not qualify; preserve
   the pool-deposit hash returned by ZeeroStream.
5. Use **Verify receipt and pool event**. Preserve the green **Verified** hash.

## Transaction 2: client shield

1. Switch to the client wallet and reconnect ZeeroStream.
2. Choose **Shield STRK** and enter enough to cover the intended creator
   payment and later pool fee.
3. Dry-run, review, acknowledge, and sign. Preserve the pool-deposit hash rather
   than any ERC-20 approval hash.
4. Verify the receipt and wait about ten blocks for the client's new note to
   mature before paying the creator.

## Transaction 3: private creator payment

1. Keep the client wallet connected and choose **Private creator payment**.
2. Enter the creator's now-registered address or `.stark` name and a small
   reviewed STRK amount.
3. Dry-run, review the resolved address and live fee, acknowledge, and sign.
4. Preserve the relayed transaction hash. Do not infer the payer from the
   transaction sender; private submissions use a relayer.
5. Verify the successful receipt and pool event in ZeeroStream.

The site's **Submission evidence** panel keeps submitted and verified hashes
separate. A green **Verified** label means that the configured Mainnet RPC saw
an accepted, successful receipt with an event emitted by the reviewed pool. It
does not replace the final two-provider verification below.

## Final verification

1. Put the three distinct qualifying hashes in both `strk20.json` and
   `public/strk20.json` in the same order. Keep `contracts` empty.
2. Add the public three-minute video URL.
3. Run:

   ```zsh
   npm test
   npm run typecheck
   npm run build
   npm run verify:strk20-mainnet
   npm run verify:hackathon-submission
   ```

4. Deploy `out/` to the existing `zeerostream` Pages project, verify the canonical
   URL and `/strk20.json`, then commit and push.

Deposits and withdrawals are public. Private transfers hide the pool-side
sender, recipient, amount, and spent notes; timing and pool use remain visible.
