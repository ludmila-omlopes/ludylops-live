# Plan 003: Add route-level tests for bridge and Streamer.bot internal endpoints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 06f0792..HEAD -- src/app/api/internal src/lib/streamerbot`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (tests only — no production code changes)
- **Depends on**: plans/001-ci-verification-baseline.md (so the new tests run in CI)
- **Category**: tests
- **Planned at**: commit `06f0792`, 2026-06-11
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/138

## Why this matters

The HMAC-signed internal endpoints are the platform's money paths: the bridge daemon drives redemption claim/complete/fail (balance refunds happen in `fail`), and Streamer.bot posts presence points, bets, counters and quotes. Today only the HMAC primitive is unit-tested (`src/lib/streamerbot/security.test.ts`); **no route handler has any test**. A regression that drops signature verification from one route, or changes a response shape the C# scripts/bridge depend on, ships silently. These tests also serve as characterization before plans 004 and 005 change the underlying repository functions.

## Current state

- Route handlers follow one pattern — read raw body, verify HMAC, zod-parse, call one repository function, wrap in `ok()`/`fail()`. Exemplar `src/app/api/internal/bridge/[redemptionId]/claim/route.ts` (entire file):

```ts
export async function POST(
  request: Request,
  { params }: { params: Promise<{ redemptionId: string }> },
) {
  const raw = await request.text();
  const valid = verifySignedRequest({
    body: raw,
    timestamp: request.headers.get("x-timestamp"),
    signature: request.headers.get("x-signature"),
    secret: env.BRIDGE_SHARED_SECRET,
  });
  if (!valid) {
    return fail("Invalid signature.", 401);
  }
  const { redemptionId } = await params;
  const payload = bridgeClaimSchema.parse(JSON.parse(raw));
  return ok(await bridgeClaim(redemptionId, payload.bridgeId));
}
```

- Routes to cover (all under `src/app/api/internal/`):
  - Bridge (secret `env.BRIDGE_SHARED_SECRET`): `bridge/heartbeat/route.ts`, `bridge/pull/route.ts`, `bridge/[redemptionId]/claim/route.ts`, `bridge/[redemptionId]/complete/route.ts`, `bridge/[redemptionId]/fail/route.ts`.
  - Streamer.bot (secret `env.STREAMERBOT_SHARED_SECRET`): `streamerbot/events/route.ts`, `streamerbot/link/route.ts`, `streamerbot/points/route.ts`, `streamerbot/bets/place/route.ts`, `streamerbot/counters/route.ts`, `streamerbot/deaths/route.ts`, `streamerbot/quotes/route.ts` (list the directory — if more routes exist, e.g. `wheel`, cover them the same way).
  - Note: some routes (e.g. `points`) return a custom `NextResponse.json` with a `replyMessage` field on errors instead of plain `fail()` — assert what the code actually does, don't normalize.
- `src/lib/streamerbot/security.ts` exports `buildSignature({ body, timestamp, secret })` — use it in tests to produce valid signatures. `verifySignedRequest` returns `false` when secret/timestamp/signature missing, timestamp stale (>5 min), or HMAC mismatch.
- `src/lib/api.ts:7-13` — `ok()` returns `{ ok: true, data }`, `fail()` returns `{ ok: false, error }` with status.
- Test conventions: Vitest, `globals: true`, node environment, files matched by `src/**/*.test.ts` (`vitest.config.ts:11`). Mocking exemplar — `src/lib/db/repository.test.ts:1-15` uses `vi.hoisted` + `vi.mock("@/lib/db/client", ...)` and `vi.mock("@/lib/env", ...)`.
- Route handlers are plain async functions — import and call them directly with a `Request` and (where present) `{ params: Promise.resolve({...}) }`. No server needed.

## Commands you will need

| Purpose          | Command                                              | Expected on success |
|------------------|------------------------------------------------------|---------------------|
| Run new tests    | `npx vitest run src/app/api/internal`                | all pass            |
| Full suite       | `npm test`                                           | 196+ existing + new pass |
| Typecheck        | `npm run typecheck`                                  | exit 0              |
| Lint             | `npm run lint`                                       | exit 0              |

## Scope

**In scope** (create only — modify nothing):
- `src/app/api/internal/bridge/bridge-routes.test.ts` (create)
- `src/app/api/internal/streamerbot/streamerbot-routes.test.ts` (create)

**Out of scope** (do NOT touch):
- Any `route.ts` handler — this plan characterizes current behavior; if a test reveals a bug, record it in the report, don't fix it.
- `src/lib/db/repository.ts` and `src/lib/streamerbot/security.ts` — mocked / already tested respectively.
- `src/app/api/internal/ps-plus/` and `src/app/api/internal/steam/` — bearer-token routes, covered by plan 006.
- `src/app/api/internal/google/` — RISC receiver, different auth model, deliberately deferred.

