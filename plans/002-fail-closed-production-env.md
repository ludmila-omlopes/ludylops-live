# Plan 002: Fail closed in production when auth-critical env vars are missing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 06f0792..HEAD -- src/lib/env.ts src/lib/api.ts .github/workflows/ci.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (the change makes misconfigured deploys fail loudly instead of silently insecure)
- **Depends on**: plans/001-ci-verification-baseline.md (CI build step must set a dummy `NEXTAUTH_SECRET`)
- **Category**: security
- **Planned at**: commit `06f0792`, 2026-06-11
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/137

## Why this matters

Two fail-open behaviors combine into a severe misconfiguration trap:

1. If `NEXTAUTH_SECRET` is unset in a production deploy, the app signs session tokens with the **hardcoded, public** string `"pipetz-production-demo-secret"` (`src/lib/env.ts:63-64`). Anyone who reads this repo can forge a valid session for any email.
2. If `DATABASE_URL` is unset, the app enters demo mode — and `requireAdminApiSession()` then grants **admin to every logged-in user** without checking `ADMIN_EMAILS` (`src/lib/api.ts:36-38`). This applies in production too.

Today the only safeguard is a `console.warn` (`src/lib/env.ts:71-76`). Combined, a deploy that loses its env vars (new Vercel project, renamed variable, fork) silently becomes fully compromisable: forge a session with the known secret, and demo mode makes you admin. The fix: production refuses to start without `NEXTAUTH_SECRET`, and the demo-mode admin bypass never applies in production. Demo mode itself (in-memory data for local dev) stays untouched outside production.

## Current state

- `src/lib/env.ts:52` — `export const isProduction = process.env.NODE_ENV === "production";`
- `src/lib/env.ts:61-64`:

```ts
export const isDemoMode = !env.DATABASE_URL;
export const isDemoAuthEnabled = isDemoMode;
export const authSecret =
  env.NEXTAUTH_SECRET ?? (isProduction ? "pipetz-production-demo-secret" : "dev-secret");
```

- `src/lib/env.ts:66-76` — builds `missingProductionEnv` from `DATABASE_URL` / `NEXTAUTH_SECRET` and only `console.warn`s, "so the app can still build and boot".
- `src/lib/api.ts:31-44`:

```ts
export async function requireAdminApiSession() {
  const session = await requireApiSession();
  if (!session?.user?.email) {
    return null;
  }
  if (isDemoMode) {
    return session;
  }

  if (!adminEmails.has(session.user.email.toLowerCase())) {
    return null;
  }
  return session;
}
```

- `src/lib/api.ts:4` — already imports from `@/lib/env`: `import { adminEmails, isDemoMode } from "@/lib/env";`
- `authSecret` is consumed in `src/auth.ts` (NextAuth config). No change needed there.
- Existing test exemplars: `src/lib/api-session.test.ts` and `src/lib/api.test.ts` mock `@/lib/env` and `@/auth` with `vi.mock` — follow their structure. `src/lib/db/repository.test.ts:12-14` shows the env-mock shape: `vi.mock("@/lib/env", () => ({ isDemoMode: false, adminEmails: new Set([...]) }))`.
- CI workflow `.github/workflows/ci.yml` (created by plan 001) already passes `NEXTAUTH_SECRET: ci-build-only-dummy-secret` to the build step. `next build` runs with `NODE_ENV=production` and imports `env.ts`, so without that env line the build would fail after this plan lands.

Repo conventions: TypeScript strict; error messages and UI copy in Brazilian Portuguese where user-facing, but boot/config errors are developer-facing and may be English (match existing `[env]`-prefixed messages in `src/lib/env.ts:17-19`). Per AGENTS.md, never round-trip these files through PowerShell `Get-Content`/`Set-Content` (mojibake risk).

## Commands you will need

| Purpose   | Command                | Expected on success |
|-----------|------------------------|---------------------|
| Typecheck | `npm run typecheck`    | exit 0              |
| Tests     | `npm test`             | all pass (196+ plus new) |
| Lint      | `npm run lint`         | exit 0              |
| Build     | `NEXTAUTH_SECRET=dummy npm run build` (PowerShell: `$env:NEXTAUTH_SECRET="dummy"; npm run build`) | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `src/lib/env.ts`
- `src/lib/api.ts`
- `src/lib/env.test.ts` (create)
- `src/lib/api.test.ts` (extend if admin-session tests live here; otherwise extend `src/lib/api-session.test.ts`)
- `README.md` (one short note in the deploy checklist section, lines ~208-214)

**Out of scope** (do NOT touch):
- `src/auth.ts` — consumes `authSecret` unchanged.
- `.github/workflows/ci.yml` — plan 001 already set the dummy secret; only verify it's there.
- Demo-mode behavior outside production (local dev with no `DATABASE_URL` must keep working exactly as today, including demo admin access).
- The `STREAMERBOT_SHARED_SECRET` / `BRIDGE_SHARED_SECRET` optionality — signed-request verification already fails closed when the secret is unset (`src/lib/streamerbot/security.ts:33-35` returns `false`).

