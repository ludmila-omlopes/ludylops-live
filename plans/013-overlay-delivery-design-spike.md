# Plan 013: Design spike — overlay/live-data delivery for multi-tenant scale

> **Executor instructions**: This is a **design spike, not a build plan**. The
> deliverable is a decision document plus (optionally) a throwaway prototype in
> a scratch branch — no production code changes. If you cannot ground a claim
> in documentation or a measurement, mark it as an assumption in the doc rather
> than asserting it. When done, update this plan's row in `plans/README.md`.
>
> **Best run by a strong executor with web access** (it requires reading
> current Vercel platform documentation and pricing pages).

## Status

- **Priority**: P2
- **Effort**: M (research + writing; prototype optional)
- **Risk**: LOW (no production changes)
- **Depends on**: none. Informs the white-label rollout (plans 008/009+); plan 010 is the stopgap it may eventually replace.
- **Category**: direction / tech-debt
- **Planned at**: commit `f245ee1` (origin/master), 2026-07-07
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/178

## Why this matters

All live surfaces — 5 OBS overlays plus viewer-page data — are **pull-based**: clients poll `force-dynamic` endpoints; every poll is a Vercel invocation + Neon query. Plan 010 trims the frequency and plan 011 caches shared reads, but the architecture still costs `O(clients × poll rate)` at all times. White-label multiplies this per creator: M creators streaming simultaneously = M × overlay pollers + M audiences. Before onboarding real creators, we need a grounded decision on whether polling remains viable (and at what creator count it stops being), or whether to move to push — and if push, which mechanism actually works on this stack (Vercel serverless functions + Neon; no long-lived server process). Guessing wrong here either wastes a migration or bakes in a cost curve that scales with success.

## Current state (facts to reason from)

- Stack: Next.js 16 on Vercel serverless + Neon serverless Postgres. There is **no long-lived server** — SSE/WebSocket options must account for function duration limits and per-connection-second billing.
- Poll inventory (after plan 010 lands): per OBS instance while live ≈ 1 req/s × 5 overlays + live-status; viewer pages are request/response (plan 011 caches shared reads server-side, but each viewer still invokes functions).
- The quotes overlay endpoint is a **mutating GET** (`processNextQueuedQuoteOverlay()` dequeues) — any push design must preserve exactly-once display semantics for the queue.
- A **local bridge already exists**: `bridge/` runs on the streamer's PC, polls the hosted app for redemptions, and calls the local Streamer.bot HTTP server (`POST /DoAction`). OBS also runs on that same PC. This is a real architectural asset: overlay data could plausibly be delivered locally (bridge → local endpoint → OBS browser source) without touching Vercel at all per frame.
- Streamer.bot itself exposes a local WebSocket/HTTP server that OBS browser sources on the same machine can subscribe to (verify current capabilities in the Streamer.bot docs — per AGENTS.md, always check their up-to-date documentation).
- Per-creator context: each white-label creator runs their own OBS + (presumably) own bridge on their own PC; overlays are per-creator browser sources resolved by subdomain (plans 008/009 add tenancy).

## Deliverable

`docs/overlay-delivery-design.md` containing:

1. **Load model** — a small table: requests/hour and Neon queries/hour for 1 / 5 / 20 concurrently-live creators, under (a) today, (b) after plans 010+011, (c) each candidate architecture. State viewer-count assumptions explicitly.
2. **Candidate evaluation** — for each option below: how it works on this stack, cost curve vs. creator count, failure modes, migration effort (S/M/L), and what it does to the quote-queue semantics:
   - **A. Status quo + tuning** (polling with 010/011; possibly ETag/`If-None-Match` 304s to cut Neon reads while keeping invocations)
   - **B. SSE from Vercel functions** (streaming responses; research current function duration caps and per-connection cost on the relevant plan; reconnection behavior in OBS browser sources)
   - **C. Managed realtime** (e.g. Pusher/Ably/Upstash Redis pub-sub; app publishes on state change, overlays subscribe; monthly cost at 5/20 creators)
   - **D. Local-first via bridge/Streamer.bot** (overlays subscribe to the streamer's local machine; hosted app pushes to — or is polled by — the bridge once, instead of per-overlay; leverages the existing `bridge/` and Streamer.bot's local server)
3. **Recommendation** — one option (or staged combination, e.g. "A until 5 creators, then D"), with the trigger metric that forces the migration (e.g. "when X invocations/month or Y concurrently-live creators").
4. **Migration sketch** for the recommended option — enough for a future build plan: components touched, rollout/rollback, and how demo mode keeps working.

## Method / steps

1. Read the current Vercel docs on streaming/function duration/pricing and the Streamer.bot WebSocket/HTTP server docs (both change over time — do not answer from memory). Record doc URLs + retrieved values in the design doc.
2. Inventory the actual endpoints polled (grep `src/components/obs-*.tsx` for fetch targets) and what each returns; note which are pure reads vs. the mutating quotes GET.
3. Build the load model (deliverable 1) from that inventory.
4. Evaluate A–D (deliverable 2). For D, verify concretely whether an OBS browser source pointed at the hosted overlay page can receive data from `localhost` (mixed-content/CORS constraints) or whether the overlay page itself must be served locally — this determines D's real feasibility, so treat it as the spike's key open question.
5. (Optional, if it materially de-risks the recommendation) a throwaway prototype in a scratch branch — clearly marked, never merged.
6. Write the doc, get it reviewed.

## Scope

**In scope**: research, measurement, `docs/overlay-delivery-design.md`, optional scratch-branch prototype.

**Out of scope**: ANY production code change; changing plans 010/011 (they proceed regardless); committing prototype code to master.

## Done criteria

- [ ] `docs/overlay-delivery-design.md` exists with all four deliverable sections
- [ ] Every platform limit/price cited has a source URL and retrieval date
- [ ] The D-option feasibility question (local delivery to OBS browser sources) is answered concretely, not hand-waved
- [ ] A single recommendation with a numeric migration trigger
- [ ] No production files changed (`git status` on master clean)
- [ ] `plans/README.md` status row updated

## STOP conditions

- No web access to verify Vercel/Streamer.bot current limits — report; a design doc built on stale training data is worse than none.
- The load model reveals plans 010+011 already keep 20 concurrent creators within comfortable budgets — then the recommendation may legitimately be "do nothing further; re-evaluate at N creators," and the doc should say so rather than inventing work.

## Maintenance notes

- Revisit this doc when: white-label onboards its first external creator; Vercel/Neon pricing changes; or an overlay needs sub-second latency (e.g. interactive wheel spins).
- The chosen option becomes a build plan (014+) only when the trigger metric fires or before the first multi-creator live event.
