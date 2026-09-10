# Plan 019: Enforce module authorization and dependency-safe transitions

> **Executor instructions**: Module state is an authorization boundary, not
> merely navigation metadata. Implement one server-side policy and use it at
> every entry point. Do not rely on hidden links or client checks.
>
> **Drift check (run first)**: `git diff --stat 2565323..HEAD -- src/lib/creators/modules.ts src/lib/creators/instances.ts src/app src/components/platform-owner-creator-list.tsx`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plan 009; coordinate Streamer.bot adoption with plan 018
- **Category**: security / tech-debt
- **Planned at**: commit `2565323`, 2026-07-13
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/185

## Why this matters

The module catalog declares routes, dependencies, and default configuration,
but runtime checks only hide disabled modules from the creator landing page.
Direct public pages, APIs, OBS routes, and Streamer.bot endpoints remain
callable. Status updates also permit impossible states such as bets installed
without points or Streamer.bot.

## Current state

- `modules.ts:getEnabledCreatorModules` checks only the row's own installed
  status; `requiredCapabilities` is unused for authorization.
- `instances.ts:updatePlatformCreatorModuleStatus` blindly upserts the requested
  state after validating only the module key.
- `/c/[creatorSlug]` uses module state for presentation.
- Representative `/api/internal/streamerbot/quotes` executes without creator or
  module authorization.
- Manifest OBS paths contain stale singular names (`/obs/quote`,
  `/obs/subscriber-alert`) while actual routes are plural; add catalog validation
  rather than copying these values into guards blindly.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm test -- creators modules` | all matching tests pass |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Full tests | `npm test` | all pass |
| Build | `$env:NEXTAUTH_SECRET='ci-build-only-dummy-secret'; npm run build` | exit 0 |

## Scope

**In scope**: pure dependency planner, server-side capability guard, creator
module mutation service/routes/UI feedback, catalog route corrections and
validation, all module public/admin/API/OBS/Streamer.bot entry points, and tests.

**Out of scope**: scoping database rows (plans 008/009+), billing/licensing,
runtime plugins, or silently enabling dependencies without operator visibility.

## Git workflow

- Branch `codex/019-module-authorization-dependencies` after plan 009.
- Commit per layer: policy/tests, mutation enforcement, route adoption.

## Steps

### Step 1: Build and test a pure dependency planner

Given the catalog and current module rows, compute effective availability,
missing requirements, transitive dependents, and a proposed transition plan.
Reject catalog cycles and unknown requirements at startup/test time. Correct
stale manifest routes and add a test that catalog routes correspond to actual
route files or an explicit virtual-route allowlist.

**Verify**: unit tests cover quotes, bets, transitive dependencies, cycles,
missing rows, disabled and archived states.

### Step 2: Enforce dependency-safe mutations

On enable, require dependencies to be installed or return an explicit proposed
batch for operator confirmation. On disable/archive, reject the transition while
installed dependents exist or require a confirmed cascading transition. Perform
multi-row changes in one transaction. Return structured errors to the owner UI.

**Verify**: mutation tests prove no partial or impossible configuration commits.

### Step 3: Add a central server capability guard

The guard must accept authenticated/resolved creator context and a module key,
enforce creator lifecycle plus effective module availability, and return a
consistent unavailable result. It must not resolve to the default tenant after
a known creator is denied.

**Verify**: guard tests cover active/inactive creators and every module state.

### Step 4: Apply the guard to every entry-point class

Inventory the catalog and map each public page, admin panel/API, OBS route, and
Streamer.bot handler. Apply the guard before reads or side effects. Start with
the quotes vertical established by plan 009, then continue catalog module by
module. Add a checked-in coverage matrix so future modules cannot omit a class
of entry point.

**Verify**: integration/route tests show direct URLs and APIs fail when disabled,
not only navigation links. Streamer.bot tests prove no side effect occurs.

### Step 5: Derive navigation/admin presentation from effective availability

Use the same policy result for public navigation and owner warnings. Do not
duplicate dependency logic in React components.

**Verify**: UI/helper tests match server authorization for representative states.

### Step 6: Run all gates

**Verify**: lint, typecheck, focused/full tests, and build exit 0.

## Test plan

- Disabled/archived module: link hidden and direct page/API/OBS/integration denied.
- Missing dependency: dependent is ineffective and mutation explains why.
- Disable dependency with active dependents: atomic rejection or confirmed
  atomic cascade.
- Default creator remains functional with all seeded modules installed.
- Catalog route validation catches the existing singular/plural drift.

## Done criteria

- [ ] Module state is enforced server-side at every cataloged entry-point class.
- [ ] Dependency-invalid states cannot be newly persisted.
- [ ] Existing invalid states fail closed and are visible to operators.
- [ ] Catalog routes are validated against actual routes.
- [ ] Navigation and authorization share one policy.
- [ ] Lint, typecheck, tests, and build pass.

## STOP conditions

- Plan 009 has not established creator context on the quote pilot.
- A guard would authorize from an unsigned tenant hint.
- Route inventory cannot determine which module owns an endpoint.
- Required cascade semantics need a product decision not encoded here.

## Maintenance notes

Every new module manifest must declare dependencies and all entry points, add
guard coverage, and include a disabled-direct-access regression test.
