# Plan 011: Short-TTL caching for viewer-facing reads

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Read the installed Next.js docs BEFORE writing any code** (this Next 16
> differs from training data): `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`,
> `09-revalidating.md`, `02-guides/caching-without-cache-components.md`, and the
> API references for `use cache`, `cacheLife`, and `unstable_cache`.
>
> **Drift check (run first)**:
> `git diff --stat f245ee1..HEAD -- src/app/page.tsx "src/app/(public)/ranking/page.tsx" src/lib/db/repository.ts next.config.ts`
> On drift, re-verify the "Current state" excerpts; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (caching bugs show up as stale data during a live; TTLs are deliberately tiny)
- **Depends on**: none (010 is complementary, not required)
- **Category**: perf
- **Planned at**: commit `f245ee1` (origin/master), 2026-07-07
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/176

## Why this matters

Every viewer page render is a fresh serverless invocation running live Neon queries — there is **zero caching anywhere**: pages read session/cookies (dynamic), and API handlers set `no-store`. N concurrent viewers = N × (render + queries), so audience size converts 1:1 into Neon load and Vercel invocations. During a live, the underlying data (leaderboard, open bets, current game) changes every few seconds at most; recomputing it hundreds of times per second for hundreds of viewers is pure waste. A 5–15s server-side data cache collapses that to ~1 query per TTL window regardless of audience size — the single cheapest capacity multiplier available before the white-label rollout multiplies traffic per creator.

## Current state

- No cache usage anywhere: `grep -rn "unstable_cache\|use cache\|cacheLife" src/` → 0 matches. `next.config.ts` has no `cacheComponents` flag (it sets only `reactCompiler: true` and `images`).
- The home page `src/app/page.tsx` is a server component that reads the session (`auth()` at `:16` import) — the **page** cannot be statically cached, but its shared data can. Its data calls (all uncached, every view):
  - `listBets()` from `@/lib/db/repository` (imported at `:27`)
  - `getCurrentGame()` from `@/lib/current-game` (`:26`)
  - `isStreamerbotLivestreamActive()` from `@/lib/streamerbot/live-status` (`:29`)
- `/ranking` (`src/app/(public)/ranking/page.tsx`) reads **no session** — it calls `getLeaderboard()` and renders. Excerpt:
  ```tsx
  import { getLeaderboard } from "@/lib/db/repository";
  export default async function RankingPage() {
    const leaderboard = await getLeaderboard();
  ```
  (`getLeaderboard` is currently unbounded — plan 012 bounds it; independent of this plan.)
- `/apostas` reads `auth()` server-side, and `/jogos`/`/videos` pass a session `viewerId` into `listGameSuggestions(viewerId)`/`listVideoSuggestions(viewerId)` — per-viewer data mixed with shared data. Caching those is the **stretch goal only** (Step 5); the safe core is home + ranking.
- Demo mode (`isDemoMode`, no `DATABASE_URL`): repository functions read a mutable in-memory store; several tests rely on calling repository functions directly and seeing fresh state. **Therefore: do not add caching inside `repository.ts`.** Cache at the page/call-site layer via a wrapper, so tests and demo flows are untouched.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Install   | `npm install`      | exit 0              |
| Lint      | `npm run lint`     | exit 0              |
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Tests     | `npm test`         | all pass (300 baseline + new cache tests) |
| Build     | `npm run build`    | exit 0 (dummy `NEXTAUTH_SECRET`) |

## Scope

**In scope**:
- `src/lib/cache.ts` (create) — the small TTL-cache helper
- `src/lib/cache.test.ts` (create)
- `src/app/page.tsx` — wrap the three shared data calls
- `src/app/(public)/ranking/page.tsx` — wrap `getLeaderboard()`
- (stretch, Step 5 only if trivial) anonymous-branch caching in `/jogos`, `/videos`, `/apostas` pages
- `next.config.ts` — ONLY if the chosen mechanism requires a flag, per the installed docs

