# Plan 018: Bind Streamer.bot requests to per-creator credentials

> **Executor instructions**: This is a staged security migration. Read current
> official Streamer.bot documentation before changing setup instructions or C#
> scripts. Never log or commit a generated credential. Maintain a compatibility
> window for the Ludylops/default creator and document its removal gate.
>
> **Drift check (run first)**: `git diff --stat 2565323..HEAD -- src/lib/env.ts src/lib/streamerbot src/app/api/internal/streamerbot streamerbot src/lib/db/schema.ts README.md`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plan 014
- **Category**: security
- **Planned at**: commit `2565323`, 2026-07-13
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

**Out of scope**: bridge credentials unless deliberately unified in an approved
design, operational data scoping itself, exposing plaintext secrets after initial
creation, or accepting `x-creator-slug` as authorization.

## Git workflow

- Branch `codex/018-streamerbot-creator-credentials` after plan 014.
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
- Raw body is verified before JSON parsing.

## Done criteria

- [ ] Every Streamer.bot request yields creator context from verified credentials.
- [ ] Unsigned slug/host input cannot select another tenant.
- [ ] Secrets are never logged or returned after initial provisioning.
- [ ] Rotation and revocation are documented and tested.
- [ ] Migration is generated but not applied.
- [ ] Lint, typecheck, tests, and build pass.

## STOP conditions

- No approved encryption-at-rest mechanism/master key exists.
- A route must parse/re-serialize JSON before verifying the signature.
- Compatibility would allow the global secret to select arbitrary creators.
- Streamer.bot behavior differs from the current official docs.

## Maintenance notes

Remove the global-secret fallback after all default-creator scripts report the
new credential id. Any future integration must derive tenant authority from a
verified credential, not routing headers.
