# Plan 008: Add `creator_id` to operational tables (schema + backfill, no behavior change)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 0b73c37..HEAD -- src/lib/db/schema.ts src/lib/creators/defaults.ts drizzle`
> If `src/lib/db/schema.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (schema migration on a production Neon database; non-breaking by design, but touches many tables)
- **Depends on**: plan 014 (migration/data-seed baseline must guarantee `creator_ludylops` before the foreign-keyed backfill)
- **Category**: migration
- **Planned at**: commit `0b73c37`, 2026-07-07
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/172

## Why this matters

The white-label foundation can create creator instances (their own subdomain, branding, modules), but **every operational table is still single-tenant**: `bets`, `redemptions`, `game_suggestions`, `point_ledger`, `quotes`, etc. have no `creator_id`, so all creators would read and write the same Ludylops data. This plan adds the `creator_id` column (backfilled to the default creator) and its index to the operational tables that have simple surrogate primary keys — the mechanical, non-breaking half of the isolation work. It intentionally makes **no query or behavior changes**: after this plan every existing row belongs to `creator_ludylops` and the app behaves exactly as before. It is the safe foundation that the per-entity scoping plans (009+) build on.

Tables with natural/global keys that need constraint surgery (`viewer_balances`, `quotes.quote_number` unique, `catalog_items.slug` unique, `quote_overlay_state`, `obs_overlay_control`, `streamerbot_counters`) are **deliberately excluded here** and handled in plan 009 and later — see Scope.

## Current state

- `src/lib/creators/defaults.ts:5` — the default creator id constant:
  ```ts
  export const DEFAULT_CREATOR_ID = "creator_ludylops";
  ```
  The actual `creators` **row** for this id may or may not exist in a real database — the app falls back to an in-memory `defaultCreatorTenant` when the row is absent (`src/lib/creators/tenant.ts:35-40,283`). Because this plan adds a foreign key to `creators`, **the row must exist before backfilling** (Step 1 handles this).

- `src/lib/db/schema.ts` — Drizzle table definitions. The foundation tables already carry `creator_id`; pattern to copy (`schema.ts:83-102`, `creator_modules`):
  ```ts
  creatorId: varchar("creator_id", { length: 64 })
    .references(() => creators.id)
    .notNull(),
  // ...in the table's index callback:
  creatorIdIdx: index("creator_modules_creator_id_idx").on(table.creatorId),
  ```

- Migration mechanism: editing `schema.ts` then running `npm run db:generate` (drizzle-kit) emits a new `drizzle/NNNN_*.sql` file plus a snapshot under `drizzle/meta/`. Applying to a database is `npm run db:push` — an **operator decision, not part of this plan** (see Step 5). Example of a generated migration: `drizzle/0022_naive_silk_fever.sql` is a single `ALTER TABLE ... ADD COLUMN`.

- The in-scope tables today have **surrogate primary keys** (a `varchar id`) and no `creator_id`. Representative excerpt (`schema.ts:223-245`):
  ```ts
  export const bets = pgTable("bets", {
    id: varchar("id", { length: 64 }).primaryKey(),
    question: text("question").notNull(),
    // ... no creator_id
  });
  export const betOptions = pgTable("bet_options", {
    id: varchar("id", { length: 64 }).primaryKey(),
    betId: varchar("bet_id", { length: 64 }).references(() => bets.id).notNull(),
    // ...
  });
  ```

- Backfill strategy (decided): add the column as **`NOT NULL DEFAULT 'creator_ludylops'`**. Postgres backfills every existing row with the default in the single `ADD COLUMN` statement — safe and non-breaking. The default stays for now; a later plan drops it once all inserts specify `creator_id` explicitly. Do NOT hand-write `UPDATE` backfill SQL.

- Child tables get their own `creator_id` (denormalized) so later query-scoping is a single indexed filter with no joins — this is a deliberate decision, not an oversight.

## Commands you will need

| Purpose            | Command                | Expected on success              |
|--------------------|------------------------|----------------------------------|
| Install            | `npm install`          | exit 0                           |
| Generate migration | `npm run db:generate`  | new `drizzle/NNNN_*.sql` created |
| Lint               | `npm run lint`         | exit 0                           |
| Typecheck          | `npx tsc --noEmit`     | exit 0, no errors                |
| Tests              | `npm test`             | all pass (300 baseline)          |
| Build              | `npm run build`        | exit 0 (needs `NEXTAUTH_SECRET` env set for the prod build; use any non-empty dummy value locally) |

Note: this is Next.js 16 / Drizzle. Do NOT run `npm run db:push` (it mutates the live database). On Windows do not round-trip source files through PowerShell `Get-Content`/`Set-Content`.

## Scope

**In scope** — add `creator_id` (`varchar(64)`, `.references(() => creators.id)`, `.notNull()`) **and** a `<table>_creator_id_idx` index to exactly these tables in `src/lib/db/schema.ts`:

1. `point_ledger`
2. `bets`
3. `bet_options`
4. `bet_entries`
5. `game_suggestions`
6. `game_suggestion_boosts`
7. `video_suggestions`
8. `video_suggestion_boosts`
9. `creator_suggestions`
10. `creator_suggestion_boosts`
11. `product_recommendations`
12. `redemptions`
13. `live_like_goals`
14. `live_like_goal_rewards`
15. `streamerbot_event_log`
16. `bridge_clients`

Plus:
- `src/lib/db/schema.ts` (the edits above)
- the generated `drizzle/NNNN_*.sql` and `drizzle/meta/*` snapshot files (created by `db:generate`, committed as-is)
- a seed/ensure step for the default `creators` row (Step 1) — location decided in Step 1

**Out of scope** (do NOT touch — these are handled by plan 009 and later because they need primary-key / unique-constraint changes or are the pilot vertical):

- `quotes`, `quote_overlay_state`, `quote_overlay_queue`, `obs_overlay_control` — quotes vertical + composite-key surgery, plan 009.
- `viewer_balances` — needs composite PK `(viewer_id, creator_id)`; plan 009/010.
- `catalog_items` — `slug` unique must become composite; later plan.
- `streamerbot_counters` — keyed by `key`, and dual-used to store creator-area-access settings (`src/lib/creators/access.ts:9`); needs careful handling; later plan.
- **Identity tables stay global** (a viewer is one Google identity across creators): `users`, `google_accounts`, `google_account_viewers`, `viewer_links`.
- **Shared reference / infra stay global**: `ps_plus_catalog_items`, `ps_plus_catalog_sync_state`, `google_risc_deliveries`.
- **Any `.ts` file other than `schema.ts`** — no repository query changes, no service changes. This plan is schema-only. If you find yourself editing `repository.ts`, STOP.

## Git workflow

- Update local `master` from origin first, then branch: `codex/008-creator-id-schema-groundwork`.
- Short imperative commit messages matching `git log` (e.g. `add creator_id to operational tables`).
- Do NOT push or open a PR unless the operator instructed it. Do NOT run `db:push`.

## Steps

### Step 1: Ensure the default `creators` row exists before adding foreign keys

The new columns default to `'creator_ludylops'` and reference `creators.id`. If no `creators` row with that id exists, applying the migration to a real database fails the FK check. Investigate how the default creator is (or isn't) persisted:

- Read `src/lib/creators/defaults.ts` and search for any existing seed of the default creator: `grep -rn "DEFAULT_CREATOR_ID\|creator_ludylops" src/ drizzle/`.
- If a seed already inserts the `creator_ludylops` row (e.g. in a migration or a startup path), record where and proceed.
- If **no** seed exists, add an idempotent seed of the default creator row (`id: DEFAULT_CREATOR_ID`, `slug: DEFAULT_CREATOR_SLUG`, `displayName: DEFAULT_CREATOR_DISPLAY_NAME`, `ownerUserId: null` or the existing convention, `status` matching `DEFAULT_CREATOR.status`) as an `INSERT ... ON CONFLICT DO NOTHING` at the **top of the migration SQL** generated in Step 3, so the row is guaranteed present before the FK columns are added in the same migration. Use the values from `DEFAULT_CREATOR` in `defaults.ts` — do not invent them.

**STOP** and report if you cannot determine the shape of the `creators` row from `defaults.ts` (do not guess column values for a table with NOT NULL fields).

**Verify**: `grep -n "creator_ludylops" drizzle/*.sql` (after Step 3) shows the seed insert precedes the `ADD COLUMN ... creator_id` statements.

### Step 2: Add `creator_id` + index to each in-scope table in `schema.ts`

For each of the 16 tables listed in Scope, add the column and index following the `creator_modules` exemplar, but with the backfill default:

```ts
creatorId: varchar("creator_id", { length: 64 })
  .references(() => creators.id)
  .notNull()
  .default(DEFAULT_CREATOR_ID),
```

and, in each table's index callback (add a `(table) => ({ ... })` callback if the table doesn't have one yet — see `point_ledger` at `schema.ts:217` for the callback form, and `bets` at `schema.ts:223` for a table that currently has none):

```ts
creatorIdIdx: index("<table_name>_creator_id_idx").on(table.creatorId),
```

Import `DEFAULT_CREATOR_ID` from `@/lib/creators/defaults` at the top of `schema.ts` (verify the import path resolves — check existing imports in that file first; if `schema.ts` must not import from `creators/defaults` due to a dependency cycle, inline the literal string `"creator_ludylops"` with a comment referencing `DEFAULT_CREATOR_ID`, and note this in your report).

**Verify**: `npx tsc --noEmit` → exit 0. `grep -c "creator_id_idx" src/lib/db/schema.ts` → increased by exactly 16.

### Step 3: Generate the migration

Run `npm run db:generate`. Confirm a new `drizzle/NNNN_*.sql` appears containing 16 `ALTER TABLE ... ADD COLUMN "creator_id" varchar(64) DEFAULT 'creator_ludylops' NOT NULL` statements and the `CREATE INDEX` statements, plus a new snapshot in `drizzle/meta/`. Add the default-creator seed insert from Step 1 at the top of this SQL file.

**Verify**: `git status --porcelain drizzle/` shows the new `.sql` and updated `meta/` files. `grep -c "ADD COLUMN \"creator_id\"" drizzle/*.sql` (the newest file) → 16.

### Step 4: Confirm no behavior change

Run the full suite — nothing in application code changed, so all existing tests must still pass unchanged. Demo mode does not read the new column, so demo tests are unaffected.

**Verify**: `npm test` → all pass (≥300); `npm run lint` → exit 0; `npm run build` → exit 0.

### Step 5: Document that the migration is generated but NOT applied

Applying to the Neon database (`npm run db:push`) is an operator decision (matches how plan 006 handled its index migration). In your report, state clearly: the migration file is committed but has NOT been pushed; the operator must run `npm run db:push` against the target database, and the default-creator seed must succeed first.

**Verify**: n/a (reporting step).

## Test plan

- No new unit tests: this is a schema-only, behavior-preserving change and the repository query paths are untouched. The regression guarantee is "the existing 300 tests still pass unchanged."
- If you want an optional guard, add a trivial assertion in a schema-level test that `bets` (and one child, `bet_options`) expose a `creatorId` column via `getTableColumns` from `drizzle-orm` — only if a similar schema test already exists to model on; otherwise skip rather than invent a new test harness.
- Verification: `npm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `grep -c "creator_id_idx" src/lib/db/schema.ts` increased by exactly 16 vs. base
- [ ] A new `drizzle/NNNN_*.sql` exists with 16 `ADD COLUMN "creator_id"` statements and a leading default-creator seed insert
- [ ] `npm test` exits 0 with the baseline test count still passing (no test changes required)
- [ ] `npm run lint` exits 0 and `npm run build` exits 0
- [ ] `git status` shows only `schema.ts`, `drizzle/**`, and (if added) the seed change modified — no other `.ts` files
- [ ] `plans/README.md` status row updated
- [ ] Report explicitly states `db:push` was NOT run

## STOP conditions

Stop and report back (do not improvise) if:

- The default `creators` row cannot be confirmed or safely seeded (Step 1) — an FK column defaulting to a non-existent creator id would break on apply.
- `npm run db:generate` produces DROP statements or touches tables outside the 16 in scope (a sign `schema.ts` drifted or an unrelated pending change exists).
- Any in-scope table turns out to already have a `creator_id` column (someone started this work) — report which.
- `schema.ts` cannot import `DEFAULT_CREATOR_ID` without a dependency cycle AND inlining the literal is ambiguous.
- You find yourself needing to change a primary key or unique index to make the column fit — that means the table belongs to plan 009's constraint-surgery set, not here.

## Maintenance notes

- The `DEFAULT 'creator_ludylops'` on each column is a **temporary backfill aid**. A later plan (after all inserts pass `creator_id` explicitly) should drop the column default so a missing `creator_id` fails loudly instead of silently landing in the default tenant.
- This plan does not scope any query — after it lands, the app is still effectively single-tenant at runtime. Do not mistake "column exists" for "isolation works." Plan 009 begins the actual scoping.
- Reviewer focus: confirm the migration is additive-only (no drops), the seed precedes the FK columns, and no application code changed.
- When plan 009+ scope reads/writes, they rely on every operational row having a non-null `creator_id` — which this plan guarantees via the default. Keep the default until that guarantee moves into application code.
