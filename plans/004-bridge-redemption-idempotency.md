# Plan 004: Make bridge redemption claim/complete/fail idempotent with status guards

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 06f0792..HEAD -- src/lib/db/repository.ts src/lib/db/schema.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (changes live money-path semantics; mitigated by tests and by matching existing demo-path behavior)
- **Depends on**: plans/003-route-tests-bridge-streamerbot.md (route contract characterized first)
- **Category**: bug
- **Planned at**: commit `06f0792`, 2026-06-11
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/139

## Why this matters

The local bridge daemon (`bridge/src`) is a retrying poller: it claims a redemption, calls Streamer.bot, then reports `complete` or `fail`. The database paths of `bridgeClaim`, `bridgeComplete`, and `bridgeFail` in `src/lib/db/repository.ts` update **without any status condition**, so retried or duplicated HTTP calls corrupt state:

- A retried `fail` call runs the refund transaction again → **the viewer is refunded twice** (balance and ledger both corrupted).
- `complete` can overwrite a `failed` (already refunded) redemption → item marked delivered AND refunded.
- `claim` can re-claim an executing/completed redemption, incrementing `bridgeAttemptCount` and reassigning `claimedByBridgeId` arbitrarily.

The demo (in-memory) path of `bridgeClaim` already guards `status !== "queued"` — the DB path simply never got the guard. This plan makes every transition status-guarded and the refund exactly-once, with a DB-level backstop via the ledger's existing unique index.

## Current state

All in `src/lib/db/repository.ts`. The redemption status values in use: `"queued"` → `"executing"` → `"completed"` | `"failed"` (see `RedemptionRecord["status"]` in `src/lib/types.ts` — verify the exact union there).

- `bridgeClaim` (lines 9917-9942). Demo path guards: `if (!redemption || redemption.status !== "queued") return null;` (9922). DB path does NOT:

```ts
await db
  .update(redemptions)
  .set({
    status: "executing",
    claimedByBridgeId: bridgeId,
    bridgeAttemptCount: sql`${redemptions.bridgeAttemptCount} + 1`,
  })
  .where(eq(redemptions.id, redemptionId));        // ← no status condition

const [redemption] = await db.select().from(redemptions).where(eq(redemptions.id, redemptionId)).limit(1);
return redemption ?? null;
```

- `bridgeComplete` (9944-9967): demo path sets `status = "completed"` unconditionally (9952); DB path updates `WHERE eq(redemptions.id, redemptionId)` only (9957-9963).
- `bridgeFail` (9969-10033): demo path refunds unconditionally (9978-9993); DB path selects the redemption, then in a transaction sets `status = "failed"`, **adds `costAtPurchase` back to `viewerBalances.currentBalance`, and inserts a `redemption_refund` ledger row** — all with no status condition (10002-10029). This is the double-refund.
- Schema facts (`src/lib/db/schema.ts`): `redemptions.status` is `varchar(32) notNull` (line 415); `pointLedger.externalEventId` is `varchar(128)` with `uniqueIndex("point_ledger_external_event_idx")` (lines 140, 145) — Postgres allows multiple NULLs, so today's NULL-externalEventId rows are unaffected by adding values.
- The repo already uses the guarded-update-with-`.returning()` pattern — exemplar `boostGameSuggestion` at lines 6354-6370 (`.where(and(...)) ... .returning(...)` then `if (!debited) throw`). Match it.
- Drizzle `and`, `eq`, `inArray`, `sql` are already imported at the top of `repository.ts` (verify; add imports only if missing).
- Test exemplar: `src/lib/db/repository.test.ts:1-15` — `getDbMock` via `vi.hoisted` + `vi.mock("@/lib/db/client")` and `vi.mock("@/lib/env", () => ({ isDemoMode: false, ... }))`. New tests follow this pattern.

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|--------------------------------------------------|---------------------|
| Typecheck | `npm run typecheck`                              | exit 0              |
| New tests | `npx vitest run src/lib/db/repository-bridge.test.ts` | all pass       |
| Full suite| `npm test`                                       | all pass            |
| Lint      | `npm run lint`                                   | exit 0              |

## Scope

**In scope** (the only files you should modify/create):
- `src/lib/db/repository.ts` — only the three functions `bridgeClaim`, `bridgeComplete`, `bridgeFail` (demo and DB paths)
- `src/lib/db/repository-bridge.test.ts` (create)

**Out of scope** (do NOT touch):
- The route handlers under `src/app/api/internal/bridge/` — the HTTP contract (return `ok(<record|null>)`) is unchanged.
- `bridge/src/**` — the daemon already handles `null`/non-success data; changing it is a separate task.
- `src/lib/db/schema.ts` — no schema change needed (the ledger unique index already exists).
- Any other function in `repository.ts` (`redeemItem` is plan 005).

## Git workflow

- Branch: `improve/004-bridge-redemption-idempotency` (from up-to-date `master`).
- Commit style: short imperative sentence, e.g. `Guard bridge redemption transitions with status conditions`.
- Do NOT push or open a PR unless the operator instructed it. PR body must include `Closes #<issue>` for this plan's issue.

## Steps

### Step 1: Guard `bridgeClaim` (DB path)

Replace the unconditional update with a guarded one mirroring the demo path's semantics (claim only from `queued`):

