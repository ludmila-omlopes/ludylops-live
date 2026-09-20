# Plan 008: Add `creator_id` to operational tables (schema + backfill, no behavior change)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ec19f8f..HEAD -- src/lib/db/schema.ts src/lib/creators/defaults.ts drizzle`
> If `src/lib/db/schema.ts` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Reconciliation**: planning update only; implementation remains pending. Issue #172 is synchronized from this file.

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (schema migration on a production Neon database; non-breaking by design, but touches many tables)
- **Depends on**: plan 014 (migration/data-seed baseline must guarantee `creator_ludylops` before the foreign-keyed backfill)
- **Category**: migration
- **Planned at**: commit `ec19f8f`, reconciled 2026-09-15 (same file tree as remote master `f353ce2`).
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/172

## Why this matters

The white-label foundation can create creator instances (their own subdomain, branding, modules), but **every operational table is still single-tenant**: `bets`, `redemptions`, `game_suggestions`, `point_ledger`, `quotes`, etc. have no `creator_id`, so all creators would read and write the same Ludylops data. This plan adds the `creator_id` column (backfilled to the default creator) and its index to the operational tables that have simple surrogate primary keys — the mechanical, non-breaking half of the isolation work. It intentionally makes **no query or behavior changes**: after this plan every existing row belongs to `creator_ludylops` and the app behaves exactly as before. It is the safe foundation that the per-entity scoping plans (009+) build on.

Tables with natural/global keys that need constraint surgery (`viewer_balances`, `quotes.quote_number` unique, `catalog_items.slug` unique, `quote_overlay_state`, `obs_overlay_control`, `streamerbot_counters`) are **deliberately excluded here** and handled in plan 009 and later — see Scope.

## Current state

- `src/lib/creators/defaults.ts:5` — the default creator id constant:
  ```ts
  export const DEFAULT_CREATOR_ID = "creator_ludylops";
  ```
  The actual `creators` **row** for this id may or may not exist in a real database — the app falls back to an in-memory `defaultCreatorTenant` when the row is absent (`src/lib/creators/tenant.ts, resolveCreatorFromRequest`). Because this plan adds a foreign key to `creators`, **the row must exist before backfilling** (Step 1 handles this).

- `src/lib/db/schema.ts` — Drizzle table definitions. The foundation tables already carry `creator_id`; pattern to copy (`schema.ts`, `creator_modules`):
  ```ts
  creatorId: varchar("creator_id", { length: 64 })
    .references(() => creators.id)
    .notNull(),
  // ...in the table's index callback:
  creatorIdIdx: index("creator_modules_creator_id_idx").on(table.creatorId),
  ```

- Migration mechanism: editing `schema.ts` then running `npm run db:generate` (drizzle-kit) emits a new `drizzle/NNNN_*.sql` file plus a snapshot under `drizzle/meta/`. The deployment path remains schema-first `npm run db:push`, preceded by plan 014's explicit data preparation and readiness check. Production application is outside this delivery; disposable-database verification is required. Example of a generated migration: `drizzle/0022_naive_silk_fever.sql` is a single `ALTER TABLE ... ADD COLUMN`.

- The in-scope tables today have **surrogate primary keys** (a `varchar id`) and no `creator_id`. Representative excerpt (`schema.ts`, bets and betOptions):
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
| Typecheck          | `npm run typecheck`     | exit 0, no errors                |
| Tests              | `npm test`             | all pass (current suite plus relevant new tests)          |
| Build              | `npm run build`        | exit 0 (needs `NEXTAUTH_SECRET` env set for the prod build; use any non-empty dummy value locally) |

Note: this is Next.js 16 / Drizzle. Do not run `npm run db:push` against a shared/production database; use only the disposable verification database under plan 014's runbook. On Windows do not round-trip source files through PowerShell `Get-Content`/`Set-Content`.

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
- the existing plan 014 readiness/ensure tools as prerequisites, without changing their implementation

**Out of scope** (do NOT touch — these are handled by plan 009 and later because they need primary-key / unique-constraint changes or are the pilot vertical):

- `quotes`, `quote_overlay_state`, `quote_overlay_queue`, `obs_overlay_control` — quotes vertical + composite-key surgery, plan 009.
- `viewer_balances` — needs composite PK `(viewer_id, creator_id)`; a later economy-isolation plan (not yet numbered).
- `catalog_items` — `slug` unique must become composite; later plan.
- `streamerbot_counters` — keyed by `key`, and dual-used to store creator-area-access settings (`src/lib/creators/access.ts:9`); needs careful handling; later plan.
- **Identity tables stay global** (a viewer is one Google identity across creators): `users`, `google_accounts`, `google_account_viewers`, `viewer_links`.
- **Shared reference / infra stay global**: `ps_plus_catalog_items`, `ps_plus_catalog_sync_state`, `google_risc_deliveries`.
- **Any `.ts` file other than `schema.ts`** — no repository query changes, no service changes. This plan is schema-only. If you find yourself editing `repository.ts`, STOP.

