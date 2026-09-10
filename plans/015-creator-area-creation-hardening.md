# Plan 015: Harden creator-area creation errors and concurrent slug conflicts

> **Executor instructions**: Preserve the client-safe boundary in
> `src/lib/creators/area-form.ts`; it must not import database, environment, or
> Node-only modules. Unknown server failures must be logged server-side and must
> never be returned verbatim.
>
> **Drift check (run first)**: `git diff --stat 2565323..HEAD -- src/lib/creators/area-form.ts src/lib/creators/service.ts src/app/api/me/creator-area/route.ts src/lib/creators/service.test.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / bug
- **Planned at**: commit `2565323`, 2026-07-13
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/181

## Why this matters

Creator creation performs a check-then-insert around a unique slug. Concurrent
submissions are kept consistent by the database, but the losing request leaks
the raw Drizzle error through the API. Drizzle errors can include SQL and
parameters, and every unknown server failure is incorrectly returned as HTTP
400. The endpoint needs stable domain errors, conflict semantics, and a generic
500 boundary.

## Current state

- `area-form.ts` maps known strings, then returns the original `Error.message`.
- `service.ts` checks for an existing slug before a later transaction and
  rethrows unknown query failures.
- `api/me/creator-area/route.ts` returns the formatted error with status 400.
- The schema already has `creators_slug_idx`, so integrity is protected; the
  missing piece is deterministic error handling.
- Follow existing API helpers in `src/lib/api.ts` (`ok`/`fail`) and existing
  route-test mocking patterns under `src/app/api/**.test.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm test -- creator-area` | all matching tests pass |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Full tests | `npm test` | all pass |

## Scope

**In scope**: `src/lib/creators/area-form.ts`, `service.ts`, a server-only creator
error mapper/type if needed, `src/app/api/me/creator-area/route.ts`, and focused
service/route tests.

**Out of scope**: changing onboarding fields, adding owner quotas, changing the
schema, returning an existing creator owned by another account, or exposing
database error text in development responses.

## Git workflow

- Branch `codex/015-creator-area-creation-hardening` from updated `master`.
- Commit message: `harden creator area creation errors`.

## Steps

### Step 1: Separate client validation from server error classification

Keep Zod/form formatting in `area-form.ts`. Introduce server-only stable error
codes or typed errors for invalid slug, reserved slug, missing owner, missing
schema, slug conflict, and unexpected failure. Unknown `Error.message` must not
cross the HTTP boundary.

**Verify**: a unit test passes an error containing fake SQL/parameters and the
public mapper output contains neither.

### Step 2: Make the database the conflict arbiter

Remove reliance on the preflight select for correctness. Catch the Postgres
unique-violation code/constraint for `creators_slug_idx` and map it to a stable
`creator_slug_exists` conflict. If retry recovery is implemented, only return an
existing creator after confirming the same `ownerUserId`; never reveal another
owner's record.

**Verify**: concurrent/conflict tests return one success and one stable conflict,
with no raw query text.

### Step 3: Normalize the route contract

Return 400 for validation, 409 for slug conflict, 401/403 as today for auth and
origin failures, and 500 with a generic Portuguese message for unexpected
server failures. Log the original error server-side with appropriate context,
but not secrets.

**Verify**: route tests assert each status and response body.

### Step 4: Run all gates

**Verify**: lint, typecheck, focused tests, and full tests exit 0.

## Test plan

- Invalid JSON and invalid fields → 400.
- Duplicate slug → 409 and stable message.
- Simulated Drizzle error with SQL/params → 500 and generic message.
- Transaction failure rolls back and returns 500.
- Same-owner retry behavior, if supported, cannot return another owner's area.

## Done criteria

- [ ] No unknown error message is returned verbatim.
- [ ] Slug conflicts are deterministic under concurrency.
- [ ] Status codes distinguish validation, conflict, and server failure.
- [ ] New route/service tests pass.
- [ ] Client bundle boundary remains intact.
- [ ] Lint, typecheck, and full tests pass.

## STOP conditions

- Conflict detection requires parsing human-readable database messages instead
  of a stable error code/constraint.
- Retry recovery cannot prove ownership.
- A proposed helper imports server-only code into `area-form.ts`.

## Maintenance notes

Use the same allowlist-and-generic-500 pattern for platform-owner mutation
routes; malformed payload and nonexistent-FK cases were observed there too.
