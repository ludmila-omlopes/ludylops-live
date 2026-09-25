# Plan 014: Establish a safe Drizzle migration and data-seed baseline

## Status

- Priority: P1; effort: M; risk: HIGH when applied to a shared database.
- Depends on: none.
- Issue: https://github.com/ludmila-omlopes/ludylops-live/issues/180
- Planned at: `ec19f8f`, reconciled 2026-09-15; same file tree as remote master `f353ce2`.
- State: DONE (2026-09-15): implementation and local validation complete in .worktrees/issue-180; integrated via [PR #190](https://github.com/ludmila-omlopes/ludylops-live/pull/190). Commands: db:baseline:check and db:baseline:ensure -- --apply. Validation: 351 tests (32 new), typecheck, lint and test-environment build. SQL/transaction behavior tested with an adapter fake; real database verification remains a deployment prerequisite. No shared database was changed.
- Drift check: `git diff --stat ec19f8f..HEAD -- package.json drizzle.config.ts src/lib/db/schema.ts drizzle README.md`.

## Problem and decision

The documented production path is schema-first db:push. It introspects the target and applies a schema diff; it does not replay checked-in SQL seeds. Migration drizzle/0021_hard_riptide.sql seeds creator_ludylops, required before Plan 008 foreign keys, but its upserts overwrite customization. Do not execute or edit that historical SQL.

Keep schema-first push as the one documented apply path, with explicit versioned, idempotent data preparation and a read-only readiness gate. Do not introduce db:migrate or fabricate migration history. Unknown production history blocks database adoption/application, not development and tests of these tools. Distinguish repository policy, observed database state, and unknown history in the runbook.

Official references: https://orm.drizzle.team/docs/drizzle-kit-push and https://orm.drizzle.team/docs/drizzle-kit-migrate . Inspect installed drizzle-kit help/code before documenting flags: the currently installed version may differ from live documentation. Never run push as an inspection command during this task, including push --explain.

## Scope

- package.json scripts only; no new dependencies or lockfile changes.
- README.md, docs/database-migrations.md (new runbook).
- drizzle.config.ts only if required for consistent environment loading.
- scripts/ new baseline/ensure CLI and directly needed helpers.
- src/lib/db/ new baseline helper and baseline tests only; existing schema/repository/client remain unchanged.
- plans/008-creator-id-schema-groundwork.md, plans/009-creator-scoping-quotes-pilot.md: revise apply prerequisites only; no execution of those plans.
- Reviewer maintains plans/README.md and this plan status.

Out of scope: migrations, schema changes, application/UI/auth/Streamer.bot behavior, modifying historical SQL or migration logs, any write to a shared database.

## Implementation steps

1. Read AGENTS.md and current package scripts, drizzle.config, schema creator tables, creators/defaults.ts, migration 0021, and local script/test conventions. Start from fetched origin/master in .worktrees/issue-180, branch codex/014-drizzle-migration-baseline. Preserve main checkout. Read-only database inventory may use existing local credentials but never print credentials, connection URLs, raw DB errors, user records or unrelated data. Never run a write command with these credentials. If inaccessible, record unknown honestly and keep completing offline implementation.

2. Implement a reusable read-only baseline/readiness check and explicit ensure mode, exposed as npm commands. Defaults must be read-only; writes require explicit --apply. Invalid arguments and missing DATABASE_URL fail without connecting/writing. Importing helpers/CLI for tests must not invoke a connection or CLI main. Use explicit local env loading consistently, preserve shell overrides; do not import application auth/env side effects. Errors must not leak secrets.

3. Ensure the default creator and required domain/branding/modules with parameterized SQL or Drizzle. Use the values in src/lib/creators/defaults.ts and migration 0021 as evidence; record the seed version. Preserve existing slug/name/owner/status, branding, domain primary settings and module statuses/configuration. Insert missing rows only; fail on identity/domain collisions rather than stealing ownership. Preserve custom primary domains (never create a second primary domain). Repeated ensure must be a no-op, including timestamps. Validate before mutation where possible, execute writes atomically, and verify required records; roll back on failures. Do not treat a disabled module or customized display name as missing. Missing tables are a clear failure, not permission to create schema. Existence of the creator id is a necessary gate for Plan 008 but is not a certificate of safe production schema changes.

4. Add tests under src/**/*.test.ts so existing Vitest discovers them. Test empty state creation, repeat no-op, customized records preservation, partially missing records, conflicting identities/domain ownership, missing schema, failure propagation/rollback, read-only no-write behavior, and CLI refusal without apply or without credentials. Test real SQL/adapter boundaries where feasible with fakes; no real shared DB writes. Ensure tests exercise the actual implementation, not a separate seed replica.

5. Document one production sequence: inventory/backup/review, baseline check, explicitly approved ensure if needed, successful check, separately approved schema push, verification. For an empty database, create foundation schema at the pre-008 revision before ensure, then apply dependent schema. Unknown migration history remains an operational STOP until an operator reconciles it; never replay generated DDL blindly. Document local/demo/production as yes/no/unknown based on evidence, plus rollback and exact CLI commands/exit semantics. No claim a migration-log table proves all historical DDL was applied.

6. Amend plans 008/009: invoke this readiness check as prerequisite; remove hand-edited SQL seeds and any assumption db:push executes generated SQL. Generated SQL stays a reviewed schema artifact. Ensure scripts are applied separately only under operator approval. These plans are tracked; read the latest committed/reconciled versions in the worktree and reconcile any explicitly supplied uncommitted planning updates. Do not overwrite newer instructions with historical copies. Plan 009's 008/017/018 dependencies remain intact. Its public quotes path is src/app/(community)/quotes/page.tsx.

7. Run focused new tests, then full npm test, npm run typecheck, npm run lint -- --ignore-pattern '.claude/**' --ignore-pattern '.worktrees/**'. Build in demo/test environment if validating app integration; never use real database for the build. Check CLI failure modes without DB and optionally read-only inventory of the existing configured database. No push/migrate/ensure apply against shared DB. Commit scoped implementation in worktree, do not merge/push/PR in this task.

## Done and review

Implementation is done when the documented path is singular, required seeds are separately verifiable and cannot silently pass while missing, seed customization and rollback are tested, dependent plans are consistent, gates pass, and no shared DB was mutated. Report any unobserved production history as a remaining deployment prerequisite, not as completed validation.

Stop and report before changing scope, overwriting customization, modifying schema/history, or writing to a shared DB. Runbook may record unknown inventory when access is unavailable; complete offline tools and tests. Return STATUS, per-step verification, files, commit hash, and deviations. The reviewer reruns gates and audits SQL, tests and scope.
