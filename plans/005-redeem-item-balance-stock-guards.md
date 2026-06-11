# Plan 005: Prevent balance overdraw and stock oversell in redeemItem

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 06f0792..HEAD -- src/lib/db/repository.ts`
> If `repository.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (adds guards to one transaction; the target pattern already exists in the same file)
- **Depends on**: plans/001-ci-verification-baseline.md (CI runs the new tests); independent of plans 003/004
- **Category**: bug
- **Planned at**: commit `06f0792`, 2026-06-11
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/140

## Why this matters

`redeemItem` (the catalog purchase path, called from `src/app/api/me/redeem/route.ts`) validates the viewer's balance **before** its transaction, then debits inside the transaction with no guard. Two concurrent redeem requests both pass validation and both debit — the balance goes negative, violating the app's core invariant. The same shape of bug applies to stock: the decrement writes `item.stock - 1` using a value read before the transaction, so two concurrent redemptions of a 1-stock item both succeed and stock data corrupts. The codebase already has the correct pattern (`gte`-guarded update + `.returning()` + throw-to-rollback) thirty lines of pattern away in `boostGameSuggestion` — this plan applies it to `redeemItem`.

## Current state

All in `src/lib/db/repository.ts` (DB path of `redeemItem`; the demo path is out of scope — single-threaded in-memory, no race):

- Pre-transaction validation (8604-8613): `evaluateRedeemability({ item, balance: dashboard.balance.currentBalance, ... })`, then `if (!validation.canRedeem) throw new Error(validation.reason);`. Locate `evaluateRedeemability`'s definition in this file and note its exact Portuguese reason strings for insufficient balance and out-of-stock — **reuse those strings** in the new throws so API consumers see consistent messages. (Per AGENTS.md: keep the accents intact; do not round-trip the file through PowerShell `Get-Content`/`Set-Content`.)
- The unguarded debit inside the transaction (8645-8652):

```ts
await tx
  .update(viewerBalances)
  .set({
    currentBalance: sql`${viewerBalances.currentBalance} - ${item.cost}`,
    lifetimeSpent: sql`${viewerBalances.lifetimeSpent} + ${item.cost}`,
    lastSyncedAt: new Date(),
  })
  .where(eq(viewerBalances.viewerId, dashboard.viewer.id));   // ← no balance condition
```

- The stale stock write (8664-8671):

```ts
if (item.stock !== null) {
  await tx
    .update(catalogItems)
    .set({
      stock: item.stock - 1,        // ← value read before the transaction
    })
    .where(eq(catalogItems.id, item.id));
}
```

- The correct in-repo pattern, `boostGameSuggestion` (6354-6370):

```ts
const [debited] = await tx
  .update(viewerBalances)
  .set({ currentBalance: sql`... - ${input.amount}`, ... })
  .where(
    and(
      eq(viewerBalances.viewerId, input.viewerId),
      gte(viewerBalances.currentBalance, input.amount),
    ),
  )
  .returning({ viewerId: viewerBalances.viewerId });
if (!debited) {
  throw new Error("saldo_insuficiente");
}
```

  Throwing inside `db.transaction` rolls back the redemption insert and ledger insert — that's the mechanism this plan relies on.
- Drizzle helpers `and`, `eq`, `gte`, `sql` are already imported in `repository.ts`; `gt` may not be — add it to the existing `drizzle-orm` import if missing.
- Test exemplar: `src/lib/db/repository.test.ts` (`getDbMock` pattern, lines 1-15). Check whether it already has `redeemItem` cases — if yes, extend there; if not, create `src/lib/db/repository-redeem.test.ts`.

## Commands you will need

| Purpose   | Command                | Expected on success |
|-----------|------------------------|---------------------|
| Typecheck | `npm run typecheck`    | exit 0              |
| Tests     | `npm test`             | all pass            |
| Lint      | `npm run lint`         | exit 0              |

## Scope

**In scope**:
- `src/lib/db/repository.ts` — only the DB-path transaction inside `redeemItem`
- `src/lib/db/repository.test.ts` or `src/lib/db/repository-redeem.test.ts` (extend/create)

