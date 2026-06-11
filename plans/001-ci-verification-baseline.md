# Plan 001: Add a CI verification baseline (lint, typecheck, tests, build)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 06f0792..HEAD -- package.json .github/workflows tsconfig.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `06f0792`, 2026-06-11
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/136

## Why this matters

The repo has a green verification story (`npm run lint`, `npm test`, `npm run build` all pass at the planned-at commit, and `tsc --noEmit` is clean with 196 tests passing) — but **nothing runs it automatically**. `.github/workflows/` contains only `bootstrap-backlog.yml`, which seeds GitHub issues. PRs merge with zero automated checks, and there is no `typecheck` npm script at all, so type errors that don't surface in lint or tests can ship. Every other plan in `plans/` relies on these gates; this plan is the prerequisite that makes their "Done criteria" enforceable on PRs.

## Current state

- `package.json:5-23` — scripts include `dev`, `build`, `lint` (`eslint .`), `test` (`vitest run`), DB and backfill scripts. There is **no** `typecheck` script.
- `.github/workflows/` — contains only `bootstrap-backlog.yml` (issue seeding). No CI workflow.
- `tsconfig.json` — `"strict": true`, `"noEmit": true`, `"incremental": true`. `npx tsc --noEmit --incremental false` exits 0 with no output at the planned-at commit. (`--incremental false` avoids writing `tsconfig.tsbuildinfo`.)
- `vitest.config.ts` — node environment, includes `src/**/*.test.ts`. Tests run in "demo mode" (no `DATABASE_URL` needed): 28 files, 196 tests, ~2s.
- `src/lib/env.ts:26-49` — all env vars are optional in the zod schema, so `npm run build` currently succeeds with no env vars set. **Note**: plan `002-fail-closed-production-env.md` will later make production builds require `NEXTAUTH_SECRET`; the workflow you write here already sets a dummy value so that plan doesn't break CI.
- Repo conventions: commit messages are short imperative sentences (e.g. `Add Streamer.bot C# scripts panel to admin` — see `git log --oneline -10`).

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Install   | `npm ci`                                  | exit 0              |
| Lint      | `npm run lint`                            | exit 0              |
| Typecheck | `npm run typecheck` (created in step 1)   | exit 0, no output   |
| Tests     | `npm test`                                | 196+ tests pass     |
| Build     | `npm run build`                           | exit 0              |

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (add one script)
- `.github/workflows/ci.yml` (create)

**Out of scope** (do NOT touch):
- `.github/workflows/bootstrap-backlog.yml` — unrelated issue-seeding workflow.
- `tsconfig.json` — typecheck passes today; no config changes needed.
- Any source file under `src/`, `bridge/`, `scripts/` — if typecheck or tests fail on unmodified code, that's a STOP condition, not something to fix here.

## Git workflow

- Branch: `improve/001-ci-verification-baseline` (branch from up-to-date `master` per AGENTS.md).
- Commit style: short imperative sentence, e.g. `Add CI workflow and typecheck script`.
- Do NOT push or open a PR unless the operator instructed it. If a PR is opened, its body must include `Closes #<issue>` for this plan's issue (see Status block).

## Steps

### Step 1: Add the typecheck script

In `package.json`, add to `"scripts"` (next to `"lint"`):

```json
"typecheck": "tsc --noEmit --incremental false"
```

**Verify**: `npm run typecheck` → exit 0, no output.

### Step 2: Create the CI workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
        env:
          # Dummy value for build only — see plan 002 (production fails closed
          # without NEXTAUTH_SECRET). Never used to serve traffic.
          NEXTAUTH_SECRET: ci-build-only-dummy-secret
```

**Verify**: `node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); console.log(y.includes('npm run typecheck') && y.includes('npm run build') ? 'OK' : 'MISSING STEPS')"` → `OK`.

### Step 3: Run the full local equivalent of the workflow

Run, in order: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

**Verify**: all four exit 0; `npm test` reports 196+ passing tests.

## Test plan

No new unit tests — this plan adds infrastructure. The verification is step 3 (the exact commands CI will run, run locally) plus the first CI run on GitHub once a PR is opened (reviewer responsibility; see Maintenance notes).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 with 196+ tests passing
- [ ] `npm run build` exits 0
- [ ] `.github/workflows/ci.yml` exists and contains the five run steps (`npm ci`, lint, typecheck, test, build)
- [ ] `git status` shows no modified files outside `package.json` and `.github/workflows/ci.yml`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run typecheck` fails on unmodified code (the codebase drifted from the green baseline verified at `06f0792`).
- `npm test` or `npm run build` fails on unmodified code.
- You feel the need to modify `tsconfig.json` or any file under `src/` to make a gate pass.

## Maintenance notes

- The workflow only proves itself on GitHub: after the PR is opened, confirm the `CI` check appears and passes (`gh pr checks`). If `actions/setup-node` cache restore misbehaves, the fallback is removing the `cache: npm` line.
- Plan 002 depends on the `NEXTAUTH_SECRET` env line in the build step — do not remove it.
- Consider branch protection on `master` requiring the `verify` job once the workflow has run green at least once (user decision, not part of this plan).