## Steps

### Step 1: Make `authSecret` fail closed in production

In `src/lib/env.ts`, replace the `authSecret` declaration (lines 63-64) with logic that, when `isProduction && !env.NEXTAUTH_SECRET`, **throws** an `Error` at module load:

```ts
if (isProduction && !env.NEXTAUTH_SECRET) {
  throw new Error(
    "[env] NEXTAUTH_SECRET is required in production. " +
      "Set it in the deployment environment before starting the app.",
  );
}

export const authSecret = env.NEXTAUTH_SECRET ?? "dev-secret";
```

Remove `NEXTAUTH_SECRET` from the `missingProductionEnv` warn list (it can no longer be missing in production); keep the `DATABASE_URL` warning.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Disable the demo-mode admin bypass in production

In `src/lib/api.ts`, import `isProduction` from `@/lib/env` and change the bypass:

```ts
if (isDemoMode && !isProduction) {
  return session;
}
```

In production demo mode, admin access now requires an `ADMIN_EMAILS` match like everywhere else.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Write tests

Create `src/lib/env.test.ts`. Because `env.ts` does its work at module load, each case must `vi.resetModules()`, stub env vars (`vi.stubEnv`), then `await import("@/lib/env")`:

- production (`NODE_ENV=production`) + no `NEXTAUTH_SECRET` → import rejects/throws with a message containing `NEXTAUTH_SECRET`.
- production + `NEXTAUTH_SECRET=abc` → `authSecret === "abc"`.
- non-production + no secret → `authSecret === "dev-secret"` (no throw).

Use `vi.unstubAllEnvs()` in `afterEach`. Stub `DATABASE_URL` to undefined/empty in all three cases so no DB is touched.

Extend the admin-session tests (whichever of `src/lib/api.test.ts` / `src/lib/api-session.test.ts` covers `requireAdminApiSession` — check both; if neither does, add to `src/lib/api.test.ts`): with the env mock set to `isDemoMode: true, isProduction: true, adminEmails: new Set()`, a logged-in non-admin gets `null`; with `isProduction: false`, the same user gets the session (today's demo behavior preserved).

**Verify**: `npm test` → all pass, including the new cases.

### Step 4: Update the README deploy checklist

In the "Checklist de deploy para Google OAuth" section (README.md ~lines 208-214), add one bullet stating that production deploys now refuse to boot without `NEXTAUTH_SECRET` (write it in Portuguese, accents correct, e.g. "Em produção, o app não inicia sem `NEXTAUTH_SECRET` configurado.").

**Verify**: `npm run lint` → exit 0.

### Step 5: Full verification including a production build

Run `npm run lint`, `npm run typecheck`, `npm test`, then a build with the secret set (PowerShell: `$env:NEXTAUTH_SECRET="dummy"; npm run build`). Optionally confirm the failure mode: a build with `NEXTAUTH_SECRET` removed should fail with the step-1 error message.

**Verify**: all gates exit 0 with the secret set; build without it fails with the `[env] NEXTAUTH_SECRET is required` message.

## Test plan

- `src/lib/env.test.ts` (new): the three cases in step 3. Model the resetModules/stubEnv pattern on any existing test that mocks env; keep each test independent.
- Admin bypass tests: production+demo denies non-admin; dev+demo allows (regression guard for local dev).
- Verification: `npm test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0; new env + admin-bypass tests exist and pass
- [ ] `grep -n "pipetz-production-demo-secret" src/lib/env.ts` returns no matches
- [ ] `grep -n "isDemoMode && !isProduction" src/lib/api.ts` returns a match
- [ ] Build with `NEXTAUTH_SECRET` set exits 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `src/lib/env.ts:61-76` or `src/lib/api.ts:31-44` doesn't match the excerpts above.
- `.github/workflows/ci.yml` does not exist or lacks the `NEXTAUTH_SECRET` build env (plan 001 not done — this plan's build gate would break CI).
- The production build fails for a reason other than the intentional missing-secret error.
- You discover other module-load-time consumers that crash in dev/test because of the new throw (the throw must be reachable only when `NODE_ENV === "production"`).

## Maintenance notes

- Vercel preview deployments run with `NODE_ENV=production`; they must have `NEXTAUTH_SECRET` configured (production deploys already should). If previews start failing to boot after this lands, that's the plan working as intended — set the variable in the Vercel project for preview scope.
- Reviewer should scrutinize: that demo mode in local dev (no `DATABASE_URL`, `NODE_ENV !== "production"`) still grants demo admin — the streamer uses this for visual development.
- Deferred (deliberately): requiring `DATABASE_URL` in production. Demo mode in production becomes read-only-ish and non-privileged after this plan, which is an acceptable failure mode; hard-requiring the DB would break intentional demo deploys.
