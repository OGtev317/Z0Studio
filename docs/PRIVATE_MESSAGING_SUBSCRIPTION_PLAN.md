# ZeeroStream private messaging and subscription plan

## Product thesis

ZeeroStream should ship in two connected layers:

1. **Private payment memos and encrypted mail**: a metadata-minimizing message
   layer for STRK20 participants. A pool transaction can carry an encrypted
   memo or inbox envelope without putting sender address, recipient address, or
   plaintext onchain.
2. **Private creator subscriptions and escrow negotiation**: creator-commerce
   flows that reuse the same channel model for paid inboxes, tier access,
   dispute negotiation, and one-period-at-a-time private payments.

The first layer is the product wedge. It is smaller, easier to audit, and
creates the primitive subscriptions and escrow need: private coordination
between two pool participants.

## Privacy claim, stated precisely

| Element | Intended hidden surface | Still visible |
| --- | --- | --- |
| Sender identity | Hidden from public observers because the helper is called through the pool, not directly by the user. | A pool transaction happened at a time. |
| Recipient identity | Hidden if calldata contains only an unlinkable routing tag, not the recipient address or public profile. | A message envelope was appended to a tag. |
| Message content | Encrypted locally before submission. The helper stores ciphertext only. | Ciphertext length bucket, timestamp, helper address, and storage write. |
| Payment amount | Hidden only for STRK20 private transfers. | Deposits, withdrawals, open-note amounts, helper-visible transfer amounts, and timing can remain public depending on action shape. |
| Subscription membership | Hidden from public wallet scans; creator-side analytics derive from the creator viewing key or local decrypted events. | Optional aggregate counters, if a creator explicitly enables them. |

Do not use absolute claims like "nothing appears onchain." Registration,
deposits, withdrawals, nullifiers, helper calls, timestamps, and some amount
edges remain public. The credible claim is: **private pool movement and message
contents hide the relationship from ordinary public observers when users avoid
linkable timing and distinctive amount patterns.**

## Architecture

### 1. Message helper contract

Build a small Cairo helper callable through STRK20 `InvokeExternal`.

The helper stores:

- `routing_tag`: a felt or short felt span derived offchain from a pairwise
  message secret and purpose string.
- `sequence`: dense per-tag index assigned by the helper.
- `ciphertext_commitment`: Poseidon hash or equivalent digest of the envelope.
- `ciphertext`: bounded felt span, or a content-addressed blob pointer plus
  digest if the payload is too large for economical calldata.
- `expiry`: optional retention boundary.
- `replay_nullifier`: one-use value derived by the sender device for this
  envelope and channel.

The helper must reject:

- plaintext-looking payload fields;
- Starknet account addresses as recipient identifiers;
- duplicate replay nullifiers;
- oversized envelopes;
- expired write attempts;
- calls not made by the reviewed privacy pool.

The helper should emit an envelope event keyed by `routing_tag` and `sequence`.
That event is visible, but unlinkable to the recipient if the tag is derived
correctly and never reused across public contexts.

### 2. Channel key and routing derivation

The sender needs a recipient contact card offchain:

```text
recipient_pool_address_or_alias  // used locally for wallet readiness only
recipient_public_viewing_key
recipient_inbox_domain
optional creator profile signature
```

The sender device derives:

```text
message_secret = ECDH(sender_ephemeral_key, recipient_public_viewing_key)
channel_key = H("ZEEROSTREAM_MESSAGE_CHANNEL_V1", message_secret, creator_domain)
routing_tag = H("ZEEROSTREAM_MESSAGE_ROUTE_V1", channel_key, purpose, epoch_bucket)
encryption_key = H("ZEEROSTREAM_MESSAGE_ENC_V1", channel_key, sequence_salt)
```

The exact derivation must be reviewed against the STRK20 SDK/channel design
before implementation. The important product property is that the onchain
helper receives `routing_tag` and ciphertext, not the recipient address.

### 3. Indexer and device discovery

The indexer is not trusted with plaintext.

MVP behavior:

1. Fetch helper events by `routing_tag`.
2. Return ordered ciphertext envelopes and commitments.
3. The recipient device derives candidate routing tags from local contacts or
   a bounded scan window, decrypts locally, and rejects tampered envelopes.

Later behavior:

- Add cursor persistence per local device.
- Add retention deletion markers and expiry compaction.
- Add spam controls: sender proof of paid pool participation, creator allow
  lists, paid inbox fees, or rate-limited deposits.
- Add OHTTP or a relay path so indexer queries do not trivially reveal a
  recipient's IP-to-routing-tag interest.

### 4. SDK surface

Add a ZeeroStream SDK package before exposing this as app glue:

```ts
type SendMessageInput = {
  recipientContact: RecipientContact;
  plaintext: Uint8Array;
  purpose: "memo" | "mail" | "escrow_terms" | "subscription_notice";
  retention?: { expiresAt: number };
};

type DiscoverMessagesInput = {
  contacts: readonly RecipientContact[];
  fromCursor?: string;
};

async function sendMessage(input: SendMessageInput): Promise<PreparedMessage>;
async function discoverMessages(input: DiscoverMessagesInput): Promise<DiscoveredMessage[]>;
```

For wallet dapp mode, `sendMessage` prepares public helper calldata and passes
the final action list to the user's privacy-enabled wallet. It must not ask the
dapp for a viewing key, note data, private balances, proof witnesses, or
signing material.

### 5. Payment memo transaction

The attractive product primitive is a private transfer with a memo in the same
user-approved wallet action.

Preferred UX:

1. User selects **Pay creator privately**.
2. User adds an optional memo.
3. Browser encrypts the memo locally.
4. Wallet dry-runs one reviewed action package.
5. User signs once.
6. Recipient later discovers the payment note through the wallet and the memo
   through the message indexer.

