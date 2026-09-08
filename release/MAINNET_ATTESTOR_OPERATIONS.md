# Gigstark Mainnet attestor operations

Status: `DRAFT_NO_KEY_NO_BROADCAST`

This policy governs the Stark-curve key that signs action-bound
`GigstarkPassportVerifier` receipts. It is not a wallet signer, a STRK20
viewing key, the pool auditor key, or a key that can move funds.

## Authority and custody

- The Gigstark 2-of-3 Mainnet multisig is the only policy administrator.
- Generate the production attestor key outside the repository and browser.
- Never place its secret scalar, seed, keystore password, or unencrypted backup
  in Git, chat, CI, deployment JSON, frontend code, logs, or analytics.
- Record only the public Stark-curve key in the deployment review package.
- The test key and deterministic synthetic fixtures under `compute/` are never
  eligible for production.

## Initial activation

1. Generate a dedicated production key using an independently reviewed
   offline or isolated signing procedure.
2. Independently verify the public key, audience, purpose, credential class,
   validity window, and unique policy ID.
3. Configure the new policy. The contract stages it inactive.
4. Read the complete policy back from two independent Mainnet RPC providers.
5. After reviewer approval, submit a separate 2-of-3 multisig transaction to
   activate it.
6. Verify the activation receipt and onchain policy state before issuing any
   receipt.

## Routine rotation

- Never overwrite or reuse a configured policy ID; the contract rejects it.
- Create a new unique policy ID for every attestor key or policy-window change.
- Stage and verify the replacement while the old policy remains active.
- Stop issuing under the old policy, activate the reviewed replacement, then
  deactivate the old policy in separately reviewed multisig actions.
- Keep receipt validity short enough that stopping issuance and deactivation
  bound exposure; the exact maximum lifetime must be approved before release.

## Suspected compromise

1. Stop the attestor service and Gigstark actions that require new receipts.
2. Use the 2-of-3 multisig to deactivate every affected policy immediately.
3. Confirm deactivation through two independent Mainnet RPC providers.
4. Do not restore service with the suspected key or reuse its policy ID.
5. Generate a replacement key, create a new inactive policy, and repeat the
   full review and activation procedure.
6. Publish a public incident record containing affected public policy IDs,
   timestamps, and transaction hashes, but no secret or private user data.

Past valid receipts remain bounded by their policy window, receipt expiry, exact
audience/action binding, and one-use scope nullifier. Deactivation blocks new
consumption under that policy; it does not erase public chain history.

## Release gate

The rotation and compromise booleans remain `false` until an independent
reviewer approves this document and the exact production public key and receipt
lifetime. A draft policy is evidence of preparation, not deployment approval.
