# Plan 012: Bound the hot viewer queries and move HLTB refresh off the request path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ec19f8f..HEAD -- src/lib/db/repository.ts src/components/leaderboard-table.tsx "src/app/(community)/ranking/page.tsx"`
> On drift, compare the "Current state" excerpts; mismatch = STOP.

## Status

- **State**: IMPLEMENTED; validated, awaiting PR review/merge. Reconciled with issue #177 and master 166af8d on 2026-09-22.

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches `repository.ts` — the shared data layer; changes are additive parameters + one behavioral move)
- **Depends on**: none (complements 011; independent)
- **Category**: perf
- **Planned at**: commit `ec19f8f`, reconciled 2026-09-15 (same file tree as remote master `f353ce2`).
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/177

## Why this matters

Three request-path costs grow with data size, not audience size — they make every single render heavier forever:

1. **`getLeaderboard()` is unbounded** — it selects *every* user with a balance, sorted, on every `/ranking` view, and `LeaderboardTable` renders every row into the DOM. At 10k registered viewers that's a 10k-row query + 10k-row HTML page, per view.
2. **`listGameSuggestions()` does an O(n×m) boost join in JS** — for each suggestion it `.filter()`s the full boosts array; fine at 30 suggestions, quadratic pain at 500.
3. **`refreshStaleHowLongToBeatRows` runs external HowLongToBeat API calls + DB writes during viewer page renders** — a viewer opening `/jogos` can trigger up-to-batch-limit outbound HTTP calls and row updates before the page returns. Under concurrency, multiple renders race to refresh the same rows (duplicate external calls + writes), and page latency depends on a third-party API.

Fixing these caps per-request work regardless of how big the community gets — and matters double once creator-specific datasets grow.

## Delivery — 2026-09-22

