# Plan 009: Thread creator context through the data layer and scope the quotes vertical (pilot)

> **Executor instructions**: This is a **design-and-pilot plan** — its purpose is
> to establish a reusable pattern, not just ship one feature. Follow it step by
> step, run every verification command, and honor the STOP conditions. The most
> important deliverable is the pattern document in Step 6: later plans replicate
> it per entity, so if the pattern is unclear, STOP and report rather than
> shipping something inconsistent. Update this plan's row in `plans/README.md`
> when done unless a reviewer told you they maintain the index.
>
> **This plan is best run by a strong executor (or with close review).** It makes
> genuine design decisions. If you are a lightweight executor and any step
> requires judgment the plan doesn't spell out, STOP and report.
>
> **Drift check (run first)**:
> `git diff --stat 0b73c37..HEAD -- src/lib/db/schema.ts src/lib/db/repository.ts src/lib/creators/tenant.ts`
> If these drifted materially, re-read the "Current state" excerpts before proceeding.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (touches the core data-access layer and a live overlay/chat path; establishes a pattern many later plans copy)
- **Depends on**: plans 008 and 018. Plan 008 establishes the backfilled `creator_id` pattern. Plan 018 ensures Streamer.bot requests derive creator identity from verified per-creator credentials before this pilot threads creator context through the quotes integration. This plan still owns the quote tables' constraint surgery.
- **Category**: tech-debt / migration
- **Planned at**: commit `0b73c37`, 2026-07-07
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/173

## Why this matters

Plan 008 gives operational tables a `creator_id` column, but at runtime the app is still single-tenant: **no repository function knows which creator a request belongs to** (`grep -c "resolveCreatorFromRequest\|creatorId" src/lib/db/repository.ts` → 0). Isolation only becomes real when queries filter by creator. Doing that across all 85 repository functions blindly is how you introduce a cross-tenant data leak. This plan de-risks the whole program by proving the end-to-end pattern on **one small vertical — quotes** — including the two hard parts every entity will hit: (1) how the resolved creator flows from an HTTP request down into a repository call (and its demo-store twin), and (2) how a global sequence/unique (`quote_number`) and a single-row key (`quote_overlay_state.slot`, `obs_overlay_control.key="quotes"`) become per-creator. The output is a working quotes vertical **plus** a written pattern (`docs/creator-scoping.md`) that plans 010+ follow mechanically.

## Current state

- Creator resolution already exists: `src/lib/creators/tenant.ts:251` `resolveCreatorFromRequest(input?: Request | ResolveCreatorOptions | null)` returns a `CreatorTenantRecord` (`.creator.id` is the creator id). It resolves from subdomain, `x-creator-slug` header, `/c/:slug` pathname, or hostname, and falls back to `DEFAULT_CREATOR` when nothing matches or the DB lacks the schema. **Reuse this — do not build a second resolver.**

- No repository function accepts a creator. The demo/DB dual-path pattern (present in ~190 branches) for quotes, `src/lib/db/repository.ts:2545`:
  ```ts
  export async function listQuotes() {
    const db = getDb();
    if (isDemoMode || !db) {
      return [...listDemoQuotes()].sort((a, b) => b.quoteNumber - a.quoteNumber);
    }
    const rows = await db.select().from(quotes).orderBy(desc(quotes.quoteNumber));
    return rows.map(serializeQuote);
  }
  ```
  and the write path uses a **global** next-number sequence (`repository.ts:2586-2612`): it reads `max(quote_number)` across the whole table. Per-creator, that max must be scoped to the creator.

- Quotes schema (all in `src/lib/db/schema.ts`), with the global constraints that must become per-creator:
  - `quotes` (`:564`): `quoteNumber` has `uniqueIndex("quotes_quote_number_idx")` — must become **composite unique `(creator_id, quote_number)`**.
  - `quote_overlay_state` (`:593`): primary key is `slot` (one global slot) — must become per-creator (composite PK `(creator_id, slot)` or add `creator_id` to the key).
  - `quote_overlay_queue` (`:621`): surrogate `id` PK — just needs a `creator_id` column + index.
  - `obs_overlay_control` (`:611`): primary key is `key` (e.g. `"quotes"`) — must become composite `(creator_id, key)`.

- Quote call graph (the callers that must resolve a creator and pass it down):
  - `src/app/api/internal/streamerbot/quotes/route.ts:3` — imports `runQuoteCommandFromChat` (chat `!quote`/overlay command). Streamer.bot requests carry the creator via subdomain/header — resolve with `resolveCreatorFromRequest(request)`.
  - `src/app/(public)/quotes/page.tsx` — the public quotes list (server component).
  - `src/app/obs/quotes/page.tsx` — the OBS overlay browser source (server component).
  - Confirm the full set yourself: `grep -rln "from \"@/lib/db/repository\"" src/app | xargs grep -l -i quote`.