```ts
const [claimed] = await db
  .update(redemptions)
  .set({
    status: "executing",
    claimedByBridgeId: bridgeId,
    bridgeAttemptCount: sql`${redemptions.bridgeAttemptCount} + 1`,
  })
  .where(and(eq(redemptions.id, redemptionId), eq(redemptions.status, "queued")))
  .returning();

return claimed ?? null;
```

Keep the function's return type/shape identical to today (it returns the raw row or null — confirm callers in `src/app/api/internal/bridge/[redemptionId]/claim/route.ts` just wrap it in `ok()`).

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Guard `bridgeComplete` (both paths)

DB path: guarded update `WHERE id = ? AND status = 'executing'` with `.returning()`. If no row was updated, select the current row; if its status is already `"completed"`, return it (idempotent retry); otherwise return `null`.

Demo path: same semantics — if `redemption.status === "completed"`, return it unchanged; if `redemption.status !== "executing"`, return `null`; else transition.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Make `bridgeFail` refund exactly once (both paths)

DB path: inside the transaction, make the status update the gate:

```ts
const [failed] = await tx
  .update(redemptions)
  .set({ status: "failed", failedAt: new Date(), failureReason })
  .where(
    and(
      eq(redemptions.id, redemptionId),
      inArray(redemptions.status, ["queued", "executing"]),
    ),
  )
  .returning();

if (failed) {
  // existing balance update + ledger insert, unchanged except:
  // externalEventId: `redemption_refund:${redemptionId}`
}
```

Only run the balance update and ledger insert when `failed` is returned. Set `externalEventId: \`redemption_refund:${redemptionId}\`` on the ledger insert (currently `null` at line 10026) — the existing unique index `point_ledger_external_event_idx` then makes a second refund insert impossible at the DB level even under concurrent transactions.

After the transaction, keep the existing re-select + return. A call on an already-`failed` redemption returns the current row **without** refunding (idempotent retry); on a `completed` redemption it returns the row unchanged (no transition, no refund).

Demo path: add the same guard — only refund + ledger when transitioning from `queued`/`executing`; return the record unchanged if already `failed`; do not transition from `completed`.

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Write the tests

Create `src/lib/db/repository-bridge.test.ts` modeled on `src/lib/db/repository.test.ts`'s `getDbMock` pattern. DB-path cases (mock the drizzle chain so `.returning()` yields `[]` for "no row matched" and `[row]` for success):

1. `bridgeClaim`: returning `[]` → resolves `null`; returning `[row]` → resolves the row with `status: "executing"`.
2. `bridgeComplete`: returning `[]` + current row `failed` → `null`; returning `[]` + current row `completed` → that row; returning `[row]` → row.
3. `bridgeFail`: returning `[]` (already failed) → **no** balance update, **no** ledger insert (assert the tx mocks were not called); returning `[row]` → balance update called once, ledger insert called once with `externalEventId` = `redemption_refund:<id>`.

Demo-path cases (separate `describe` with `vi.mock("@/lib/env", () => ({ isDemoMode: true, ... }))` via a second mock setup or `vi.resetModules` + dynamic import — follow whatever isolation approach `repository.test.ts` uses for env variants; if it has none, use a dedicated test file section with `vi.resetModules`):

4. demo `bridgeFail` twice on the same redemption → balance increases by `costAtPurchase` exactly once.
5. demo `bridgeComplete` on a `failed` redemption → `null`, status stays `failed`.

**Verify**: `npx vitest run src/lib/db/repository-bridge.test.ts` → all pass.

### Step 5: Full verification

**Verify**: `npm test` → all pass (including plan 003's route tests, which mock this layer and must stay green); `npm run lint` → exit 0; `npm run typecheck` → exit 0.

## Test plan

Covered in step 4. The two regression tests that encode this plan's reason to exist: *retried `bridgeFail` refunds exactly once* and *`bridgeComplete` cannot resurrect a failed redemption*.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0; `npm run lint` exits 0
- [ ] `npm test` exits 0; `src/lib/db/repository-bridge.test.ts` exists with the 5 case groups above
- [ ] In `repository.ts`, each of the three functions' DB update on `redemptions` includes a status condition (`grep -n "eq(redemptions.status" src/lib/db/repository.ts` returns ≥ 2 matches and `grep -n "inArray(redemptions.status" src/lib/db/repository.ts` returns ≥ 1)
- [ ] The refund ledger insert sets `externalEventId` containing `redemption_refund:`
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The three functions don't match the "Current state" excerpts (drift).
- The status union in `src/lib/types.ts` contains values other than `queued | executing | completed | failed` — the guard sets must be re-derived, report what you found.
- `bridge/src` turns out to depend on re-claiming an `executing` redemption (search `bridge/src` for retry logic around claim before starting; if a retry path expects a non-null re-claim, report instead of changing semantics).
- Plan 003's route tests fail after your change (the HTTP contract shifted — that must not happen).

## Maintenance notes

- A redemption whose bridge crashed mid-execution now stays `executing` forever (claim guard blocks re-claim). That was already demo-path behavior and is safer than double-execution, but a stale-claim recovery mechanism (e.g. admin requeue, or claim timeout) is the natural follow-up — it pairs with the "audit trail for redemptions and bridge execution" item already seeded in `.github/workflows/bootstrap-backlog.yml`.
- Reviewer should scrutinize: the `bridgeFail` transaction — refund and ledger must be inside the `if (failed)` branch, and the `externalEventId` value must be deterministic per redemption.
- If an admin-side "force fail/requeue" feature is added later, it must route through these same guarded functions, not raw updates.