## Git workflow

- Branch: `improve/003-route-tests-bridge-streamerbot` (from up-to-date `master`).
- Commit style: short imperative sentence, e.g. `Add route tests for bridge and Streamer.bot endpoints`.
- Do NOT push or open a PR unless the operator instructed it. PR body must include `Closes #<issue>` for this plan's issue.

## Steps

### Step 1: Build the test harness for bridge routes

Create `src/app/api/internal/bridge/bridge-routes.test.ts`:

- `vi.mock("@/lib/env", ...)` returning `{ env: { BRIDGE_SHARED_SECRET: "test-bridge-secret" }, isDemoMode: true, isProduction: false, adminEmails: new Set() }` (include every export the imported modules touch — check compile errors and extend the mock as needed).
- `vi.mock("@/lib/db/repository", ...)` with `vi.fn()` for each function the five bridge routes call (`bridgeClaim`, `bridgeComplete`, `bridgeFail`, plus whatever `heartbeat` and `pull` call — open those two files and mock their exact imports).
- Helper `signedRequest(body: unknown, { secret = "test-bridge-secret", timestamp = Date.now() } = {})` that JSON-stringifies the body, computes the signature with the real `buildSignature` from `@/lib/streamerbot/security`, and returns a `Request` with `x-timestamp`/`x-signature` headers and the raw string body. Sign the **exact** string sent as the body.

**Verify**: `npx vitest run src/app/api/internal/bridge` → file runs (even with 1 placeholder test).

### Step 2: Cover the bridge routes

For each of the five routes, test:

1. **Missing signature** → response status 401, body `{ ok: false }`, repository mock **not called**.
2. **Wrong secret** (sign with `"other-secret"`) → 401, repository mock not called.
3. **Valid signature** → repository mock called with the parsed payload (assert the arguments, e.g. `bridgeClaim` receives `(redemptionId, payload.bridgeId)`), response 200 with `{ ok: true, data: <mock return> }`.
4. For one route only (claim), **stale timestamp** (now − 10 min) → 401. (The window logic itself is covered in `security.test.ts`; one route-level case proves wiring.)

Param routes get `{ params: Promise.resolve({ redemptionId: "red-1" }) }` as the second argument.

**Verify**: `npx vitest run src/app/api/internal/bridge` → all pass.

### Step 3: Cover the Streamer.bot routes

Create `src/app/api/internal/streamerbot/streamerbot-routes.test.ts` with the same harness (secret `STREAMERBOT_SHARED_SECRET`). For each route: missing-signature 401 + valid-signature happy path asserting the repository function and response shape. For `points`, additionally assert the error path: repository mock rejects with `new Error("viewer_not_ready")` → status 400 and body contains a `replyMessage` string (this is the chat-reply contract the C# scripts parse).

Payloads must satisfy each route's zod schema — read `src/lib/streamerbot/schemas.ts` for required fields per schema and build minimal valid payloads.

**Verify**: `npx vitest run src/app/api/internal/streamerbot` → all pass.

### Step 4: Full suite

**Verify**: `npm test` → all pass (existing 196 + new; expect roughly 30-45 new tests). `npm run typecheck` and `npm run lint` → exit 0.

## Test plan

This plan *is* the test plan. Coverage contract: every bridge and Streamer.bot route has at minimum (a) unauthenticated 401 with repository untouched, (b) authenticated happy path asserting repository arguments and response shape. Model file structure on `src/lib/streamerbot/security.test.ts` (describe per route).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0
- [ ] `npx vitest run src/app/api/internal` reports ≥ 24 tests across 2 files, all passing
- [ ] Every route file under `src/app/api/internal/bridge` and `src/app/api/internal/streamerbot` is imported by a test (grep the test files for each route path)
- [ ] `git status` shows only the two new test files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A route handler does something structurally different from the excerpt pattern (e.g. doesn't verify signatures at all) — that's a security finding to report, not to patch here.
- Mocking `@/lib/env` cascades into more than ~6 modules needing mocks (the import graph is heavier than expected; report what you hit).
- A zod schema in `src/lib/streamerbot/schemas.ts` can't be satisfied with a reasonable minimal payload (schema may have moved or changed shape).

## Maintenance notes

- Plans 004 and 005 change `bridgeClaim`/`bridgeComplete`/`bridgeFail`/`redeemItem` semantics in the repository layer. These route tests mock that layer, so they should stay green — if they break, the route contract itself changed and the bridge daemon (`bridge/src`) and C# scripts (`streamerbot/`) must be re-checked.
- The `replyMessage` assertions encode the chat-reply contract with Streamer.bot C# scripts; if copy changes (Portuguese strings), update tests and scripts together.
- Deferred: tests against the real demo store (integration-style) and for `ps-plus`/`steam`/`google` internal routes.
