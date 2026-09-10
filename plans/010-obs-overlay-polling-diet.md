# Plan 010: Cut OBS overlay polling cost (interval hygiene + live-status gating)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f245ee1..HEAD -- src/components/obs-quote-overlay.tsx src/components/obs-bet-overlay.tsx src/components/obs-like-goal-overlay.tsx src/components/obs-subscriber-overlay.tsx src/components/obs-wheel-overlay.tsx`
> On any change, compare the "Current state" excerpts against the live code;
> on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `f245ee1` (origin/master), 2026-07-07
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/175

## Why this matters

The OBS overlays are Vercel serverless invocations + Neon queries on every poll, with no cache. Today: the quote overlay polls its endpoint every **200ms while live** (5 req/s ≈ 18k invocations per hour of stream, from one browser source), and the bet, like-goal, subscriber, and wheel overlays each poll every **1s unconditionally — even when the stream is offline** (4 req/s ≈ 345k invocations/day if OBS stays open). This is the single largest self-inflicted invocation cost in the app, it multiplies per creator once white-label instances go live, and none of it is needed for perceived quality: quotes display for ~12s, so a 1s pickup delay is invisible.

Target after this plan, per OBS instance: ~5 req/s → ~5 req/s **only while live** drops to ~1–2 req/s while live and ~0.3 req/s while offline.

## Current state

All five overlay components are `"use client"` and poll `force-dynamic`, `no-store` endpoints under `/api/obs/*`.

- `src/components/obs-quote-overlay.tsx` — the **good pattern to copy**, except for its interval value:
  - `:28-29`:
    ```ts
    const QUOTE_POLL_INTERVAL_MS = 200;
    const LIVE_STATUS_POLL_INTERVAL_MS = 5_000;
    ```
  - It polls `/api/obs/live-status` every 5s (effect at `:140-162`, self-rescheduling `setTimeout`), and **only when `isLive`** polls `/api/obs/quotes/current` every 200ms (effect at `:164-219`, gated by `if (isDemo || !isLive) return undefined;` at `:165`).
  - CRITICAL: `/api/obs/quotes/current` (`src/app/api/obs/quotes/current/route.ts:8`) calls `processNextQueuedQuoteOverlay()` — a **mutating GET** that dequeues the next quote. Do NOT cache this endpoint and do NOT deduplicate its calls; only change the frequency.

- The other four overlays poll their data endpoint every 1000ms with **no live gating** (plain `setInterval`, runs while offline too):
  - `src/components/obs-bet-overlay.tsx:79` — `setInterval(loadBet, 1000)`
  - `src/components/obs-like-goal-overlay.tsx:73` — `setInterval(loadState, 1000)`
  - `src/components/obs-subscriber-overlay.tsx:156` — `setInterval(loadAlerts, 1000)`
  - `src/components/obs-wheel-overlay.tsx:102` — `setInterval(loadWheel, 1000)`
  - Each also has unrelated `setInterval`s (clock ticks `setNow`, demo cycles) — leave those untouched.

- `/api/obs/live-status` exists and is already consumed by the quote overlay — reuse it; do not build a new status endpoint.

- Repo conventions: named `*_INTERVAL_MS` constants at the top of the component; self-rescheduling `setTimeout` with a `cancelled` flag (quote overlay `:140-162`) is the preferred loop shape.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Install   | `npm install`      | exit 0              |
| Lint      | `npm run lint`     | exit 0              |
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Tests     | `npm test`         | all pass (300 baseline) |
| Build     | `npm run build`    | exit 0 (set a dummy `NEXTAUTH_SECRET`) |
| Manual    | `npm run dev` then open `http://localhost:3000/obs/quotes?demo=1` (and the other overlay routes) | overlay renders; demo modes unaffected |

## Scope

**In scope** (only these files):
- `src/components/obs-quote-overlay.tsx` (interval value only)
- `src/components/obs-bet-overlay.tsx`
- `src/components/obs-like-goal-overlay.tsx`
- `src/components/obs-subscriber-overlay.tsx`
- `src/components/obs-wheel-overlay.tsx`

