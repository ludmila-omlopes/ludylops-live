# Plan 018: Bind Streamer.bot requests to per-creator credentials

> **Executor instructions**: This is a staged security migration. Read current
> official Streamer.bot documentation before changing setup instructions or C#
> scripts. Never log or commit a generated credential. Maintain a compatibility
> window for the Ludylops/default creator and document its removal gate.
>
> **Drift check (run first)**: `git diff --stat ec19f8f..HEAD -- src/lib/env.ts src/lib/streamerbot src/app/api/internal/streamerbot streamerbot src/lib/db/schema.ts README.md`

## Status

- **Reconciliation**: implemented and locally validated on 2026-09-20; awaiting PR integration. Depends on PR #194 bringing the already implemented #172 schema to master. No shared/production database or production credential was changed.

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans 014 / #180 and 017 / #183
- **Category**: security
- **Planned at**: commit `ec19f8f`, reconciled 2026-09-15 (same file tree as remote master `f353ce2`).
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/184

## Why this matters

All Streamer.bot routes verify one global `STREAMERBOT_SHARED_SECRET`, while the
signature covers only timestamp and body. Creator resolution considers an
unsigned header and otherwise falls back to Ludylops on canonical production
hosts. Distributing the global secret to multiple creators would provide no
cryptographic proof of which tenant a request may affect.

## Current state

- `env.ts` defines a single global Streamer.bot secret.
- `security.ts` signs `${timestamp}.${body}`.
- Internal routes independently call `verifySignedRequest` with that secret.
- `tenant.ts` reads `x-creator-slug`, but it is not signed authority and is
  ignored on canonical production hosts by the current resolution rule.
- Onboarding installs the Streamer.bot module for every creator.
- Existing C# scripts use `lojaneon.streamerbotSharedSecret`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm test -- streamerbot` | all matching tests pass |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Full tests | `npm test` | all pass |
| Build | `$env:NEXTAUTH_SECRET='ci-build-only-dummy-secret'; npm run build` | exit 0 |

## Scope

**In scope**: credential schema/migration, secure secret storage strategy,
signature helpers, all Streamer.bot request verification call sites, generated
scripts/catalog, admin setup/rotation surface, docs, and tests.

**Out of scope**: bridge credentials (a separate unnumbered prerequisite before
multi-creator redemptions), operational data scoping itself, exposing plaintext secrets after initial
creation, or accepting `x-creator-slug` as authorization.

## Git workflow

- Update the remote base, then branch `codex/018-streamerbot-creator-credentials` after plans 014 and 017.
- Commit logical units: schema, verifier, routes, scripts/docs.
- Do not apply the generated migration or rotate production credentials.

## Steps

### Step 1: Design the credential record and signed envelope

Use a non-secret credential id to locate the creator, status, and encrypted
verification secret. Because HMAC verification needs the original secret, store
it using an approved encryption-at-rest mechanism/master key; do not store a
plain reversible value without a documented threat model. Canonical input should
include at least timestamp, credential id, and raw body. The creator id comes
from the verified credential record, never an unsigned slug.

**Verify**: a design test proves changing credential id, body, or timestamp
invalidates the signature.

### Step 2: Add schema and rotation states

Add a creator-scoped credential table with unique public id, encrypted secret,
active/retiring/revoked state, timestamps, and optional last-used audit data.
Support overlap so scripts can rotate without downtime. Follow plan 014's
migration strategy; do not apply the migration.

**Verify**: schema/type tests and generated migration inspection pass.

### Step 3: Centralize request authentication

Create one helper that reads the raw body once, resolves the credential, verifies
the canonical signature, enforces creator active status and Streamer.bot module
availability where plan 019 provides it, and returns authenticated creator
context. Replace per-route global-secret verification across events, link,
points, bets, counters, deaths, quotes, and wheel.

Enforce plan 017's lifecycle policy and at least the creator's own Streamer.bot
module status here; plan 019 later supplies the full dependency policy. No
circular dependency on plan 019 is needed. Authentication alone must not enable
a non-default creator to call an unscoped repository function. Add an explicit
server-side rollout gate per handler/action: only the default creator may use
legacy operations until their complete data/side-effect path is isolated.
Plan 009 may open only the verified quote actions, never the entire quote
endpoint indiscriminately. Initially all non-default operational actions remain
unavailable, including a correctly signed request. Administrative credential
provisioning uses existing platform-owner authorization; streamer self-service
requires a future creator-owner permission path, not global admin access.

**Verify**: route tests cover wrong creator, revoked credential, tampered id,
expired timestamp, valid rotation overlap, and default compatibility.

### Step 4: Stage default-creator compatibility

Keep `STREAMERBOT_SHARED_SECRET` only as an explicitly temporary fallback for
the default creator. Add logging/health visibility that identifies legacy usage
without logging secrets, and define the metric/date gate for removal.

**Verify**: tests prove legacy credentials cannot select a non-default creator.

### Step 5: Update Streamer.bot setup

Update script templates/catalog and README so each creator configures its own
credential id and secret. Check current official Streamer.bot C# variables and
HTTP behavior before writing instructions. Provide create, rotate, test, revoke,
and rollback steps.