- Rechecked against `166af8d` (PR #199 merged). The drift from `ec19f8f` adds
  quote isolation and module guards; the selected leaderboard and suggestion
  loaders still match the costs described below. Existing guards remain intact.
- All leaderboard callers were enumerated: `/ranking`, `/api/leaderboard` and
  `/api/viewers` now use the default 100. None computes an individual rank or
  merges the full result. The authenticated `/admin` caller explicitly uses
  `{ limit: null }` to preserve its total badge and top-20 display. Numeric
  limits must be integers from 1 to 100; omitted means 100, never unlimited.
- Both database suggestion lists group boosts once, keeping viewer filters,
  per-suggestion totals, sorting and all other returned fields unchanged.
- **Variant A shipped**: default `listGameSuggestions` only reads stored HLTB
  data; `listAdminGameSuggestions` opts into the existing best-effort refresh,
  including its eight-row cap and TTLs. Creation and metadata correction still
  resolve HLTB as before. No endpoint, scheduler or new secret is needed.
- HLTB duration also affects the short-game priority multiplier. Viewer reads
  preserve the last stored duration and its multiplier; freshness was already
  best-effort. Without an admin refresh or backfill, those values can remain
  stale. No balance or recorded vote amount is recomputed by this change.
- `docs/howlongtobeat.md` describes the new refresh trigger. The only admin
  source edit is its explicit unbounded leaderboard call, required to preserve
  behavior. No schema or Streamer.bot configuration changes.
- This is supporting performance work. Ranking and suggestions remain behind
  the default-creator guards until their own isolation follow-ups are complete.
  It does not unblock #176's requirement for isolated cache loaders.

Validation: 783 tests passed (18 new), two pre-existing opt-in PostgreSQL tests skipped; typecheck, lint and production build passed with demo/test configuration. Headless Edge checked ranking at 1440px and 390px, public games/videos, and both ranking APIs (200 for the default community, 403 for an unknown creator). No browser JavaScript errors. Screenshots confirmed the new copy fits. A pre-existing 2px mobile overflow is in the unchanged social-links footer, outside this delivery. New tests
exercise both demo and database code paths with stubbed database I/O; they do
not claim a production load benchmark or a real PostgreSQL integration run.

## Current state

- `src/lib/db/repository.ts:5529` — `getLeaderboard()`:
  ```ts
  export async function getLeaderboard() {
    ...
    const rows = await db.select({ ... })
      .from(users)
      ...
      .where(eq(users.excludeFromRanking, false))
      .orderBy(desc(viewerBalances.currentBalance));   // ← no .limit()
    return rows;
  }
  ```
  Demo path likewise returns all viewers sorted. Callers: enumerate with `rg -n "getLeaderboard" src -g "*.ts" -g "*.tsx"` — at minimum `src/app/(community)/ranking/page.tsx` (public) and possibly admin panels (admin may legitimately want everything; check before changing them).

- `src/components/leaderboard-table.tsx:44` — `entries.map((entry, index) => …` renders all rows, no pagination/cap.

- `src/lib/db/repository.ts, listGameSuggestions` — `listGameSuggestions(viewerId?)`, DB path:
  - selects **all** `gameSuggestions` ordered by votes (unbounded, acceptable for now — do not paginate suggestions in this plan; the boost-join and HLTB issues are the targets),
  - then per suggestion: `boosts: serializedBoosts.filter((entry) => entry.suggestionId === suggestion.id)` — the O(n×m) join,
  - and before serialization calls `suggestionRows = await refreshStaleHowLongToBeatRows(db, suggestionRows);` — the on-request external refresh. The function (find with `rg -n "refreshStaleHowLongToBeatRows" src/lib/db/repository.ts`) filters stale rows, caps at `HOWLONGTOBEAT_REFRESH_BATCH_LIMIT`, then `Promise.all` of `resolveHowLongToBeatGame(...)` (external HTTP) + `db.update(...)` per row, best-effort try/catch.

- `listVideoSuggestions` (`repository.ts, listVideoSuggestions`) — inspect for the same boost-filter shape; it has no HLTB refresh.

- `listAdminGameSuggestions()` currently just calls `listGameSuggestions()` — the admin path can keep (or explicitly trigger) the HLTB refresh.

- Existing test patterns: `src/lib/db/repository.test.ts` (demo-mode unit tests) — model new tests on it.

- Related precedent: PS Plus and Steam metadata refresh already live behind internal sync endpoints (`/api/internal/ps-plus/sync`, `/api/internal/steam/sync`, bearer-token protected, called by an external scheduler — see README "Endpoints internos"). HLTB should follow the same shape rather than inventing a new pattern.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Install   | `npm install`      | exit 0              |
| Lint      | `npm run lint`     | exit 0              |
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`         | all pass (current suite plus relevant new tests) |
| Build     | `npm run build`    | exit 0 (dummy `NEXTAUTH_SECRET`) |

## Scope

Supporting work after the product pilot unless current latency justifies it.
If the selected functions have acquired required creator context, preserve it
on all reads, joins, counts and sync operations. A scheduled refresh must use an
explicit authorized creator or a deliberate platform-wide reference-data job;
never silently fall back to Ludylops. This plan does not implement tenancy.


**In scope**:
- `src/lib/db/repository.ts` — ONLY: `getLeaderboard`, `listGameSuggestions`, `listVideoSuggestions`, `refreshStaleHowLongToBeatRows` call sites, and (if created) a small exported `refreshHowLongToBeatData` entry point
- `src/components/leaderboard-table.tsx` + `src/app/(community)/ranking/page.tsx` — only as needed for the limit's UX copy
- `src/app/api/internal/hltb/sync/route.ts` (create, optional Step 3 variant B) + `src/lib/env.ts` ONLY to add an optional `HLTB_SYNC_SECRET` mirroring `STEAM_SYNC_SECRET` (additive; no changes to existing env behavior)
- New tests alongside existing repository tests
- `README.md` — internal-endpoints section if variant B is chosen

**Out of scope** (do NOT touch):
- Any other repository function; no decomposition of `repository.ts` (deliberately deferred — see index)
- Admin ranking/pages that legitimately need the full list — give admins an explicit unbounded call rather than changing their behavior silently
- Suggestion pagination, catalog, bets, redemptions
- The HLTB resolution logic itself (`resolveHowLongToBeatGame` etc.)

## Git workflow

- Update local `master`, branch `codex/012-bound-hot-queries`. Short imperative commits. No push/PR unless instructed.

## Steps

### Step 1: Bound the leaderboard

Add public limit options without weakening any required creator parameter introduced by isolation work. Default the public path to 100 and mirror its limit in demo mode. Enumerate all callers first (`rg -n "getLeaderboard" src`); any admin caller that needs everything uses an explicit admin-only unbounded path. An omitted limit must not ambiguously mean both 100 and unlimited. If the leaderboard feeds a "find my own rank" feature, preserve its rank calculation separately; do not silently truncate that input. Report the coupling before expanding the plan's scope.

Ranking page UX: with the cap, add one line of copy to `/ranking` if appropriate (e.g. "Top 100") — pt-BR with correct accents, no eyebrow labels.

**Verify**: `npm test` passes; new test (Step 4) proves the cap.

### Step 2: Fix the O(n×m) boost join

In `listGameSuggestions` (and `listVideoSuggestions` if it has the same shape): build `const boostsBySuggestion = new Map<string, Boost[]>()` in one pass over `serializedBoosts`, then look up per suggestion. Pure refactor — output must be identical (order included).

**Verify**: existing suggestion tests pass unchanged.

### Step 3: Move the HLTB refresh off the viewer request path

`listGameSuggestions` no longer calls `refreshStaleHowLongToBeatRows` for viewer traffic. Choose the lighter variant that matches what you find:

- **Variant A (minimum)**: add `{ refreshHltb?: boolean }` to `listGameSuggestions`; default false. `listAdminGameSuggestions()` passes `true` — admins opening the panel keep data fresh, viewers never pay for it.
- **Variant B (preferred if straightforward)**: Variant A **plus** an internal sync endpoint `POST /api/internal/hltb/sync` mirroring the Steam sync route (copy `src/app/api/internal/steam/sync/route.ts` structure incl. bearer auth via a new optional `HLTB_SYNC_SECRET`), calling an exported `refreshHowLongToBeatData()` that loads suggestions and runs the existing refresh helper. Document it in README beside the Steam sync entry (pt-BR, match the existing entries' voice).

Either way, stale HLTB data must degrade gracefully in the UI (it already does — the refresh was best-effort).

**Verify**: `rg -n "refreshStaleHowLongToBeatRows" src/lib/db/repository.ts` shows it is no longer reachable from the default viewer path (only behind the flag/endpoint).

### Step 4: Tests

Add to a new `src/lib/db/repository-perf.test.ts` (model on `repository.test.ts`, demo mode):
1. `getLeaderboard({ limit: 2 })` returns 2 entries; public default returns ≤100; admin-only unbounded access remains explicit.
2. Suggestions with multiple boosts attach the right boosts to the right suggestion (guards the Map refactor).
3. `listGameSuggestions()` (default) does not invoke the HLTB resolver — spy/stub `resolveHowLongToBeatGame` if it's injectable; if it isn't stub-able in demo mode (demo path may skip it anyway), assert via the DB-path unit seam you can reach and note the limitation.

**Verify**: `npm test` → all pass including new file.

### Step 5: Full gate

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Test plan

See Step 4. The existing test suite must pass unchanged — identical output from Step 2 is the regression bar.

## Done criteria

- [x] `getLeaderboard` accepts and enforces a limit; public ranking capped at 100; admin callers' behavior preserved explicitly
- [x] Boost join is a Map lookup (no `.filter` inside the suggestion `.map`) in game + video suggestion lists
- [x] Viewer-path `listGameSuggestions` performs zero HLTB external calls
- [x] New tests exist and pass; `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` all exit 0
- [x] `git diff --stat` touches only in-scope files
- [x] `plans/README.md` status row updated; report states which Step 3 variant shipped

## STOP conditions

- A caller uses the full leaderboard for rank computation or merging (limit would corrupt results).
- `listVideoSuggestions` turns out to have a materially different shape than described — report before refactoring it.
- The HLTB refresh turns out to be load-bearing for correctness (something depends on refreshed-on-read data) rather than best-effort display data.
- Any existing test fails after Step 2 (the "pure refactor" wasn't pure).

## Maintenance notes

- This plan deliberately does NOT decompose `repository.ts` (10k lines) — that remains deferred until characterization coverage grows (see index). These are surgical fixes.
- If variant B ships, add the HLTB sync to the same external scheduler that calls PS Plus/Steam syncs (operator step; note it in the report).
- White-label note: per-creator scoping (plans 008/009+) will add `creator_id` filters to these same functions — the limit/Map/flag parameters added here must survive that change; keep signatures tidy.
