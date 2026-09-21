# Plan 009: Thread creator context and isolate the quotes pilot

> **Executor instructions**: Establish an explicit, reusable creator context.
> This is a technical isolation pilot, not authorization to open the product beta.
> Preserve the existing Ludylops operation. Authentication, creator ownership,
> module availability and data isolation are separate checks.
>
> **Drift check**: `git diff --stat ec19f8f..HEAD -- src/lib/db src/lib/creators src/lib/streamerbot src/lib/obs-overlay-settings.ts src/lib/types.ts src/app src/components/obs-quote-overlay.tsx src/components/quote-overlay-trigger.tsx`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH: schema constraints, paid quote requests, queue refunds and OBS.
- **Depends on**: plan 008 / #172, plan 017 / #183 and plan 018 / #184. Plan 014 / #180 is inherited through 008/018.
- **Release dependencies**: plan 019 / #185 for module authorization; creator-owner administration and the economy/live-state follow-ups described below are not yet numbered. Do not mislabel these as plans 010–013, which are performance plans.
- **Category**: tech-debt / migration
- **Planned at**: commit `ec19f8f`, reconciled 2026-09-15; same file tree as remote master `f353ce2`.
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/173
- **State**: IMPLEMENTED in the issue worktree; awaiting PR integration and a separate reviewed database rollout. No shared/production database changes.

## Why this matters

The operational repository has no creator context. Quotes, quote numbers,
overlay state and queues are global. This pilot must prove that A's reads,
writes and overlay operations cannot access B's records, while documenting a
pattern for later per-module plans.

Quotes are not independent of the economy: the public page reads dashboard and
pricing, showing a quote charges points, and cancelling/expiring queued quotes
can refund points. A quote-table filter alone cannot make that path safe.
Never return another community's balance, pricing or live state to complete a
demo of the pilot.

## State before implementation

- `src/lib/db/repository.ts`, listQuotes at line 2610:
  `db.select().from(quotes).orderBy(desc(quotes.quoteNumber))` has no creator filter.
- Quote helpers include createQuoteRecord, getQuoteRecord, getActiveQuoteOverlay,
  enqueueQuoteOverlay, activateQuoteOverlay, processNextQueuedQuoteOverlay,
  refundQueuedQuoteOverlay, expireQueuedQuoteOverlays, setObsOverlayPaused,
  cancelQueuedQuoteOverlays, runQuoteCommandFromChat and showQuoteOverlayForViewer.
  Inventory their callers and side effects before changing signatures.
- `src/lib/db/schema.ts`: quotes.quoteNumber is globally unique;
  quote_overlay_state.slot and obs_overlay_control.key are global primary keys;
  quote_overlay_queue has a surrogate id. Plan 008 intentionally excludes them.
- `src/lib/creators/tenant.ts`: resolveCreatorFromRequest currently accepts
  routing hints and can fall back to the default creator. Reuse the stricter
  public policy delivered by plan 017, not its old permissive behavior.
- `src/app/(community)/quotes/page.tsx` calls listQuotes, getViewerDashboard and
  getPipetzPricing. Its viewer-triggered overlay operation is paid.
- `src/app/obs/quotes/page.tsx` resolves style and renders ObsQuoteOverlay;
  the component fetches /api/obs/live-status and /api/obs/quotes/current.
  Both the requests and any style/live-state dependency need the right context.
- `src/app/api/obs/quotes/current/route.ts` processes the queue on GET.
  Preserve no-store; do not cache or deduplicate this operation.
- `src/app/api/internal/streamerbot/quotes/route.ts` currently verifies a global
  secret. After plan 018, use the authenticated creator returned by its verifier.
  Never authorize the integration from x-creator-slug or a hostname.
- `src/app/(creator-public)/c/[creatorSlug]/page.tsx` is the reservation page,
  not a complete module UI. Route groups changed file locations, not URLs.
- Existing /admin permissions are global. Selecting a creator in a URL is not
  proof that the logged-in viewer owns it.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Inventory | `rg -n 'Quote|quote|ObsOverlay' src/lib/db/repository.ts src/app src/components` | all relevant callers found |
| Generate schema | `npm run db:generate` | only planned schema changes |
| Focused tests | `npm test -- quotes` | meaningful matching tests pass |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 in isolated checkout |
| Full suite | `npm test` | current suite and new tests pass |
| Build | `npm run build` | exit 0 with test/demo environment and a dummy NEXTAUTH_SECRET |