**Out of scope** (do NOT touch):
- Any `/api/obs/*` route handler — no caching, no endpoint changes (that's plan 011/013 territory).
- The quote overlay's live-status gating logic — it is already correct.
- Demo-mode behavior (`isDemo` branches, demo cycle intervals, `setNow` clock intervals).
- Streamer.bot scripts, bridge, `quoteOverlayDurationSeconds` config.
- Any push/SSE mechanism — that's plan 013's design spike.

## Git workflow

- Update local `master` from origin, branch `codex/010-overlay-polling-diet`.
- Short imperative commit messages (match `git log`). Do NOT push/PR unless the operator instructed it.

## Steps

### Step 1: Raise the quote poll interval

In `obs-quote-overlay.tsx:28`, change `QUOTE_POLL_INTERVAL_MS` from `200` to `1_000`. Nothing else in this file.

**Verify**: `grep -n "QUOTE_POLL_INTERVAL_MS = 1_000" src/components/obs-quote-overlay.tsx` → 1 match.

### Step 2: Add live-status gating to the four ungated overlays

For each of bet/like-goal/subscriber/wheel, replicate the quote overlay's structure (`obs-quote-overlay.tsx:96-162` for status polling, `:164-219` for the gated data loop):

1. Add `isLive` state + a live-status poll of `/api/obs/live-status` every `LIVE_STATUS_POLL_INTERVAL_MS = 15_000` (15s — these overlays tolerate a slower wake-up than quotes; a stream going live shows overlay data within ≤15s, acceptable).
2. Gate the existing 1s data poll on `isLive` (and keep the existing `isDemo` short-circuits exactly as they are). When not live, clear the overlay data state (mirror `setLiveOverlay(null)`).
3. Extract the data interval into a named constant `…_POLL_INTERVAL_MS = 1_000` if not already named.
4. Convert plain `setInterval` data loops to the self-rescheduling `setTimeout` + `cancelled` pattern to match the quote overlay (prevents overlapping requests on slow responses).

One judgment call made for you: when the live-status fetch **fails**, treat it as `isLive = false` (same as the quote overlay's catch at `:132-136`) — overlays go quiet on network trouble rather than hammering.

**Verify**: `npx tsc --noEmit` → exit 0; `grep -c "live-status" src/components/obs-bet-overlay.tsx src/components/obs-like-goal-overlay.tsx src/components/obs-subscriber-overlay.tsx src/components/obs-wheel-overlay.tsx` → ≥1 each.

### Step 3: Manual behavior check

`npm run dev` (no `DATABASE_URL` = demo mode). Open each overlay route (`/obs/quotes`, `/obs/bets`, `/obs/likes`, `/obs/subscribers`, `/obs/wheel`) with the demo flag/behavior they already support and confirm demo rendering is unchanged. Then open one overlay **without** demo and watch the network tab: only `live-status` requests every ~15s (offline), no data-endpoint requests.

**Verify**: network tab shows no `/api/obs/(bets|likes|subscribers|wheel)/current` requests while offline.

### Step 4: Full gate

`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

**Verify**: all exit 0.

## Test plan

- No component test harness exists for overlays; the regression surface is covered by the manual demo checks in Step 3 plus the full existing suite (300 tests) staying green.
- Do not invent a new test framework for this plan.

## Done criteria

- [ ] `QUOTE_POLL_INTERVAL_MS` is `1_000`
- [ ] All four previously-ungated overlays poll data only when live; live-status at 15s
- [ ] No `/api/obs/*` route handler modified (`git diff --stat` shows only the five components)
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` all exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- The subscriber overlay's alert queue semantics turn out to depend on sub-second polling (inspect how alerts expire before changing it) — report instead of guessing.
- `/api/obs/live-status` turns out to be expensive or unsuitable as the shared gate (e.g. it hits YouTube API per call) — report; do not build a new endpoint.
- Any overlay visually breaks in demo mode after the change.

## Maintenance notes

- Plan 013 (overlay delivery design spike) may replace this polling entirely with push; this plan is the cheap stopgap that is worth doing regardless.
- When white-label ships per-creator overlays, these intervals multiply per creator — revisit the 1s live interval if creator count grows before 013 lands.
- Reviewer focus: the `isLive` gating must not delay a *quote redemption* mid-live (quotes path unchanged except 200ms→1s), and demo modes must be pixel-identical.
