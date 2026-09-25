# Plan 013: Measure overlay delivery cost before a realtime redesign

> **Executor instructions**: This is a small measurement/design task.
> Record assumptions separately from observations. It does not block a
> controlled two-creator pilot and does not authorize infrastructure changes.

## Status

- **Priority**: P3; deferred broad architecture comparison.
- **Effort**: S for the first measurement; a later study needs a separate scope.
- **Risk**: LOW; read-only measurement and documentation.
- **Depends on**: no code prerequisite for inventory. Use observed pilot data
  when available and state whether plan 010 / #175 has actually landed.
- **Category**: direction / tech-debt
- **Planned at**: commit `ec19f8f`, reconciled 2026-09-15; same file tree as master `f353ce2`.
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/178
- **State**: TODO; reconciliation only.
- **Drift check**: `git diff --stat ec19f8f..HEAD -- src/components src/app/api/obs bridge package.json`

## Why this matters

Creator count multiplies polling traffic. Measure that load before deciding to
replace transport. The previous plan made a broad SSE/managed-realtime/local
bridge comparison a prerequisite for onboarding; this revision removes that
gate. Isolation, permissions and configuration remain pilot release gates.

## Current state

- src/components/obs-quote-overlay.tsx polls quotes every 200 ms while live and
  live status every 5 s. Four other OBS overlays poll their data about once a
  second without live gating.
- Plan 010 proposes quotes at 1 s and four additional live-status checks at 15 s.
  For five open sources, its configured steady-state upper rates are about
  5.47 requests/s while live and 0.47 while offline, excluding retries and
  initial requests. Self-rescheduling loops may run slower with request latency.
- src/app/api/obs/quotes/current/route.ts mutates queue state on GET. Count its
  actual queries/side effects; do not label every request as one database query.
- Viewer page renders and bridge polling are separate load sources.
  Plan 011's page data cache does not cache OBS operations.
- Hosting topology, current bills and limits must be verified when measuring;
  repository configuration alone does not prove the deployed environment.

## Scope and deliverable

Write docs/overlay-delivery-design.md with:
1. Endpoint inventory: active sources, interval, live/offline gating,
   read-only versus mutating operation, and observed query count when available.
2. Load table for 1, 2 and 5 concurrent creators, with stream duration and
   OBS-open-offline assumptions. Separate requests, queries and monetary cost.
3. Available pilot measurements: errors, pickup latency, requests and database
   load. Missing telemetry/prices must be marked unknown.
4. Recommendation to retain/tune polling or commission a larger design study,
   with an evidence-based review trigger. A forecast is not measured capacity.

No production code, new services, prototype, subscription, DNS or deployment
changes. Do not cache/dequeue real viewers' events to perform measurement.

## Steps and verification

1. Inventory fetch targets in src/components/obs-*.tsx using rg with a quoted
   glob and inspect their route handlers. Record current configuration and
   the separate hypothetical result of plan 010.
   **Verify**: every active overlay's data and live-status request is counted.

2. Observe a disposable/local pilot or read existing telemetry if authorized
   access exists. Do not load-test production. For monetary estimates, verify
   current official hosting/database prices and limits; cite source URLs and
   retrieval dates. If access is absent, finish the bounded inventory/model and
   explicitly leave measured-cost conclusions open.
   **Verify**: each number is labeled observed, calculated or unknown.

3. Write the recommendation. Retain polling if the evidence does not justify
   redesign. If a problem is shown, identify the smallest next investigation,
   covering only relevant candidates and preserving creator authorization,
   queue claim/display behavior, reconnects and failure recovery.
   **Verify**: the document states the trigger, assumptions and remaining unknowns.

## Done criteria

- [ ] Complete poll inventory with separate live/offline scenarios.
- [ ] Arithmetic is reproducible and counts status polls and bridge separately.
- [ ] Measurements and forecasts are clearly distinguished.
- [ ] Every quoted external price/limit has a current primary-source citation.
- [ ] A bounded recommendation and review trigger are recorded.
- [ ] No production code, shared data or infrastructure was changed.

## Git workflow and maintenance

Update remote base before making a documentation branch. Include Closes #178
if an issue PR completes this revised deliverable. The larger comparison is
deferred; completing this measurement does not imply a transport migration.
Revisit when pilot costs/latency exceed the documented trigger or actual usage
changes. Do not delay the two-creator pilot solely because telemetry is missing.