Install from the lockfile in the isolated worktree if needed. Read installed
Next.js headers, routing and server-component docs before writing application
code. Use plan 014's documented ensure/readiness/schema-first sequence on a
disposable database; never apply to a shared or production database in this delivery.

Exact prerequisite gate: `npm run db:baseline:check` must exit 0 on that disposable
database. If foundation rows are missing, run `npm run db:baseline:ensure -- --apply`
there and repeat the check. If schema is missing, use the pre-008 foundation
bootstrap in docs/database-migrations.md before preparing data. Never replay
0021 or assume db:push executes generated SQL seeds. Production adoption remains
a separate reviewed/approved operation; this does not weaken the 008/017/018 dependencies.

## Scope

**In scope**:

- Quote-related operations in src/lib/db/repository.ts and their existing demo
  store implementation; locate it from getDemoStore imports, rather than assuming
  src/lib/creators/demo-store.ts contains operational quotes.
- The four quote/overlay tables in src/lib/db/schema.ts, generated drizzle
  schema artifacts and directly required record types in src/lib/types.ts.
- Quote public, viewer/API, integration and OBS callers found by the inventory;
  src/components/obs-quote-overlay.tsx and quote-overlay-trigger.tsx.
- Quote-related administrative handlers and shared overlay-control callers only
  as needed to adapt the composite key and preserve default-creator behavior.
- Creator-context plumbing using plans 017/018; focused unit, route and
  disposable-database tests; docs/creator-scoping.md.
- plans/README.md reporting unless the reviewer maintains it.

**Out of scope**:

- Migrating the entire economy, bets, suggestions, catalog, counters or bridge.
- A general streamer management console, theme editor, publication workflow,
  wildcard root routing (plan 016), cache (plan 011), or broad repository rewrite.
- Trusting a caller-selected creator as admin authorization.
- Making paid quote operations free or changing dependencies merely to pass tests.

## Implementation steps

### 1. Inventory and write the dependency boundary

Document every quote read/write and its dependencies: identity, paid debit,
refund, pricing, queue, live status, style, pause/control and admin permissions.
Use one required creatorId parameter (or a small required context object) for
scoped services; no optional default for migrated functions.

Separate request context by authority: public resolution uses plan 017; integration
context uses verified credentials from plan 018; administrative mutations require
session ownership/role verification. Raw headers are routing input only.

Known missing dependencies must be explicit:
- Independent balances/ledger and quote pricing are required before another
  creator can use paid display/refund paths.
- A creator-specific live-state source is required before another creator can
  use live-gated display.
- A creator-owner management permission path is required before external owners
  can operate the pilot themselves.

Technical create/read isolation may proceed, but non-default operations touching
unscoped dependencies must fail closed before reads or side effects. List these
as unavailable capabilities; do not claim complete external readiness. If the
requested delivery requires paid display now, stop and scope the missing
economy/live-state work before implementing that path.

**Verify**: docs/creator-scoping.md contains the caller matrix, context signature,
known release dependencies and explicit behavior for unavailable operations.

### 2. Change quote constraints

Add creator_id with the temporary default creator_ludylops and foreign key.
Use unique (creator_id, quote_number), primary key (creator_id, slot) for
quote_overlay_state, primary key (creator_id, key) for obs_overlay_control,
and a creator index for quote_overlay_queue. Inspect shared control callers:
preserve their default-creator behavior without enabling other unscoped modules.

Generate schema artifacts only; no hand-inserted seed SQL. On a disposable
database prepared by plan 014, verify backfill and composite keys.

**Verify**: existing rows retain values and reference the default creator;
A and B may independently own quote number 1 and their own state/control keys.

### 3. Scope repository operations and demo behavior

Require context on every quote helper. Filter reads, updates, deletes, queue
claims and refunds by creator; stamp inserts with that creator. Check linked
quote/queue ownership as well as individual ids. Scope number allocation and
handle concurrent creation without producing duplicate numbers in one creator.

Prevent fallback to a global demo store on a real-database schema/query failure
for non-default creators. Preserve demo mode as an explicitly separate mode,
with separate A/B state that exercises the same context contract.

**Verify**: typecheck catches missing arguments; tests prove A cannot read,
claim, cancel, alter or refund B's data, including colliding local quote numbers.

### 4. Thread context through actual callers

Update the inventoried public/viewer/OBS/integration/admin paths. Preserve the
chosen creator through client fetches, refresh and navigation; a creator landing
page alone does not establish context for later /api requests. A path-based
pilot may work without plan 016, but it must carry explicit validated context
to every request and use server-side authorization where required.

