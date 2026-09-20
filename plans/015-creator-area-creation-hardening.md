# Plan 015: Harden creator-area creation errors and concurrent slug conflicts

> **Executor instructions**: Preserve the client-safe boundary in
> `src/lib/creators/area-form.ts`; it must not import database, environment, or
> Node-only modules. Unknown server failures must be logged server-side and must
> never be returned verbatim.
>
> **Drift check (run first)**: `git diff --stat ec19f8f..HEAD -- src/lib/creators/area-form.ts src/lib/creators/service.ts src/app/api/me/creator-area/route.ts src/lib/creators/service.test.ts`

## Status

- **State**: IN PROGRESS (2026-09-15): implementation and local validation complete in `.worktrees/issue-181`; awaiting PR/integration. Validation: 362 tests (43 new), typecheck, lint, and build without a real database. Transaction/concurrency tests use an adapter simulation; no shared database was queried or changed.

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / bug
- **Planned at**: commit `ec19f8f`, reconciled 2026-09-15 (same file tree as remote master `f353ce2`).
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/181

## Why this matters

Creator creation performs a check-then-insert around a unique slug. Concurrent
submissions are kept consistent by the database, but the losing request leaks
the raw Drizzle error through the API. Drizzle errors can include SQL and
parameters, and every unknown server failure is incorrectly returned as HTTP
400. The endpoint needs stable domain errors, conflict semantics, and a generic
500 boundary.

## Baseline before implementation

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

- [x] No unknown error message is returned verbatim.
- [x] Slug conflicts use the existing unique constraint and are covered by simulated concurrent requests.
- [x] Status codes distinguish validation, conflict, and server failure.
- [x] New route/service tests pass.
- [x] Client bundle boundary remains intact.
- [x] Lint, typecheck, full tests, and build pass.

## Implementation notes

- PostgreSQL code `23505` and constraint `creators_slug_idx` must occur on the same cause object to produce HTTP 409. Query text is never parsed to infer conflicts or missing schema.
- Unexpected failures during authorization, payload reading, transaction execution, or post-commit resolution produce a generic HTTP 500. Logs contain only the operation stage and allowlisted diagnostic codes; the original error is retained internally as a cause, without dumping SQL, parameters, messages, or stacks.
- Malformed JSON alone produces the payload-specific HTTP 400. Input validation and reserved/invalid slugs remain HTTP 400; authentication/origin checks retain HTTP 401/403.
- The resolver result must match the newly inserted creator ID, slug, and owner. A post-commit resolution failure does not undo the successful transaction; retrying that slug returns a conflict, including for the same owner. No existing creator is returned as retry recovery.
- No schema, historical migration, dependency, or UI component changed. PostgreSQL behavior itself was not exercised against a live database.

## STOP conditions

- Conflict detection requires parsing human-readable database messages instead
  of a stable error code/constraint.
- Retry recovery cannot prove ownership.
- A proposed helper imports server-only code into `area-form.ts`.

## Maintenance notes

Use the same allowlist-and-generic-500 pattern for platform-owner mutation
routes; malformed payload and nonexistent-FK cases were observed there too.
