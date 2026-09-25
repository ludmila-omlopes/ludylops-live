# Plan 017: Make creator lifecycle status authoritative at public boundaries

> **Executor instructions**: Administrative loaders must continue to see
> disabled and archived creators. Apply status policy only at public/operational
> serving boundaries, with explicit behavior for each status.
>
> **Drift check (run first)**: `git diff --stat ec19f8f..HEAD -- src/lib/creators/tenant.ts src/lib/creators/service.ts src/lib/creators/instances.ts "src/app/(creator-public)/c" src/lib/creators/*.test.ts`

## Status

- **State**: DONE (2026-09-20): implementation and local validation complete in `.worktrees/issue-183`; integrated via [PR #192](https://github.com/ludmila-omlopes/ludylops-live/pull/192). Public creator resolution serves only active creators, while administrative recovery remains available. Validation: 64 focused tests, 362 full-suite tests, typecheck, lint, and a demo-environment build passed. Lifecycle persistence tests use a simulated database adapter; manual validation in a disposable database remains pending. No shared database was queried or changed.

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ec19f8f`, reconciled 2026-09-15 (same file tree as remote master `f353ce2`).
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/183

## Why this matters

The platform-owner console persists `active`, `disabled`, and `archived`, but
slug and hostname resolution return creators regardless of status. A disabled
or archived creator therefore remains publicly accessible. As tenant context is
threaded into more APIs, this gap would also keep operational routes active.

## Current state

- `instances.ts:updatePlatformCreatorStatus` changes only the database field.
- `tenant.ts:findCreatorBySlug` and `findCreatorByHostname` do not filter status.
- `service.ts:getCreatorAreaBySlug` accepts any resolved matching slug.
- `/c/[creatorSlug]` returns 404 only when no tenant is returned.
- `listPlatformCreatorInstances` must retain all statuses for recovery/admin.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm test -- src/lib/creators` | all pass |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Full tests | `npm test` | all pass |

## Scope

**In scope**: creator resolution/service APIs, creator public page behavior,
lifecycle tests, and a concise documented status policy.

**Out of scope**: deleting creator data, changing platform-owner permissions,
module-level gating, a new draft/publish workflow, or integration teardown. Request-time lifecycle checks will be adopted by plans 009/018/019.

## Git workflow

- Update the remote base first, then branch `codex/017-creator-lifecycle-serving-policy`.
- Commit message: `enforce creator lifecycle serving policy`.

## Steps

### Step 1: Define lifecycle semantics

Document: `active` serves normally; `disabled` is temporarily unavailable but
administratively recoverable; `archived` is not publicly resolvable and remains
visible only to platform owners. Choose whether disabled returns 404 or a
generic unavailable response without leaking private state.

**Verify**: tests encode the chosen response for all statuses.

### Step 2: Separate administrative and public resolution

Keep raw/admin loaders status-agnostic. Add an explicit public resolver or mode
that never falls back to the default creator after an explicit unknown/inactive creator request. Permit default routing only on an explicit allowlist of legacy/default hosts and paths.
Update `getCreatorAreaBySlug` and future public hostname callers to use it.

**Verify**: unit tests prove inactive slug and hostname requests cannot resolve
to either the inactive creator or Ludylops fallback.

### Step 3: Cover transition and recovery behavior

Test active→disabled→active and active→archived. Confirm the platform-owner list
and mutation endpoints can still find and reactivate the creator.

**Verify**: focused lifecycle tests pass.

### Step 4: Run gates

**Verify**: lint, typecheck, focused tests, and full tests exit 0.

## Test plan

- Active creator resolves by slug and hostname.
- Disabled and archived creators do not resolve publicly.
- Unknown hosts or explicit unknown slugs fail closed; only explicitly allowed
  default/legacy host paths can resolve the default creator.
- Admin listing includes all statuses and reactivation works.

## Done criteria

- [x] Status controls actual public availability at `/c/[creatorSlug]` and the new reusable public resolver.
- [x] Admin recovery paths retain inactive creators.
- [x] Unknown/invalid explicit contexts and inactive tenants cannot fall through to default data.
- [x] Tests cover slug, hostname, transition, and admin recovery.
- [x] Lint, typecheck, focused/full tests, and demo-environment build pass.

## STOP conditions

- Enforcing status at a shared low-level loader hides creators from admin.
- A known inactive tenant would be replaced by the default tenant.
- Status semantics require data deletion or integration teardown.

## Maintenance notes

Plans 009, 016, 018, and 019 must use the public serving policy for public and
integration traffic, not the unrestricted administrative loader.
