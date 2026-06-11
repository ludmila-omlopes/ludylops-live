# Plan 006: Hardening batch — timing-safe sync auth, dependency vulns, FK indexes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. The three parts are independent — if one part
> hits a STOP condition, finish the others and report the blocked part.
> When done, update the status row for this plan in `plans/README.md` —
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 06f0792..HEAD -- src/app/api/internal/ps-plus src/app/api/internal/steam src/lib/db/schema.ts package.json package-lock.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M (three small parts)
- **Risk**: MED (part B may bump Next.js a minor version — verified by full build+test)
- **Depends on**: plans/001-ci-verification-baseline.md (gates)
- **Category**: security
- **Planned at**: commit `06f0792`, 2026-06-11
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/141

## Why this matters

Three small, verified issues bundled because each is under an hour:

- **A — Timing-unsafe secret comparison**: the PS Plus and Steam sync endpoints compare bearer tokens with `===`, leaking secret prefixes through response timing. The repo already does this right elsewhere (`crypto.timingSafeEqual` in `src/lib/streamerbot/security.ts:47-54`).
- **B — Known-vulnerable dependencies**: `npm audit --omit=dev` reports 11 vulnerabilities (3 high) at the planned-at commit, including **drizzle-orm < 0.45.2 SQL injection via improperly escaped identifiers** (GHSA-gpj5-g38j-94v9 — drizzle is this app's only DB layer) and a **Next.js Server Components DoS** (GHSA-q4gf-8mx6-v5v3). Fixes are available without major-version changes.
- **C — Missing FK indexes**: hot foreign-key columns (`point_ledger.viewer_id`, `bet_entries.viewer_id`, the three `*_suggestion_boosts` tables, `redemptions`) have no indexes, forcing sequential scans on every Neon HTTP query for dashboards, ranking and the bridge pull loop.

## Current state

### Part A
- `src/app/api/internal/ps-plus/sync/route.ts:5-13` and `src/app/api/internal/steam/sync/route.ts:5-13` — identical helper:

```ts
function isAuthorized(request: Request) {
  const secret = env.PS_PLUS_SYNC_SECRET;   // STEAM_SYNC_SECRET in the steam route
  if (!secret) {
    return false;
  }
  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${secret}`;
}
```

- Timing-safe exemplar in `src/lib/streamerbot/security.ts:46-55`: builds Buffers, checks length equality first, then `crypto.timingSafeEqual`.

### Part B
- `package.json`: `"next": "16.2.1"` and `"eslint-config-next": "16.2.1"` are **exact-pinned**; `"drizzle-orm": "^0.45.1"` (caret — patch bump to 0.45.2 is in range); `"ws": "^8.20.0"`.
- `npm audit --omit=dev` at `06f0792`: high — drizzle-orm (<0.45.2), fast-uri (≤3.1.1), next (range ending 16.3.0-canary.5); moderate — ws (8.0.0-8.20.0 uninitialized memory), qs, hono/@hono/node-server, brace-expansion, ip-address. All say "fix available via `npm audit fix`".
- AGENTS.md warns this Next.js version may differ from training data: before touching Next-related code, read `node_modules/next/dist/docs/`. A version bump here only changes the dependency, not app code — the full gate run is the safety net.

### Part C
- `src/lib/db/schema.ts` — `index` and `uniqueIndex` are already imported from `drizzle-orm/pg-core` (line 9; `index(` used at line 309). Existing indexes are almost all unique business keys. Missing non-unique FK indexes:
  - `pointLedger` (130-147): only `uniqueIndex` on `externalEventId`. No index on `viewerId` (used for every balance-history query, ordered by `createdAt`).
  - `betEntries` (172-195): `uniqueIndex("bet_entries_bet_viewer_idx").on(betId, viewerId)` covers `betId`-prefixed lookups, but **not** `viewerId`-only lookups.
  - `gameSuggestionBoosts` (276-286), `videoSuggestionBoosts` (344-354), `creatorSuggestionBoosts` (373-383): table definitions have **no index callback at all** — no index on `suggestionId` or `viewerId`.
  - `redemptions` (407-425): no index callback — no index on `viewerId` (viewer history) or `(status, queuedAt)` (the bridge pull queue query).
- Migrations: `drizzle/` holds generated SQL (e.g. `0007_game_suggestion_igdb_metadata.sql`); `npm run db:generate` (drizzle-kit) generates from schema changes. `npm run db:push` applies to the configured DB — **not for the executor to run**.

## Commands you will need

| Purpose        | Command                            | Expected on success |
|----------------|------------------------------------|---------------------|
| Audit          | `npm audit --omit=dev`             | after part B: 0 high severity |
| Typecheck      | `npm run typecheck`                | exit 0              |
| Tests          | `npm test`                         | all pass            |
| Lint           | `npm run lint`                     | exit 0              |
| Build          | `npm run build`                    | exit 0              |
| Gen. migration | `npm run db:generate`              | new SQL file in `drizzle/` |

## Scope

**In scope**:
- `src/lib/secure-compare.ts` (create) + `src/lib/secure-compare.test.ts` (create)
- `src/app/api/internal/ps-plus/sync/route.ts`, `src/app/api/internal/steam/sync/route.ts`
- `package.json`, `package-lock.json` (dependency bumps only)
- `src/lib/db/schema.ts` (index definitions only — no column changes)
- `drizzle/` (one generated migration file + drizzle-kit's meta updates)

**Out of scope** (do NOT touch):
- `src/lib/streamerbot/security.ts` — HMAC verification is already timing-safe; leave it.
- Running `npm run db:push` or any command against a real database — migration **generation** only; applying it is the operator's call.
- `npm audit fix --force` — never; it crosses major versions.
- Any application-code change to accommodate a Next minor bump beyond what build/tests demand (if code changes are needed, that's a STOP).

## Git workflow

- Branch: `improve/006-security-hardening-batch` (from up-to-date `master`).
- Commit per part (3 commits), short imperative sentences, e.g. `Use timing-safe comparison for sync bearer tokens`.
- Do NOT push or open a PR unless the operator instructed it. PR body must include `Closes #<issue>` for this plan's issue.

## Steps

### Step A1: Create the timing-safe comparer

Create `src/lib/secure-compare.ts`:

```ts
import crypto from "node:crypto";

/** Constant-time string equality that does not leak length differences. */
export function timingSafeStringEqual(a: string, b: string) {
  const digestA = crypto.createHash("sha256").update(a).digest();
  const digestB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}
```

(Hashing first gives equal-length buffers, so no early-exit length check is needed.) Add `src/lib/secure-compare.test.ts`: equal strings → true; differing strings → false; empty vs non-empty → false.

**Verify**: `npx vitest run src/lib/secure-compare.test.ts` → 3 tests pass.

### Step A2: Use it in both sync routes

In both `isAuthorized` helpers, replace the `===` comparison with:

```ts
const authorization = request.headers.get("authorization");
return authorization !== null && timingSafeStringEqual(authorization, `Bearer ${secret}`);
```

Behavior otherwise unchanged (missing secret still → false).

**Verify**: `npm run typecheck` → exit 0; `grep -rn "=== \`Bearer" src/app/api/internal` → no matches.

### Step B1: Fix the dependency vulnerabilities

1. Run `npm audit fix` (no `--force`).
2. Re-run `npm audit --omit=dev`. If `drizzle-orm` is still flagged, run `npm install drizzle-orm@^0.45.2`. If `next` is still flagged (its exact pin blocks audit fix), bump to the lowest patched version *within major 16*: `npm install next@^16.3.0 eslint-config-next@^16.3.0` (check `npm view next versions` for the lowest stable ≥ the advisory's patched version; GHSA-q4gf-8mx6-v5v3's range ends at 16.3.0-canary.5, so the first stable 16.3.x is the target).
3. Confirm `git diff package.json` shows only version bumps — no added/removed packages.

**Verify**: `npm audit --omit=dev` → 0 high-severity findings; then `npm run lint && npm run typecheck && npm test && npm run build` → all exit 0.

### Step C1: Add the index definitions

In `src/lib/db/schema.ts`, add index callbacks (matching the existing `(table) => ({ ... })` style, e.g. lines 144-146):

- `pointLedger`: add `viewerCreatedIdx: index("point_ledger_viewer_created_idx").on(table.viewerId, table.createdAt)` to the existing callback.
- `betEntries`: add `viewerIdx: index("bet_entries_viewer_id_idx").on(table.viewerId)` to the existing callback.
- `gameSuggestionBoosts`: new callback with `suggestionIdx: index("game_suggestion_boosts_suggestion_id_idx").on(table.suggestionId)` and `viewerIdx: index("game_suggestion_boosts_viewer_id_idx").on(table.viewerId)`.
- `videoSuggestionBoosts`: same two, names prefixed `video_suggestion_boosts_`.
- `creatorSuggestionBoosts`: same two, names prefixed `creator_suggestion_boosts_`.
- `redemptions`: new callback with `viewerIdx: index("redemptions_viewer_id_idx").on(table.viewerId)` and `statusQueuedIdx: index("redemptions_status_queued_at_idx").on(table.status, table.queuedAt)`.

**Verify**: `npm run typecheck` → exit 0.

### Step C2: Generate the migration

Run `npm run db:generate`. Inspect the new file in `drizzle/`: it must contain only `CREATE INDEX` statements (9 of them), no table/column changes.

**Verify**: `Select-String -Path drizzle/<newfile>.sql -Pattern "CREATE INDEX" | Measure-Object` → 9 matches; the file contains no `ALTER TABLE ... ADD COLUMN` / `DROP`.

### Final: Full verification

**Verify**: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` → all exit 0.

## Test plan

- `src/lib/secure-compare.test.ts` (new, step A1).
- Parts B and C are covered by the full gate run — no behavior to unit-test (indexes are transparent; dependency bumps are validated by the existing 196+ tests plus build).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm audit --omit=dev` reports 0 high-severity vulnerabilities
- [ ] `grep -rn '=== `Bearer' src/app/api/internal` returns no matches; `secure-compare.test.ts` passes
- [ ] A new migration file in `drizzle/` contains exactly 9 `CREATE INDEX` statements and nothing destructive
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all exit 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated (note in the row that the migration is generated but NOT applied)

## STOP conditions

Stop and report back (do not improvise) if:

- (B) `npm audit fix` changes anything other than versions in `package.json`/`package-lock.json`, or the Next bump breaks `npm run build` or any test — revert part B's changes (`git checkout -- package.json package-lock.json && npm ci`), finish A and C, and report exactly which gate failed and how.
- (B) No stable Next 16.3.x exists on the registry — report; do not install a canary.
- (C) `npm run db:generate` produces anything beyond the 9 `CREATE INDEX` statements (schema has drifted or drizzle-kit detected unrelated diffs — do not commit a migration with surprises in it).
- (A) The sync routes don't match the excerpt (drift).

## Maintenance notes

- **The index migration is generated, not applied.** The operator must run `npm run db:push` (or apply the SQL) against the Neon database at a convenient time; index creation on these table sizes is fast, but it's a production-DB action and stays a human decision.
- If the Next bump lands, watch the first deploy for regressions in OBS overlay routes (`/obs/*`) — they're the most timing-sensitive pages.
- Future secrets compared in routes should use `timingSafeStringEqual` from `src/lib/secure-compare.ts`; reviewers should flag any new `===` against a secret.
- Deferred: the 8 moderate audit findings that remain only in dev/transitive tooling paths (hono is not an app dependency — it arrives via tooling) can ride along with normal updates.