**Out of scope** (do NOT touch):
- `src/lib/db/repository.ts` — no caching inside the data layer (demo store + tests depend on direct calls)
- `/api/obs/*` — the quotes endpoint is a mutating GET; overlay costs are plans 010/013
- Any admin page or API — admins must always see fresh data
- Auth/session code; per-viewer data (balances, `/me`) — never cache user-specific reads
- `Cache-Control` headers on API routes (viewer pages don't fetch through them server-side)

## Git workflow

- Update local `master`, branch `codex/011-viewer-read-cache`. Short imperative commits. No push/PR unless instructed.

## Steps

### Step 1: Choose the caching mechanism from the installed docs

Read the four docs listed at the top. Decide between:
- **(a) `unstable_cache(fn, keyParts, { revalidate: seconds })`** — no config change; wrap at call sites. Works without `cacheComponents`.
- **(b) `use cache` + `cacheLife`** — the newer model; check `caching-without-cache-components.md` whether it requires enabling `cacheComponents` in `next.config.ts` on this version, and what that flag changes globally.

Recommendation: **(a)** unless the docs mark it deprecated/removed in this version — it is the minimal, local change; (b) flips a global behavior switch this plan doesn't need. If the docs contradict both options (API absent/renamed), STOP and report what the docs actually offer.

**Verify**: state the choice + the doc line supporting it in your report.

### Step 2: Build `src/lib/cache.ts`

A thin wrapper so call sites stay readable and the mechanism is swappable:

```ts
// Server-side TTL cache for shared (non-per-user) reads. Wrap ONLY data that
// is identical for every viewer. Never wrap session-derived or per-viewer reads.
export function cachedShared<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): () => Promise<T>
```

Implemented with the Step 1 mechanism. In demo mode (`isDemoMode` from `@/lib/env`), **bypass the cache entirely** (return `fn` uncached) so local dev and demo flows always see fresh in-memory state.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Wrap the call sites

- `src/app/page.tsx`: `listBets()` → TTL 5s (key `home:bets`); `getCurrentGame()` → TTL 30s; `isStreamerbotLivestreamActive()` → TTL 10s. Session-dependent parts of the page are untouched.
- `src/app/(public)/ranking/page.tsx`: `getLeaderboard()` → TTL 15s (key `ranking:leaderboard`).

Bets nuance: `listBets()` on the home page is called without a viewer (shared). If inspection shows it takes a `viewerId` and the home page passes one, cache **only** the no-viewer variant; if the home page passes a viewer id, STOP and report rather than caching per-user data.

**Verify**: `npm run lint` → exit 0; `npm test` → all pass.

### Step 4: Test the helper

`src/lib/cache.test.ts` (Vitest, model on existing `src/lib/**` tests): with a counting stub fn, two calls within TTL execute the fn once; demo mode bypass executes it twice. If the Step 1 mechanism can't be exercised in Vitest (framework-bound), test the demo bypass + wrapper shape and note the limitation in your report.

**Verify**: `npm test -- cache` → new tests pass.

### Step 5 (stretch — skip if any friction): anonymous suggestion lists

In `/jogos` and `/videos` pages only, when there is no session viewer, serve `listGameSuggestions(null)` / `listVideoSuggestions(null)` through `cachedShared` (TTL 15s). Logged-in viewers keep the uncached per-viewer path. Skip entirely if the pages' data flow makes the split non-obvious — note it as deferred.

### Step 6: Full gate + staleness sanity

`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`. Then `npm run dev` **with** a real `DATABASE_URL` if available (otherwise note demo bypass makes local staleness invisible) and confirm `/ranking` renders.

**Verify**: all exit 0.

## Test plan

- New `src/lib/cache.test.ts` (Step 4): TTL dedupe + demo bypass.
- Existing 300 tests must pass unchanged — if any repository test starts failing, you cached inside the wrong layer (STOP condition).

## Done criteria

- [ ] `src/lib/cache.ts` + tests exist; `npm test` all pass
- [ ] Home page's three shared calls and ranking's leaderboard go through `cachedShared` (grep `cachedShared` → ≥4 call sites)
- [ ] `src/lib/db/repository.ts` unmodified (`git diff --stat`)
- [ ] No admin or per-viewer read is wrapped (reviewer greps call sites)
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` all exit 0
- [ ] `plans/README.md` status row updated; report names the mechanism chosen and why

## STOP conditions

- The installed docs show neither `unstable_cache` nor a no-flag `use cache` path works on this version/config — report the actual options.
- Wrapping requires passing session/viewer data into the key — that read is per-user; don't cache it, report it.
- Any existing test fails after wrapping (cache leaked into the data layer).
- The mechanism requires `cacheComponents: true` AND enabling it changes behavior of unrelated pages in `npm run build` output — report before flipping a global flag.

## Maintenance notes

- TTLs are deliberately tiny (5–30s); tune upward only with evidence. During-live freshness beats cache hit rate here.
- White-label: once pages become per-creator (plans 008/009+), cache keys must include the creator id — `cachedShared`'s key parameter is where that lands. Flag this in `docs/creator-scoping.md` when 009 executes.
- Reviewer focus: nothing session-derived inside a wrapped fn; demo bypass works; keys are distinct per call site.
