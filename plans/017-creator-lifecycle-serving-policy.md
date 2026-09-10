# Plan 017: Make creator lifecycle status authoritative at public boundaries

> **Executor instructions**: Administrative loaders must continue to see
> disabled and archived creators. Apply status policy only at public/operational
> serving boundaries, with explicit behavior for each status.
>
> **Drift check (run first)**: `git diff --stat 2565323..HEAD -- src/lib/creators/tenant.ts src/lib/creators/service.ts src/lib/creators/instances.ts src/app/c src/lib/creators/*.test.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `2565323`, 2026-07-13
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
module-level gating, or automatically disabling integrations as a side effect.

## Git workflow

- Branch `codex/017-creator-lifecycle-serving-policy`.
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
that never falls back to the default creator after finding a non-active tenant.
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
- Unknown hosts retain the intentional default fallback only where explicitly
  allowed; a known inactive host never falls back.
- Admin listing includes all statuses and reactivation works.

## Done criteria

- [ ] Status controls actual public availability.
- [ ] Admin recovery paths retain inactive creators.
- [ ] Known inactive tenants cannot fall through to default data.
- [ ] Tests cover slug, hostname, transition, and admin recovery.
- [ ] Lint, typecheck, and tests pass.

## STOP conditions

- Enforcing status at a shared low-level loader hides creators from admin.
- A known inactive tenant would be replaced by the default tenant.
- Status semantics require data deletion or integration teardown.

## Maintenance notes

Plans 009, 016, 018, and 019 must use the public serving policy for public and
integration traffic, not the unrestricted administrative loader.