Protocol constraint to verify before promising same-transaction shipping: the
pool permits at most one phase-7 external invoke per private transaction. If
the private transfer itself needs no helper, memo append can use that invoke.
If another helper is already needed for escrow or DeFi, memo append must be
folded into that helper or sent as a separate pool transaction.

## Shipping phases

### Phase A: finish the hackathon submission

Status: nearly done.

- Add the public demo-video URL to `strk20.json` and `public/strk20.json`.
- Re-run `npm test`, `npm run typecheck`, `npm run build`,
  `npm run verify:strk20-mainnet`, and `npm run verify:hackathon-submission`.
- Deploy the static `out/` build only after explicit approval.
- Verify the live `/strk20.json` contains the three receipts and video URL.

This phase should not include new helper contracts or messaging claims.

### Phase B: local encrypted memo prototype

Goal: prove the product behavior without chain risk.

- Build a browser-only memo composer beside the current private payment flow.
- Encrypt/decrypt envelopes with local test keys.
- Persist only ciphertext, route tags, commitments, and cursors in local demo
  storage.
- Add tests for wrong recipient, tampering, replay nullifier reuse, retention,
  and plaintext/key rejection.
- Update the demo to show "payment receipt plus encrypted memo" without
  claiming onchain transport.

Exit gate: deterministic tests and UI demo prove the envelope model locally.

### Phase C: Sepolia message helper and indexer

Goal: ship encrypted onchain mail between reviewed test wallets.

- Implement `ZeeroStreamMessageHelper` as a minimal pool-pinned helper.
- Add Cairo tests for pool-only caller, append ordering, replay rejection,
  payload bounds, expiry, and event shape.
- Build a read-only indexer that fetches helper events and returns ciphertext
  by routing tag.
- Add SDK methods `prepareMessageAppend`, `sendMessage`, and
  `discoverMessages`.
- Wire wallet dry-run and explicit acknowledgement before any signature.
- Run a Sepolia-only two-wallet demo with no production fund movement.

Exit gate: recipient device decrypts only its own messages from Sepolia helper
events; wrong keys and tampered envelopes fail.

### Phase D: private payment memos on Mainnet

Goal: first credible "remittance with note" public-chain primitive.

- Verify current Mainnet pool class, helper address, wallet API version, and
  exact action shape immediately before launch.
- Independently review the helper, SDK derivation, indexer query privacy, and
  UI claims.
- Add memo attachment to the existing Mainnet private payment flow.
- Keep memo payloads small and length-bucketed.
- Add visible warnings for timing/amount linkage and public deposit edges.

Exit gate: one Mainnet private payment and one encrypted memo append are
verified without exposing recipient address or plaintext in helper calldata or
events.

### Phase E: escrow negotiation

Goal: let parties coordinate terms privately before moving funds.

- Add message purposes for proposal, counterproposal, acceptance, delivery
  notice, dispute notice, and cancellation.
- Bind accepted terms to the escrow helper by commitment, not plaintext.
- Keep delivery content and evidence offchain and encrypted.
- Use the existing escrow state machine only after helper review and Sepolia
  execution are complete.

Exit gate: two wallets negotiate terms through encrypted envelopes, then run a
reviewed private escrow deposit and exactly one settlement claim.

### Phase F: private subscriptions and tier access

Goal: creator subscriptions without public subscriber lists or wallet scanning.

Start with prepaid periods, not autonomous recurring charges:

- One user-approved period payment.
- Optional prepay up to a small bounded number of periods.
- Creator claim per paid period.
- Cancellation stops future prepayment and access renewal.
- Tier access uses a proof receipt or viewer commitment, not public token
  holdings or wallet scans.

Only after that is audited, evaluate session authority:

- Scope by token, amount, creator/helper, period, cumulative spend, expiry,
  revocation, and replay domain.
- Keeper execution must fail if any scope is exceeded or revocation is present.
- Paymaster use must not hide pool fees or create surprise charges.

Exit gate: a user can subscribe, cancel, and prove tier access without exposing
the subscriber list or giving ZeeroStream custody of keys or notes.

## Build order for this repository

1. Finish the current hackathon submission and deploy the receipt manifest.
2. Add local encrypted memo UI and tests.
3. Add `contracts/src/gigstark_message_helper.cairo` and Cairo tests.
4. Add `src/lib/private-messaging.ts` for envelope construction, route tags,
   commitments, and replay nullifiers.
5. Add `src/lib/message-indexer.ts` with a local adapter first, then a Sepolia
   RPC/event adapter.
6. Add SDK-style exports so the UI does not own cryptographic derivation.
7. Add payment memo UX to the existing private payment component.
8. Only then expand escrow negotiation and subscription flows.

## Review gates

- Cryptography review of derivation labels, nonce handling, replay nullifiers,
  ciphertext authentication, and length leakage.
- Cairo/security review of helper storage, event keys, caller restriction,
  payload bounds, and upgrade policy.
- Wallet review proving no viewing keys, notes, private balances, witnesses, or
  signing material enter the dapp.
- Indexer review for query privacy, retention, reorg handling, pagination, and
  spam resistance.
- Product-copy review to remove claims that overstate what STRK20 hides.

## Demo narrative

The winning story should be:

```text
ZeeroStream started as private creator payments.
Now the payment can carry an encrypted note.
That note becomes a private inbox.
The inbox becomes private negotiation.
Private negotiation becomes escrow and subscriptions.
All without public subscriber graphs, public payment relationships, or app
custody of wallet secrets.
```

Keep the live hackathon scope honest: current Mainnet evidence proves the
private payment route. Encrypted mail, memos, escrow negotiation, and
subscriptions become the staged product roadmap until their helper, indexer,
SDK, and audit gates are complete.
