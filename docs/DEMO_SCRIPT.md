# Z three-minute demo script

## 0:00-0:25 — problem and promise

"Freelance payments expose who paid whom and how much. Z is a
non-custodial STRK20 interface that lets a client shield STRK and pay a
registered creator privately on Starknet Mainnet."

Show the live URL and the `PRIVATE SPRINT MVP` badge.

## 0:25-0:55 — trust boundary

Show **Check compatible wallet**. Explain that capability detection checks only
Wallet API versions. Wallet connection is the login; `.stark` names are public
aliases. Z never receives signing keys, viewing keys, private notes,
witnesses, proofs, or private balances.

## 0:55-1:35 — creator and client shields

Show the Shield form, fixed STRK token, reviewed Mainnet pool, live pool fee,
dry-run, acknowledgement, and wallet prompt. Explain that the creator's shield
registered that wallet and produced receipt one; the client's shield produced
receipt two. ERC-20 approvals do not count. Mention the client's note-maturity
wait.

## 1:35-2:20 — private creator payment

Resolve the creator's `.stark` name, show the resolved address before signing,
prepare the private transfer, and approve it in the wallet. Explain that the
wallet discovers notes, builds the proof, signs, and submits through the relayer.
The public transaction sender must not be treated as the client identity. This
successful pool transaction is receipt three.

## 2:20-2:45 — receipts and recovery

Show the transaction hash, explorer link, **Verify receipt and pool event**, and
the evidence panel distinguishing submitted from verified hashes. Show the
creator shield, client shield, and private-payment hashes in `strk20.json`.

## 2:45-3:00 — honest scope

"Inside the pool, sender, recipient, amount, and spent notes are hidden.
Deposits, withdrawals, timing, and pool use remain public. Escrow,
subscriptions, custom ZK settlement, messaging transport, and Oyster TEE are
preserved as post-hackathon work and are not represented as live."

End on <https://zeerostream.pages.dev>.
