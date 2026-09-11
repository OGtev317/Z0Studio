# Z0Studio Production Operations

## Current release

Z0Studio is deployed independently at `https://z0studio.pages.dev/`.
It uses the `Z0STUDIO_DB` D1 binding for accounts, opaque session records,
follows, creator rooms, membership approvals, room posts, and reports.

The earlier ZeeroStream hackathon project is separate and frozen. Do not point
this project at its database or deploy Z0Studio files to that Pages project.

## Local pending schema

Local source now includes `migrations/0004_room_customization.sql` for
persistent room accent, cover, welcome, posting rhythm, and rules settings.
That migration was not applied to `z0studio-production` in the local build
checkpoint that added it. Apply it only during an explicitly approved release.

## Deploy

1. Run `npm test`, `npm run typecheck`, `npm run build`, and
   `npm audit --omit=dev`.
2. Apply reviewed migrations with
   `npx wrangler d1 migrations apply z0studio-production --remote`.
3. Deploy the generated `out` directory with
   `npx wrangler pages deploy out --project-name z0studio --branch main`.
4. Verify `/`, `/api/auth/me`, and `/api/rooms` return expected responses over
   HTTPS.

## Security boundary

- Authentication uses a random opaque cookie token; only its SHA-256 digest is
  stored in D1. Cookie values are HttpOnly, SameSite=Lax, and Secure on HTTPS.
- Passwords use unique salts and PBKDF2-SHA-256. Passwords, session cookies,
  wallet keys, seed phrases, viewing keys, notes, and proofs must never be
  logged or placed in source control.
- Write endpoints require a same-origin request, an authenticated session, and
  creator ownership where applicable. Room membership is pending until its
  creator approves it.
- Registration and sign-in use D1-backed fixed-window rate limits keyed by a
  hash of Cloudflare's client address (and normalized email for sign-in). Raw
  addresses are not stored in the rate-limit table.
- No environment secret is required for the current account/session model.
  Add future provider credentials only with `wrangler secret put`; never add
  them to `wrangler.jsonc`, source, or a client bundle.

## Operations

- Review request activity, Pages errors, and D1 metrics in the Cloudflare
  Workers & Pages dashboard for the `z0studio` project and
  `z0studio-production` database.
- Use `npx wrangler pages deployment list --project-name z0studio` to inspect
  releases and `npx wrangler d1 migrations list z0studio-production --remote`
  before each deploy.
- Do not run destructive D1 commands as a rollback. Create a new forward
  migration for schema corrections.

## Deliberately excluded

STRK20 checkout, wallet connection, payment activation, token deployment,
signing, and any ZeeroCash transaction remain out of this production release.