Use plan 018's rollout gate to permit only verified scoped quote actions.
Keep non-default paid/display/live-state operations unavailable until their
documented dependencies are isolated. Do not silently call global dashboard,
pricing, balance, style or live-status loaders for those creators.

**Verify**: route tests use two creators, including invalid/inactive context,
forged creator hints and a user who owns A attempting an admin action on B.
Unimplemented owner management is recorded as a release dependency, never
worked around by adding the streamer to the global admin allowlist.

### 5. Verify database isolation as well as demo isolation

Use existing Vitest conventions in src/lib/db/repository.test.ts and the route
tests under src/app/api. Add focused quote isolation tests and exercise the
actual database path against a disposable database. No production fixtures.

Cover A/B quote-number collisions, wrong-creator ids, separate queue/control
state, concurrent queue claims and existing Ludylops regressions. Demonstrate
non-default paid/refund paths cannot invoke the global economy. Once the
economy follow-up exists, require equivalent successful debit/refund isolation
tests before releasing those paths.

**Verify**: focused/full tests, typecheck, lint and test-environment build pass;
record database setup and results. Demo-only green tests are insufficient to
declare database isolation complete.

### 6. Publish the pattern and remaining work

docs/creator-scoping.md must contain the signature, request-authority rules,
schema/constraint recipe, demo/database parity, authorization checklist,
per-creator cache-key requirement and remaining unscoped capabilities.

Remaining work is unnumbered: economy/pricing, bets, suggestions/products,
catalog/resgates/bridge credentials and queues, counters/live-state/settings,
owner management and complete creator navigation/configuration. Existing
plans 010–013 are performance work, not this missing migration program.

**Verify**: another executor can identify each missing release dependency without
reading this conversation. Report technical completion separately from product
readiness; no shared/production database changes.

## Done criteria

- [x] Required context reaches all migrated quote repository and route callers.
- [x] Schema backfill/composite constraints pass disposable-database checks.
- [x] A/B isolation is proven on actual database reads/writes and queue/control.
- [x] Non-default unscoped economy/configuration/live-state paths fail closed.
- [x] Authenticated integration context comes from plan 018, not unsigned hints.
- [x] No user gains global admin permission to operate another community.
- [x] docs/creator-scoping.md names all remaining release dependencies.
- [x] Typecheck, lint, focused/full tests and build pass.
- [x] Report separates implemented capabilities from unavailable paid/display
      paths, and confirms no production/shared DB mutation.

## STOP conditions

- Plans 008, 017 or 018 have not delivered their required contracts.
- A scoped request could fall back to Ludylops after invalid or missing context.
- A path needs the global economy, shared live state or global admin rights to
  appear functional for another creator.
- Quote key changes require migrating an unrelated module beyond its narrow
  default-creator compatibility adapter.
- Generated DDL has unexplained changes or disposable-database isolation fails.

## Git workflow and maintenance

Update the remote base before creating codex/009-creator-scoping-quotes-pilot in
an isolated worktree. Commit schema, scoped services, callers and tests in
reviewable units. Do not copy the whole repository per creator. Any issue PR
must include Closes #173 in its body. Production application is a separate
deployment step following plan 014; plan 019 is required before external module
availability can be advertised.

## Delivery evidence — 2026-09-21

- Required creator context throughout quote services, four scoped tables, per-creator numbering/locks and composite keys.
- Public `/c/[creatorSlug]/quotes` and authenticated Streamer.bot create/get are isolated. Paid display, live/style, refunds and admin controls remain default-only.
- 607 tests / 61 files, lint, TypeScript build and demo production build passed. HTTP smoke: existing/new default quote URLs return 200; invalid creator pages and polling return 404. Authentication and the real OBS/Streamer.bot installation were not exercised by that anonymous smoke.
- PostgreSQL 17.11 disposable baseline ready; legacy values preserved across 0025; A/B numbering and reads, concurrent creation/claim/cancellation, single debit/refund, cross-creator state preservation, constraints and schema-error fail-closed checks passed.
- Generated 0025 required a reviewed correction to primary-key DDL ordering and missing DROP statements. `db:push` does not use this corrected SQL; production DDL must be reviewed separately, with old writers stopped before the key switch.
- See [the caller matrix, reproduction recipe and release dependencies](../docs/creator-scoping.md).
