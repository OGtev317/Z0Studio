# STRK20 Sepolia integration pin

Reviewed contract source pin: `starkware-libs/starknet-privacy` tag
`PRIVACY-0.14.3-RC.0`, commit
`fe52334dde1c5479176ab1e75311cf6e81a320c2`. The upstream compatibility
matrix lists this tag for the privacy-pool contract. The later RC.5 release is
an SDK release and is not used as the contract dependency pin.

| Field | Value |
| --- | --- |
| Target network | Starknet Sepolia only |
| Privacy pool | `0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91` |
| Upstream Cairo/Starknet package | `2.17.0` |
| Required return | `privacy::objects::OpenNoteDeposit` as `Span<OpenNoteDeposit>` |
| Wallet stack | `starknet@10.4.0`, Wallet API types `0.10.3`, discovery `6.0.2`, wallet standard `6.0.2` |
| Exact ABI package | `@starkware-libs/starknet-privacy-sdk@0.14.3-rc.5`, tag `PRIVACY-0.14.3-RC.5`, commit `66e3caae8c0201227a6719696d004e30d90aea65` |
| Live-source candidate | `starkware-libs/starknet-privacy@5bf8aae27f9c1aaefa53eea133dc29343ad196ac` |
| Canonical live ABI SHA-256 | `82048b31b314b22d58ef6c72064ff6ce9ba554ea6b924f9eac7cd032bac9848f` |

## Read-only Sepolia verification

On 2026-08-23, two independent public RPC providers were checked with
`starknet@10.4.0`. The check requires the exact `SN_SEPOLIA` chain ID, accepted
and recent heads, `syncing: false`, an advancing head on both providers, the
same hash at a common block, the same class at the pool address, and a
recomputed Sierra class hash. It also calls the pool's state-dependent views
and checks the exact V2 invoke ABI surface.

The latest successful run reported:

- chain ID: `SN_SEPOLIA`;
- both provider heads advancing;
- address class hash:
  `0x56ab118a8a6e38efc93ad758cefe909fee421fa931ce3cf72df624d345623b2`;
- recomputed on-chain Sierra class hash equal to the address class;
- `get_version`: `2.0`;
- `get_proof_validity_blocks`: `450`; and
- `get_upgrade_delay`: `0` seconds.

That live class hash does **not** equal the RC.0 privacy-pool class hash
`0x52107fadffab71bdcbb6b2ccb68ba3e1b5558d94036538053e159d3076ad633`
published in the upstream compatibility table. A clean build of that tag
reproduced the published RC.0 class hash. A clean build of the official
`CONTRACT_V2_DEPLOYED_MAINNET_2026-07-08` tag reproduced class hash
`0x067dddd89d80fedadc06b6f160798f94800a4a70164e5a24301cd0d6076b554d`.
Neither reproducible source class matches the observed Sepolia class. The live
ABI exposes the expected privacy-pool surface, including `apply_actions`,
`compile_actions`, and `get_fee_amount`, but no reviewed primary deployment
record currently maps this Sepolia class back to a reproducible source
artifact.

## Narrowed source candidate

The current class was declared at block `12932191` in transaction
`0x1139db11de5493f884322d528ec89cf91560eadc52a5ae909d68668451019b7`,
with compiled class hash
`0x674605405ee63b71556db1c252e7bcb112babd1b0ea89562aa29ed75111db75`.
It replaced the pool's official V2 class at block `12932675` in transaction
`0x59f76fec2b924279e475d94c3b0d01f56cff857dfd730e25e05f1fcfe4344f2`.
Both receipts succeeded and are accepted on L1.

StarkWare commit `5bf8aae27f9c1aaefa53eea133dc29343ad196ac` merged roughly two
minutes before the class declaration. Its full 87-item ABI canonically hashes
to `82048b31...9848f`, exactly matching the live ABI. This is strong evidence
for the source-level candidate and pins the observed `InvokeExternal`,
`ComputeAndInvoke`, screening, view, and event shapes.

It is not yet cryptographic source reproduction. With the commit's own Scarb
2.17.0 lock and repository-defined profiles, a clean dev build produces class
`0x7af31b...f153c` and a clean release build produces
`0x261555...9b82`; neither equals `0x56ab...623b2`. Additional inlining-profile
probes also did not reproduce the live class. This indicates an unpublished
build-profile, dependency-state, or source difference. The `OpenNoteDeposit`
definition itself is unchanged between RC.0 and the candidate commit, but that
fact does not authorize the upgraded pool class.