**Verify**: generated/example signature matches the TypeScript test vector.

### Step 6: Run all gates

**Verify**: lint, typecheck, focused/full tests, and build exit 0.

## Test plan

- Same payload signed by creator A cannot authorize creator B.
- Credential-id tampering fails.
- Revoked credentials fail; active+retiring overlap succeeds during rotation.
- Legacy global secret can reach only the default creator.
- Valid non-default credentials cannot invoke legacy unscoped actions; assert
  the repository helper was not called.
- Disabled creators or disabled Streamer.bot module are denied before any effect.
- Raw body is verified before JSON parsing.

## Done criteria

- [x] Every accepted Streamer.bot request yields creator context from verified credentials (legacy signatures are fixed to the default creator).
- [x] Non-default operations remain blocked until their complete action path is scoped; credential issuance alone does not enable them.
- [x] Unsigned slug/host input cannot select another tenant.
- [x] Secrets are never logged or returned after initial provisioning.
- [x] Rotation and revocation are documented and tested.
- [x] Migration is generated; no shared/production schema was applied. Storage verification used a fresh exported schema in a disposable local database.
- [x] Lint, typecheck, tests, and build pass.

## STOP conditions

- Production provisioning has no valid dedicated encryption key: fail closed until the operator configures it. Offline implementation/tests use the documented AES-256-GCM design and synthetic test keys; they do not provision a production key.
- A route must parse/re-serialize JSON before verifying the signature.
- Compatibility would allow the global secret to select arbitrary creators.
- Streamer.bot behavior differs from the current official docs.

## Maintenance notes

Bridge credentials and queue scoping are separate missing work; this plan does
not make resgates safe for multiple streamers. Remove the global-secret fallback after all default-creator scripts report the
new credential id. Any future integration must derive tenant authority from a
verified credential, not routing headers.

## Implementation report — 2026-09-20

- Started from fetched `origin/master` at `b0db76c` in worktree `issue-184`. PR #193 had been merged into the former #190 branch after #190 reached master, leaving schema 0023 outside master. Opened [PR #194](https://github.com/ludmila-omlopes/ludylops-live/pull/194) for that remaining change and merged its branch locally as a prerequisite. Integrate #194 first. This delivery targets master, avoiding another orphaned stacked merge.
- Added `streamerbot_credentials` and generated `0024_lonely_lady_deathstrike.sql` plus snapshot/journal as-is: one table, one foreign key and one creator index, no historical SQL edits.
- Encryption design decision: dedicated 32-byte environment key, AES-256-GCM with random IV and authenticated credential/creator IDs. No automatic key generation in production, no plaintext storage, no fallback to other application secrets. Threat model and master-key rotation limits are in `docs/streamerbot-credentials.md`.
- Centralized verification reads raw body once. V2 HMAC binds timestamp, credential ID, method, pathname and raw body. All eight operational handlers gate non-default creators before payload parsing or repository effects. Creator status and installed Streamer.bot module are checked by verified ID, with no synthetic production fallback.
- Platform-owner-only management in `/owner` supports one-time issuance, 24-hour rotation overlap and revocation. Same-origin mutation validation, no-store responses and sanitized failures protect the management API. Row locking serializes issuance/rotation/revocation for each creator. A read-only integration check records authentication without executing live commands.
- Updated ten HTTP scripts, their catalog, README and added a credential-check action. Kept the shared-signature helper unchanged for bridge compatibility. Legacy Streamer.bot acceptance is fixed to Ludylops and can be disabled with `STREAMERBOT_LEGACY_AUTH_ENABLED=false`; its usage/removal metric and review date are documented.

### Validation

- `npm test -- streamerbot`: 93 tests in 11 files passed, including UI controls, all eight route gates, signature tampering, overlap/revocation, owner authorization, origin checks and sanitized errors.
- `npm test`: **496 tests in 57 files passed**. The route inventory now includes the two new endpoints. Typecheck, lint, demo-mode production build and `git diff --check` passed.
- Compiled all eleven C# signing methods with .NET and compared their output with TypeScript using identical UTF-8 input containing Portuguese accents and emoji. All matched. This does not claim the real Streamer.bot installation or triggers were exercised.
- Fresh PostgreSQL 17.11 on `127.0.0.1:55474`, connected through a localhost-only Neon adapter on port 55475: applied exported current schema with `psql -v ON_ERROR_STOP=1`, seeded synthetic creators/modules, then exercised the actual Drizzle services and authenticator.
- Database assertions passed for encrypted storage, secret-free projections, initial issuance, valid signatures, last-used audit, 24-hour overlap/expiry, revoke, cross-creator revoke rejection, concurrent initial issuance/rotation/revocation, disabled/archived creators/modules, missing module, missing key with zero writes, and foreign-key enforcement. All non-default rollout gates denied effects; legacy auth retained the default creator even with misleading host/header input.
- Local harnesses under ignored `node_modules/.issue-184` were verification-only. The real `.env` was held aside; no production credentials/fixtures were used. Migration application and actual Streamer.bot configuration remain deployment tasks, with exact setup/test/rollback instructions in the runbook.