**Out of scope** (do NOT touch):
- `evaluateRedeemability` — the pre-validation stays as the user-friendly fast path; the in-transaction guards are the correctness backstop.
- The demo path of `redeemItem` and everything else in `repository.ts` (bridge functions are plan 004).
- `src/app/api/me/redeem/route.ts` — the route already converts thrown errors to API failures; its contract is unchanged.
- Cooldown/featured logic inside `redeemItem` — unrelated.

## Git workflow

- Branch: `improve/005-redeem-item-guards` (from up-to-date `master`).
- Commit style: short imperative sentence, e.g. `Guard redeemItem balance debit and stock decrement`.
- Do NOT push or open a PR unless the operator instructed it. PR body must include `Closes #<issue>` for this plan's issue.

## Steps

### Step 1: Guard the balance debit

Inside the `redeemItem` transaction, change the `viewerBalances` update to include `gte(viewerBalances.currentBalance, item.cost)` in the `where(and(...))`, add `.returning({ viewerId: viewerBalances.viewerId })`, and throw with the existing insufficient-balance reason string when no row comes back — exactly mirroring `boostGameSuggestion` (6354-6370).

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Make the stock decrement atomic

Replace the stale `stock: item.stock - 1` write with an atomic guarded decrement:

```ts
if (item.stock !== null) {
  const [stocked] = await tx
    .update(catalogItems)
    .set({ stock: sql`${catalogItems.stock} - 1` })
    .where(and(eq(catalogItems.id, item.id), gt(catalogItems.stock, 0)))
    .returning({ id: catalogItems.id });
  if (!stocked) {
    throw new Error(/* the exact out-of-stock reason string from evaluateRedeemability */);
  }
}
```

Add `gt` to the `drizzle-orm` import if not present.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Tests

Using the `getDbMock` chain pattern, cover the DB path:

1. Debit `.returning()` yields `[]` → `redeemItem` rejects with the insufficient-balance reason; assert the ledger insert and stock update were **not** executed after the throw.
2. Stock decrement `.returning()` yields `[]` (stock raced to 0) → rejects with the out-of-stock reason.
3. Happy path: both guards return rows → resolves with a redemption whose `status === "queued"`; ledger insert called once with `amount: -item.cost`.
4. `item.stock === null` (unlimited) → no `catalogItems` update at all (preserves current behavior).

**Verify**: `npx vitest run <the test file>` → all pass.

### Step 4: Full verification

**Verify**: `npm test`, `npm run lint`, `npm run typecheck` → all exit 0.

## Test plan

Covered in step 3. The regression tests that encode this plan: *concurrent-overdraw is impossible (zero-row debit throws and rolls back)* and *zero-row stock decrement throws and rolls back*.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0; the 4 new cases exist and pass
- [ ] In `redeemItem`'s transaction, the `viewerBalances` update's `where` contains `gte(viewerBalances.currentBalance` (grep confirms)
- [ ] `grep -n "item.stock - 1" src/lib/db/repository.ts` returns no matches
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `redeemItem`'s transaction doesn't match the excerpts (drift — e.g. plan 004 landed changes nearby; re-read before editing).
- `evaluateRedeemability` has no distinct reason strings for insufficient balance / out of stock (then the route's error contract is unclear — report the strings you found instead of inventing new ones).
- The Neon serverless driver rejects `.returning()` on an update inside a transaction (it shouldn't — `boostGameSuggestion` already does it — but if it does, that exemplar is broken too; report).

## Maintenance notes

- The pre-transaction `evaluateRedeemability` and the in-transaction guards are intentionally redundant: the first gives friendly errors including cooldown logic, the second is the concurrency backstop. Future cooldown changes go in the first; never remove the second.
- Reviewer should scrutinize: that throws happen *inside* `db.transaction` (rollback) and that the reason strings match `evaluateRedeemability`'s exactly (Portuguese accents included).
- Deferred: the demo path keeps its check-then-act shape (no concurrency in-memory); aligning it is cosmetic.