## Git workflow

- Update local `master` from origin first, then branch: `codex/008-creator-id-schema-groundwork`.
- Short imperative commit messages matching `git log` (e.g. `add creator_id to operational tables`).
- Do not push or open a PR unless instructed. Never run db:push against a shared/production database; the disposable-database verification in Step 3 uses plan 014's runbook.

## Steps

### Step 1: Use plan 014's readiness gate

Plan 014 / #180 must have delivered its schema-first push runbook, read-only
readiness command and separately invoked idempotent ensure command. Read
docs/database-migrations.md, then run `npm run db:baseline:check`. If records are
missing in the disposable database, run `npm run db:baseline:ensure -- --apply`,
then `npm run db:baseline:check` again. Require exit 0; creatorExists alone is not
the complete gate. Do not treat db:generate as a seed runner.

Run the readiness command against a disposable test database with the current
foundation schema. If required rows are missing, use the ensure command only
on that disposable database, then rerun readiness. Preserve customized creator,
branding, domain and module values. Never replay drizzle/0021_hard_riptide.sql
or add INSERT/UPDATE statements to generated SQL expecting db:push to run them.

For deployment, record the separate sequence: inventory/backup/review, approved
ensure if needed, successful readiness check, approved schema push, verification.
Unknown production state is a deployment prerequisite, not a reason to skip
offline implementation or disposable-database tests.

**Verify**: the readiness command exits 0 and confirms creator_ludylops exists.
Missing/conflicting foundation state exits non-zero before dependent DDL.

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

**Verify**: `npm run typecheck` → exit 0. `rg -c "creator_id_idx" src/lib/db/schema.ts` → increased by exactly 16.

### Step 3: Generate and verify the additive schema artifact

Run npm run db:generate. Inspect the new SQL and snapshot: exactly the 16
in-scope operational tables gain creator_id and an index. Columns reference
creators.id and use the temporary default creator_ludylops. Generated SQL
contains schema changes only; do not insert a data seed or edit historical SQL.

On the disposable database prepared in Step 1, review and apply the schema diff
using the path established by plan 014. Verify existing records receive the
default creator and preserve their original values. Inspect foreign keys and
indexes. No shared or production database is changed by this delivery.

**Verify**: schema generation contains 16 new creator_id columns and matching
indexes, no unexpected drops; disposable database checks confirm backfill and
referential integrity. Record exact commands and results in the report.

### Step 4: Confirm no behavior change

Run the full suite — nothing in application code changed, so all existing tests must still pass unchanged. Demo mode does not read the new column, so demo tests are unaffected.

**Verify**: `npm test` → all pass; `npm run lint` → exit 0; `npm run build` → exit 0.

### Step 5: Document deployment readiness separately

Report the generated schema artifact, disposable-database results and the
required production readiness command from plan 014. State explicitly that the
production/shared database has not been changed. A generated artifact or passing
test does not prove that production has the required creator row.

**Verify**: report includes the exact ensure/check/push order and any unknown
production prerequisite; it never claims db:push executes SQL seed files.

## Test plan

- Required disposable-database verification: additive schema, existing-row backfill, retained customization, and expected foreign keys/indexes. No production fixture or credential may be used.

- No implementation-mirroring unit tests: this is schema-only and repository query paths are untouched. The regression guarantee is "the existing tests still pass unchanged."
- Verification: `npm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `rg -c "creator_id_idx" src/lib/db/schema.ts` increased by exactly 16 vs. base
- [ ] Generated schema SQL adds exactly 16 creator_id columns and their indexes; contains no hand-added data seed
- [ ] `npm test` exits 0 and the existing behavior remains unchanged; disposable backfill checks pass
- [ ] `npm run lint` exits 0 and `npm run build` exits 0
- [ ] `git status` shows only `schema.ts`, `drizzle/**`, and the plan/index reporting changes modified — no other `.ts` files
- [ ] `plans/README.md` status row updated
- [ ] Report identifies disposable-database checks and explicitly states no shared/production database was mutated

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
- Reviewer focus: confirm the migration is additive-only (no drops), the readiness check precedes the FK columns, and no application code changed.
- When plan 009+ scope reads/writes, they rely on every operational row having a non-null `creator_id` — which this plan guarantees via the default. Keep the default until that guarantee moves into application code.