The ABI/package mapping is exact and separately reproducible. The generated
87-item pool ABI in both SDK tags `PRIVACY-0.14.3-RC.4` and
`PRIVACY-0.14.3-RC.5` hashes to `82048b31...9848f`, exactly matching the class
returned by Sepolia. Gigstark pins RC.5 for Wallet SDK interface work. This
proves interface identity; it does not prove that RC.5 produced the deployed
Sierra class.

The public source lineage was rebuilt with the official Scarb 2.17.0 toolchain:

| Source revision | Release class | Sierra felts |
| --- | --- | ---: |
| V2 parent `c02eca0` | `0x067dddd8...6b554d` | 20,546 |
| PR revision `d4768dd` | `0x06b3e282...6218a94` | 20,562 |
| PR revisions `9e28913` / `964ef72` | `0x02acb134...43563a` | 20,602 |
| PR head `b496442` / merge `5bf8aae` | `0x026155f9...59b82` | 20,618 |
| Live Sepolia class | `0x056ab118...623b2` | 20,646 |

The merge build was reproduced on ARM64 macOS and with the same x86_64 Linux
Scarb binary used by public CI; both produced `0x026155...59b82`. Compiler-host
architecture therefore does not explain the live class. The public merge CI
ran tests only and published no contract artifact.

The live onchain Sierra was also compiled independently with the repository-
pinned `universal-sierra-compiler 2.8.0`. It reproduced compiled class hash
`0x674605...db75` exactly and produced 42,083 CASM bytecode felts. This proves
that the declared Sierra/CASM artifact pair is internally reproducible. It does
not map those artifacts back to Cairo source, so it does not add the live class
to the reviewed-source allowlist. The upstream provenance request is tracked in
[`starkware-libs/starknet-privacy#969`](https://github.com/starkware-libs/starknet-privacy/issues/969).

A local clean-room source survey rebuilt every contract-affecting mainline
commit from the official screening audit base through current `main`, using
each commit's pinned Scarb generation (`2.17.0` or `2.18.0`). It also checked
the relevant public privacy branch tips. None reproduced `0x56ab...623b2`.
The exact ABI match and declaration timeline narrow the candidate further than
ABI similarity alone, but do not replace artifact reproduction.

## Compatibility decision

The mismatch is resolved in code by failing closed, not by guessing source
compatibility. Wallet preparation and submission now query the provider for the
chain ID and latest class at the exact pool address; caller-supplied class data
cannot satisfy the runtime gate. The currently observed Sepolia class therefore
raises `STRK20_POOL_CLASS_UNREVIEWED` before the wallet is called. A live demo
is blocked until StarkWare publishes or confirms the package/commit that
produces the observed class, or Gigstark reviews a different exact deployment.

Run `npm run verify:starknet-health` for the read-only, two-provider environment
gate. Run `npm run verify:strk20-pool` for that same health gate plus the
declaration/activation receipts and source-reproduction decision. The second
command intentionally exits nonzero while the observed class cannot be
reproduced. Different endpoints can be supplied through
`GIGSTARK_SEPOLIA_RPC` and `GIGSTARK_SEPOLIA_RPC_SECONDARY`; no key or account
is required.

Run `GIGSTARK_USC_BIN=/absolute/path/to/universal-sierra-compiler-2.8.0 npm run
verify:strk20-artifacts` to re-fetch the live class and reproduce both
declaration hashes. The command uses a temporary directory, removes the fetched
artifacts after verification, and never requests a wallet or key.

The zero-second pool upgrade delay means class provenance can change without a
timelock window. A health result is only a point-in-time observation. Gigstark
must re-read the exact class immediately before preparation and submission and
must continue to reject any class outside the reviewed allowlist.

To clear the source gate, upstream must provide enough primary evidence to
recompute both declaration hashes: the exact source tree or commit, `Scarb.lock`,
Scarb/Cairo version, effective workspace profile, Sierra artifact matching
`0x56ab...623b2`, and CASM artifact matching `0x674605...db75`. A release tag or
SDK version without those artifacts is insufficient.

The checked-in `.tool-versions` pins Scarb `2.17.0` and Starknet Foundry
`0.59.0`. The Cairo draft imports only the reviewed `OpenNoteDeposit` type from
the pinned contract source. The recorded Sepolia pool address still requires a
fresh read-only class-hash and ABI check immediately before any declaration or
deployment; the upstream repository publishes the reviewed pool class hash but
does not publish this deployment address in its compatibility table.

Gigstark's escrow, subscription, tier-gate, and action-authorization code is
app-team code. It is not an
official STRK20 escrow package and must receive independent Cairo, protocol,
and operational review before declaration or deployment.
