# Plan 016: Route creator subdomains to their public Next.js surface

> **Executor instructions**: This repository uses Next.js 16. Read the installed
> proxy and rewrite documentation in `node_modules/next/dist/docs/` before
> editing `proxy.ts`. Preserve Auth.js protection for existing admin, owner, and
> viewer routes.
>
> **Drift check (run first)**: `git diff --stat 2565323..HEAD -- proxy.ts src/lib/creators/identity.ts src/lib/creators/tenant.ts src/app/c README.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plan 017
- **Category**: bug / tech-debt
- **Planned at**: commit `2565323`, 2026-07-13
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/182

## Why this matters

Onboarding stores `<slug>.ludylops.live` and immediately presents it as the
creator's public address, but `proxy.ts` only wraps authentication routes and
does not rewrite requests by hostname. Even with wildcard DNS/TLS configured,
requesting a creator subdomain at `/` serves the ordinary root route instead of
`/c/<slug>`.

## Current state

- `service.ts` inserts `${slug}.ludylops.live` into `creator_domains`.
- `tenant.ts` can extract a creator slug from a subdomain, but its helpers are
  private and the resolver is not wired into Next routing.
- `proxy.ts` returns nothing from the Auth.js callback and its matcher excludes
  public `/` requests.
- `src/app/c/[creatorSlug]/page.tsx` is the existing creator landing surface.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm test -- creators proxy` | all matching tests pass |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `$env:NEXTAUTH_SECRET='ci-build-only-dummy-secret'; npm run build` | exit 0 |

## Scope

**In scope**: a pure tested hostname-routing helper under `src/lib/creators/`,
`proxy.ts`, focused tests, and a deployment runbook for wildcard DNS, Vercel
domain configuration, TLS, and smoke checks.

**Out of scope**: arbitrary custom domains, querying Neon on every proxy request,
rewriting static assets/API/auth callbacks, or scoping operational module data.

## Git workflow

- Branch `codex/016-creator-hostname-routing` from updated `master`.
- Commit message: `route creator subdomains to public areas`.

## Steps

### Step 1: Define a pure routing decision

Extract/reuse strict hostname normalization and accept only one validated slug
directly under `*.ludylops.live`. Exclude the apex, `www`, invalid/multi-label
subdomains, local hosts, and reserved words. For the initial slice, rewrite only
the subdomain root `/` to `/c/<slug>`; leave module routes for their tenant-aware
server pages introduced by plans 009+.

**Verify**: table-driven tests cover valid, reserved, malformed, apex, www, port,
and forwarded-host inputs.

### Step 2: Compose routing with Auth.js proxy behavior

Use the documented Next 16 `NextResponse.rewrite` path while preserving existing
session protection. Expand the matcher only as far as needed and explicitly
exclude `_next`, static files, health/auth callbacks, and APIs that must not be
rewritten. Prevent `/c/<slug>` rewrite loops.

**Verify**: proxy/helper tests show creator root rewrite and unchanged behavior
for admin, owner, me, API, and static requests.

### Step 3: Document external infrastructure

Document that application routing does not provision DNS. List wildcard DNS,
Vercel wildcard-domain ownership, TLS certificate coverage, and a repeatable
smoke check that validates the response/creator identity without changing DNS.

**Verify**: runbook distinguishes DNS arrival, TLS, and Next rewrite failures.

### Step 4: Run gates

**Verify**: lint, typecheck, focused tests, full tests, and build exit 0.

## Test plan

- `mari.ludylops.live/` rewrites to `/c/mari` while retaining the visible host.
- Apex/www do not rewrite.
- Static, API, auth, and already-prefixed `/c/` requests do not rewrite.
- Disabled/archived creators remain blocked by plan 017's public serving policy.

## Done criteria

- [ ] Creator wildcard root requests render the creator landing route.
- [ ] Auth.js route protection remains unchanged.
- [ ] No database lookup occurs in the wildcard routing hot path.
- [ ] DNS/TLS/Vercel requirements and smoke checks are documented.
- [ ] Lint, typecheck, tests, and build pass.

## STOP conditions

- The Auth.js wrapper cannot safely return a rewrite in this Next/Auth version.
- Supporting custom domains requires a database call in proxy; defer that to a
  verified-domain design plan.
- Plan 017 is not complete, so inactive creators would be newly exposed.

## Maintenance notes

When custom domains are added, route only verified hostnames and cache the
hostname-to-creator mapping. Do not generalize this wildcard parser into an
authorization mechanism for integration requests.
