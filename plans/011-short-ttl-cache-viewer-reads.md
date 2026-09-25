# Plan 011: Cache only isolated, shared reads with required creator keys

> **Executor instructions**: Cache identity is a data-isolation boundary.
> Read installed Next.js cache documentation before selecting an API. Never
> cache session-derived results, personal bets/balances, or mutating OBS GETs.
>
> **Drift check**: `git diff --stat ec19f8f..HEAD -- "src/app/(community)/page.tsx" "src/app/(community)/ranking/page.tsx" src/lib/db/repository.ts src/lib/current-game.ts src/lib/streamerbot/live-status.ts next.config.ts`

## Status

- **Priority**: P2; supporting work after the isolation pilot.
- **Effort**: M
- **Risk**: HIGH if a key or loader mixes creators; MED for stale public data.
- **Depends on**: plan 009 / #173 for the context contract, plus actual isolation
  of each selected loader. Ranking/economy, bets, current-game and live-state
  follow-ups are not yet numbered; plan 009 alone does not deliver them.
- **Category**: perf
- **Planned at**: commit `ec19f8f`, reconciled 2026-09-15; same file tree as master `f353ce2`.
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/176
- **State**: TODO, deferred until at least one in-scope loader satisfies the
  isolation gate. Planning update only.

## Why this matters

Repeated public reads can share short-lived results within the same community.
A cache must not share records between communities, even when resource names
and local ids match. Adding creatorId only to the cache key cannot repair a
loader that still reads global rows.

This reduces repeated computation/queries on hits. It does not by itself remove
serverless page invocations or guarantee a particular deployment-wide hit rate.

## Current state

- src/app/(community)/page.tsx calls listBets(activeViewerId), not an anonymous
  list. Treat that existing result as personalized and leave it uncached.
- src/app/(community)/ranking/page.tsx calls getLeaderboard() with no creator;
  src/lib/db/repository.ts joins all user balances without a creator filter.
- getCurrentGame in src/lib/current-game.ts and live-status helpers in
  src/lib/streamerbot/live-status.ts also need creator-specific configuration/state
  before they are candidates for a multi-creator cache.
- Existing repository tests use mutable demo state; cache outside repository.ts
  and bypass caching in demo mode.
- The existing OBS quotes GET processes a queue and is out of scope.

## Scope

**In scope**: new src/lib/cache.ts and src/lib/cache.test.ts, verified shared
read call sites in src/app/(community)/page.tsx and
src/app/(community)/ranking/page.tsx, and next.config.ts only if the selected
documented API strictly requires it. Prefer a local wrapper without a global
rendering-mode change. Report plan/index status.

**Out of scope**: repository isolation implementation, personal/session reads,
anonymous suggestion-list stretch goals, admin caching, API response caching,
OBS endpoints, a global caching-framework migration, production changes.

## Steps

### 1. Verify eligibility and select the documented mechanism

Read:
- node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md
- node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md
- node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md
- node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md
- node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md

Inventory each candidate's actual arguments, data returned and isolation tests.
Only accept a loader that requires creator context and restricts its reads to
that creator. Verify public lifecycle/module authorization before cache lookup,
so disabling a creator does not continue serving cached content.
If no candidate qualifies, report the unmet prerequisite without shipping an
unused helper or applying a global-data cache.

**Verify**: a per-call-site eligibility table records shared versus personalized,
creator restriction evidence and TTL. The mechanism choice cites installed docs.

### 2. Require a creator in the cache contract

Define a typed wrapper with required creatorId, resource key and TTL. Pass that
creator into the loader itself; use creatorId in the cache key and any invalidation
tags. Include other public query dimensions such as page/limit when applicable.
Never substitute DEFAULT_CREATOR_ID for a missing argument or capture another
creator in an unkeyed closure.

Resolve session/request authorization outside the cached function. Bypass cache
entirely in demo mode. Proposed TTLs are tuning starting points: ranking 15s,
public current-game 30s, public live state 10s, public anonymous bets 5s only
if a genuinely separate anonymous loader exists after the relevant follow-up.

**Verify**: typecheck passes; wrapper tests reject missing creator input and
prove the requested creator is passed to the loader and key/tag construction.

### 3. Adopt only eligible call sites

Wrap eligible public ranking/current-game/live-state reads. Leave
listBets(activeViewerId) and all logged-in viewer data untouched.
Do not change a personalized call to anonymous merely to make caching possible.
Do not invent a fixed number of wrapped sites as a completion criterion:
document which qualified and why others were deferred.

**Verify**: review call sites and test two creators with overlapping ids/resource
keys; creator A's cache hit cannot return creator B's data or bypass access checks.

### 4. Test behavior and framework limits

Use Vitest conventions for deterministic wrapper/key/loader tests. Prove
separation of creator keys and tags, demo bypass, personalized-path exclusion,
and creator/module denial before cached reads. Exercise actual repeated requests
and expiry in a test-environment Next build where the cache runtime is available.
A mocked cache function does not prove real cache hits or TTL expiration.

**Verify**: npm test -- cache, npm run typecheck, npm run lint, npm test,
and npm run build pass. Use only test/demo credentials. Record runtime cache-hit
and expiry evidence, or explicitly report an unverified runtime gate.

## Done criteria

- [ ] At least one adopted loader was already demonstrably isolated by creator.
- [ ] The helper requires creatorId and keys/tags/loaders consistently use it.
- [ ] A/B separation, denial checks and demo bypass are tested.
- [ ] No personal/session result or mutating GET is cached.
- [ ] Runtime hit/expiry behavior has been verified in a test environment.
- [ ] Gates pass; the report names adopted and deferred call sites.

## STOP conditions

- The intended loader still reads global operational data.
- A cache hit could bypass lifecycle/module checks.
- A call contains viewer-specific fields, including listBets(activeViewerId).
- The installed cache mechanism requires broad out-of-scope app changes.
- Demo/unit mocks are the only evidence offered for runtime TTL behavior.

## Git workflow and maintenance

Update the remote base, then use codex/011-viewer-read-cache in an isolated
worktree. Keep repository services uncached. Include Closes #176 if opening an
issue PR. Re-evaluate TTLs using observed freshness and costs; do not promise a
fixed capacity multiplier. Per-creator keys are mandatory now, not future work.
