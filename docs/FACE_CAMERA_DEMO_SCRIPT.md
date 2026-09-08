# Z face-camera demo script

Target length: about 3 minutes.

Recording setup:

- Start on camera for the first 20-30 seconds.
- Then screen-share `https://zeerostream.pages.dev` with your camera bubble on.
- Do not show seed phrases, private keys, viewing keys, private balances,
  wallet recovery screens, private notes, proof witnesses, or identity
  documents.
- If a wallet prompt appears, show only the review screen. Do not sign a new
  transaction unless you intentionally want to submit one.

## 0:00-0:25 - Camera intro

Hi, I am Tevin, and this is Z.

Z is a private checkout page for creators on Starknet Mainnet.

The problem is simple: creator payments are normally public. Anyone can inspect
who paid whom, when they paid, and sometimes infer wallet activity.

Z lets a subscriber pay through STRK20, attach an encrypted memo
receipt, and prove access without exposing their full wallet history.

## 0:25-0:50 - Live site

Screen cue: open `https://zeerostream.pages.dev`.

This is the live demo site. It presents a creator page with locked drops, a
private checkout lane, memo receipts, and selective access disclosure.

The app is non-custodial. Z prepares the payment action, but the
wallet handles note discovery, proof generation, signing, and submission.

## 0:50-1:20 - Creator page

Screen cue: scroll to the creator profile and locked feed.

Here is the creator experience. A creator can publish public previews, keep
premium drops locked, and let subscribers unlock access with a private payment.

The goal is to make private payments feel like a normal creator checkout, not a
complicated blockchain workflow.

## 1:20-1:55 - Private payment

Screen cue: scroll to the private payment panel.

This is the Mainnet private payment flow.

First, Z checks whether the connected wallet supports the STRK20
Wallet API. It uses a capability check, not a private balance request.

Then the user reviews the token, amount, recipient, and reviewed Mainnet pool
before signing. The flow is dry-run, review, acknowledgement, then wallet
signature.

Z never receives signing keys, viewing keys, private notes, private
balances, or proof witnesses.

## 1:55-2:20 - Encrypted memo

Screen cue: show the memo and creator inbox demo.

The payment can include an encrypted memo receipt. A subscriber can add delivery
context or a paid reply note.

The app stores ciphertext and receipt binding only. The creator imports and
decrypts the memo locally, so private content is not exposed as public chain
data.

## 2:20-2:40 - Receipt room

Screen cue: show the Private Creator Receipt Room.

This is the creator's receipt room. It turns the three Mainnet STRK20 receipts
into a workflow a judge can inspect: the public hashes, what is visible at the
edge, what stays hidden inside the pool, and a local access pass for the creator
feed.

The access pass discloses only the tier, creator page, expiry, and receipt
binding. It does not disclose wallet history, private notes, memo plaintext, or
proof witnesses.

Screen cue: return to Home and post a public feed update.

The social feed accepts public creator updates only. If someone pastes a
viewing key, private key, witness value, private balance, or memo plaintext, the
post is rejected and belongs in encrypted messages instead. A Cloudflare Pages
Function is included for a D1-backed shared feed once the database binding is
approved.

## 2:40-2:55 - Selective disclosure

Screen cue: show "Show access. Hide everything else."

This section shows the access proof direction.

A creator gate should only learn that this person has the right tier for this
page right now. It should not scan wallet history, identity documents, private
notes, memos, or proof witnesses.

## 2:55-3:10 - Hackathon evidence

Screen cue: open `https://zeerostream.pages.dev/strk20.json`.

For the hackathon, the manifest includes three successful Starknet Mainnet
transactions that touched the reviewed STRK20 pool: creator shield, client
shield, and private payment.

The verifier checks the live app, this video URL, the pool class, and receipt
agreement across two RPC providers.

## 3:10-3:20 - Close

So the shipped sprint MVP is Z: private creator checkout, encrypted
memo receipts, the creator receipt room, selective access disclosure, and three
verified Mainnet STRK20 pool transactions.

Deposits, withdrawals, timing, and pool use are still public. Inside the pool,
STRK20 protects the private transfer relationship: sender, recipient, amount,
and spent notes.

Thank you.

## One-line backup

Z is a private creator checkout on Starknet Mainnet where subscribers
can pay through STRK20, attach an encrypted memo receipt, and prove access while
keeping signing keys, viewing keys, private notes, and proof generation inside
their own wallet.