- Server components read the request via Next 16's `headers()`/`draftMode` APIs — **before writing any of this, read the Next.js guide** in `node_modules/next/dist/docs/` for how to access request headers in a server component in this version (per `AGENTS.md`, this Next may differ from training data). `resolveCreatorFromRequest` accepts a `{ hostname }` / `{ slug }` options object, so a server component can pass the host header without a full `Request`.

- Repository test patterns to model new tests on: `src/lib/db/repository.test.ts`, `src/lib/db/repository-redeem.test.ts` (demo-mode-based unit tests).

## Commands you will need

| Purpose            | Command                | Expected on success              |
|--------------------|------------------------|----------------------------------|
| Install            | `npm install`          | exit 0                           |
| Generate migration | `npm run db:generate`  | new `drizzle/NNNN_*.sql` created |
| Lint               | `npm run lint`         | exit 0                           |
| Typecheck          | `npx tsc --noEmit`     | exit 0, no errors                |
| Tests              | `npm test`             | all pass + new quote-scoping tests |
| Build              | `npm run build`        | exit 0 (`NEXTAUTH_SECRET` dummy env needed) |

Do NOT run `npm run db:push`.

## Scope

**In scope**:
- `src/lib/db/schema.ts` — quotes-vertical tables' `creator_id` + composite constraints (see Current state).
- `drizzle/NNNN_*.sql` + `drizzle/meta/*` — generated migration (add per-creator backfill default like plan 008; the composite-unique/PK changes will appear as index drops+creates — verify they're safe on backfilled data).
- `src/lib/db/repository.ts` — every quote-related function: add a required `creatorId: string` parameter (or an options field), scope both the DB path (`.where(eq(quotes.creatorId, creatorId))`, per-creator max for the sequence) and the demo path (filter the demo store by creator; see demo-store note below).
- `src/lib/creators/demo-store.ts` — if demo quotes need a creator dimension to test scoping, extend the demo store minimally (or key demo quotes by creator). Keep it small.
- The quote callers listed above — resolve the creator via `resolveCreatorFromRequest` and pass `creator.id` down.
- `src/lib/db/repository-quotes.test.ts` (create) — new tests proving per-creator isolation in demo mode.
- `docs/creator-scoping.md` (create) — the pattern document (Step 6).

**Out of scope** (do NOT touch):
- Any non-quote repository function — bets, suggestions, redemptions, ledger, balances, catalog, counters. Those are plans 010+.
- The 16 tables plan 008 already handled — leave their columns as-is.
- `viewer_balances` composite PK — a later plan.
- Auth/session code, the landing page, admin UI unrelated to quotes.
- `streamerbot_counters` general handling — but note `obs_overlay_control` (key-based, in scope here) is a **different** table; do not confuse them.

## Git workflow

- Depends on 008 being merged. Update local `master`, branch `codex/009-creator-scoping-quotes-pilot`.
- Commit per logical unit (schema, migration, repository, callers, tests, docs). Do NOT push/PR or `db:push` unless instructed.

## Steps

### Step 1: Decide and document the threading signature (design gate)

Before code, write down (in the eventual `docs/creator-scoping.md`, or a scratch note you'll fold in at Step 6) the **one** signature convention every scoped repository function will use. Recommended: a required first parameter `creatorId: string` (not optional — optional invites callers to forget it and silently hit the default tenant). Callers obtain it via `const { creator } = await resolveCreatorFromRequest(...)` then pass `creator.id`.

**STOP** and report if you believe an ambient/async-context approach (e.g. `AsyncLocalStorage`) is required instead — that is a larger architectural decision the reviewer must approve before you build it.

**Verify**: n/a (design step; the decision is validated by the rest of the plan compiling).

### Step 2: Quotes schema — add `creator_id` and make constraints per-creator

In `src/lib/db/schema.ts`, for `quotes`, `quote_overlay_state`, `quote_overlay_queue`, `obs_overlay_control`:
- Add `creatorId` as in plan 008 (`.references(() => creators.id).notNull().default(DEFAULT_CREATOR_ID)`).
- `quotes`: change `uniqueIndex("quotes_quote_number_idx").on(table.quoteNumber)` → `uniqueIndex("quotes_creator_quote_number_idx").on(table.creatorId, table.quoteNumber)`.
- `quote_overlay_state`: make the key per-creator — composite primary key `(creatorId, slot)` (use drizzle's `primaryKey({ columns: [...] })` in the table callback; keep `slot` as-is otherwise).
- `obs_overlay_control`: composite primary key `(creatorId, key)`.
- `quote_overlay_queue`: add `creatorId` + `index("quote_overlay_queue_creator_id_idx")`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Generate and sanity-check the migration

`npm run db:generate`. Inspect the new SQL: it should add columns (with the backfill default), **drop** the old single-column unique/PK and **create** the composite ones. Confirm the composite unique on `(creator_id, quote_number)` cannot fail on backfilled data (all existing rows share `creator_ludylops`, and `quote_number` was already globally unique, so `(creator, number)` stays unique — safe). If the generated SQL would violate a constraint on existing data, STOP.

**Verify**: `git status --porcelain drizzle/` shows new files; the SQL contains the composite index/PK changes.

### Step 4: Scope every quote repository function

For each quote-related function in `repository.ts` (find them all: `grep -in "quote" src/lib/db/repository.ts | grep -i "function\|db.select\|db.insert\|db.update"`):
- Add the `creatorId: string` parameter per Step 1's convention.
- DB path: filter reads/updates by `eq(<table>.creatorId, creatorId)`; set `creatorId` on inserts; scope the next-`quote_number` `max()` to the creator; scope overlay-state/control lookups by creator + slot/key.
- Demo path: filter the demo store by creator so the two paths behave identically under test.
- Update the callers (streamerbot quotes route, `/quotes` page, `/obs/quotes` page, any admin quotes panel) to resolve the creator and pass `creator.id`.

Work in small commits; run `npx tsc --noEmit` frequently to catch every caller the type change surfaces (making the parameter required means the compiler lists every call site — use that).

**Verify**: `npx tsc --noEmit` → exit 0 (no un-updated caller remains); `npm run lint` → exit 0.

### Step 5: Tests — prove per-creator isolation

Create `src/lib/db/repository-quotes.test.ts` (model on `repository.test.ts`, demo mode). Assert:
- A quote created under creator A is not returned by `listQuotes(creatorB)`.
- `quote_number` sequences restart/track per creator (creator A's first quote and creator B's first quote can both be number 1).
- The overlay state/queue for creator A is invisible to creator B.

**Verify**: `npm test` → all pass, including the new file; the isolation assertions fail if you remove the `creatorId` filter (sanity: temporarily break one filter, see a red test, restore).

### Step 6: Write the pattern document

Create `docs/creator-scoping.md` capturing, concisely, what the next engineer needs to replicate this per entity:
- the threading signature convention (Step 1) and how callers resolve the creator (`resolveCreatorFromRequest` → `creator.id`);
- the schema recipe (add `creator_id` default-backfilled; when a table has a natural unique/PK, make it composite with `creator_id`; per-creator sequences via scoped `max()`);
- the demo-path mirroring requirement and how to test isolation;
- a checklist a later plan can run down for one entity;
- an explicit list of the remaining verticals still single-tenant (bets, suggestions, redemptions, catalog, counters, balances/ledger) so the roadmap is visible from the code side.

**Verify**: the file exists and a teammate could scope `bets` from it without re-reading this plan.

### Step 7: Full gate + document non-application

Run `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`. As in plan 008, the migration is generated but **not** applied; state this in your report.

**Verify**: all exit 0.

## Test plan

- New `src/lib/db/repository-quotes.test.ts` proving isolation (Step 5), modeled on `repository.test.ts`.
- Existing tests must still pass; any that call quote functions will now need a `creatorId` argument — update them to pass the default creator id, and note in your report how many test call sites changed.
- Verification: `npm test` → all pass.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0 (proves no caller of a scoped quote function was missed)
- [ ] `npm test` exits 0; `repository-quotes.test.ts` exists and its isolation assertions pass
- [ ] `npm run lint` and `npm run build` exit 0
- [ ] New migration present with quotes `creator_id` + composite `(creator_id, quote_number)` unique + per-creator overlay key; no destructive change to row data
- [ ] `grep -c "creatorId" src/lib/db/repository.ts` increased (quotes functions now scoped)
- [ ] `docs/creator-scoping.md` exists and includes the per-entity checklist and the remaining-verticals list
- [ ] `git status` shows only in-scope files changed
- [ ] Report states `db:push` was NOT run and lists how many test call sites were updated
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- Plan 008 is not DONE in `plans/README.md` (operational tables lack `creator_id`).
- Plan 018 is not DONE in `plans/README.md` (the Streamer.bot quote route still lacks authenticated creator identity).
- Accessing request headers in a server component in this Next.js version isn't clear from the installed docs — report rather than guessing an API.
- The generated migration would violate the new composite unique/PK on existing data.
- Scoping quotes appears to require touching a non-quote repository function or `viewer_balances` — that's a later plan; report the coupling.
- You conclude the required threading mechanism is an ambient async-context store (Step 1 STOP) — get reviewer approval first.

## Maintenance notes

- This pilot sets the precedent for **every** remaining vertical. A reviewer should scrutinize the threading convention and the demo-path mirroring hardest — if they're wrong here, they're wrong six more times in plans 010+.
- The `creator_id` column default (from plan 008's approach) is still a backfill crutch; the eventual "drop the defaults + fail loud on missing creator_id" cleanup applies to quotes too.
- Remaining single-tenant verticals after this plan: `bets`/`bet_options`/`bet_entries`, `game_suggestions`/`video_suggestions`/`creator_suggestions` (+ boosts), `product_recommendations`, `redemptions`, `point_ledger`, `viewer_balances` (composite PK), `catalog_items` (composite slug unique), `streamerbot_counters` (key-based + dual-use with creator-area-access). Each is its own plan following `docs/creator-scoping.md`.
