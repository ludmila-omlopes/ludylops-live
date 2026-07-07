# Plan 007: Public landing page for the creator platform beta at `/criar-area`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat aa9104c..HEAD -- "src/app/(viewer)/criar-area" src/lib/creators src/components/creator-area-create-form.tsx README.md`
> Then confirm these files EXIST (they were untracked when this plan was
> written and must have been committed since):
> `src/lib/creators/access.ts`, `src/app/(viewer)/criar-area/page.tsx`,
> `src/components/creator-area-create-form.tsx`.
> If any is missing, or the "Current state" excerpts below don't match the
> live code, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: the white-label foundation work (branch `codex/overlay-style-selector` working tree at the time of writing) being committed and merged — see drift check. No dependency on plans 001–006 (all DONE).
- **Category**: direction
- **Planned at**: commit `aa9104c` (working tree incl. uncommitted white-label files), 2026-07-07
- **Issue**: https://github.com/ludmila-omlopes/ludylops-live/issues/169

## Why this matters

The platform can now create white-label creator areas (multi-tenant instances with their own subdomain, branding and modules), gated to a closed beta via an admin-managed email allowlist. But the entry point is invisible: `/criar-area` requires login and returns a 404 to anyone not on the allowlist, and nothing anywhere explains what the product is. A creator who hears about the beta has no page to visit, and an approved creator sees a bare form with no context. This plan turns `/criar-area` into a public landing page that pitches the platform (under a placeholder name — the final name is not decided yet), with a CTA to create your own area, while keeping creation itself restricted to approved emails.

## Current state

Relevant files and their roles:

- `src/app/(viewer)/criar-area/page.tsx` — the page to rewrite. Today it forces login and 404s non-approved users:

  ```tsx
  // src/app/(viewer)/criar-area/page.tsx:9-14
  export default async function CreateCreatorAreaPage() {
    const session = await requireSession();
    const isAllowed = await canCreateCreatorArea(session.user!.email);
    if (!isAllowed) {
      notFound();
    }
  ```

  When allowed, it renders a heading, the owner's existing areas (`listCreatorAreasForOwner(session.user!.activeViewerId)`) and `<CreatorAreaCreateForm />`.

- `src/lib/creators/access.ts` — the beta gate. **Do not modify.** It is already complete and enforced everywhere that matters:

  ```ts
  // src/lib/creators/access.ts:120-132
  export async function canCreateCreatorArea(email: string | null | undefined) {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return false;
    }
    if (adminEmails.has(normalizedEmail)) {
      return true;
    }
    const settings = await getCreatorAreaAccessSettings();
    return settings.allowedEmails.includes(normalizedEmail);
  }
  ```

  The API routes `GET/POST /api/me/creator-area` (`src/app/api/me/creator-area/route.ts:16,32`) also call `canCreateCreatorArea` and return 403 — server-side enforcement does not depend on the page, so making the page public is safe.

- `src/lib/auth/session.ts:6-12` — `requireSession()` **redirects to `/`** when there is no session. That is why the page must switch to the nullable `auth()` helper (imported as `import { auth } from "@/auth";` — see `src/app/page.tsx:16` for the exemplar) to stay public.

- `src/components/auth-buttons.tsx:46-48` — the repo's Google sign-in pattern for client components:

  ```tsx
  const handleGoogleSignIn = () => {
    void signIn("google", { callbackUrl: "/" }, GOOGLE_AUTHORIZATION_PARAMS);
  };
  ```

  `GOOGLE_AUTHORIZATION_PARAMS` comes from `@/lib/auth/google`. In demo mode (no `DATABASE_URL`) a `credentials` provider also exists; `auth-buttons.tsx:44` detects it via `getProviders()`. Model the new CTA component on this file.

- `src/components/creator-area-create-form.tsx` — the existing client form that POSTs to `/api/me/creator-area` and redirects to `/c/{slug}` on success. Reuse as-is; do not modify.

- `README.md:171` — stale route description: `- \`/criar-area\`: redireciona para \`/owner\`.` (it does not redirect; it renders the creation page). Update it as part of this plan.

Design conventions to match (visible throughout `src/app/(viewer)/criar-area/page.tsx` and `src/app/page.tsx`):

- Headings: `style={{ fontFamily: "var(--font-display)" }}`, `uppercase`.
- Cards/panels: `border-[3px] border-[var(--color-ink)] bg-[var(--color-paper)] shadow-[6px_6px_0_var(--shadow-color)]`.
- Soft text: `text-[var(--color-ink-soft)]`; accent colors via `var(--color-mint)`, `var(--color-pink)`, `var(--color-blue)`, `var(--color-purple)`.
- Icon + card step lists: see `PIPETZ_STEPS` in `src/app/page.tsx:56-82`.

Copy rules (from `AGENTS.md`, mandatory):

- Brazilian Portuguese with correct accents (`você`, `área`, `conteúdo`, `própria`...). Never omit accents; never copy mojibake forward.
- **No eyebrow/kicker labels** above headings (no small uppercase mono line like `CAMPANHA ATUAL`).
- Although this page pitches the platform to creators (which is its explicit purpose), write the copy about outcomes for the creator and their community — viewers earning points during the live, betting on outcomes, redemptions that trigger effects on stream — not about panels, dashboards or navigation.

## Commands you will need

Verified on the working tree this plan was written against (39 test files / 289 tests passing):

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Install   | `npm install`      | exit 0              |
| Lint      | `npm run lint`     | exit 0              |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors   |
| Tests     | `npm test`         | all pass (≥289)     |
| Build     | `npm run build`    | exit 0              |

Note: this is Next.js 16 — before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (per `AGENTS.md`). On Windows, do not round-trip source files through PowerShell `Get-Content`/`Set-Content` (mojibake risk for Portuguese copy).

## Scope

**In scope** (the only files you should modify or create):

- `src/lib/creators/platform.ts` (create)
- `src/lib/creators/platform.test.ts` (create)
- `src/components/creator-landing-cta.tsx` (create)
- `src/app/(viewer)/criar-area/page.tsx` (rewrite)
- `README.md` (only the `/criar-area` route line and, if desired, one sentence in the "Áreas de criadores" section)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/creators/access.ts`, `src/lib/creators/access.test.ts` — the beta gate is done and tested.
- `src/app/api/me/creator-area/route.ts` and anything under `src/app/api/` — server guards stay exactly as they are.
- `src/app/(viewer)/owner/page.tsx` and `/api/owner/**` — the platform-owner console is a different audience (the operator), not the creator landing.
- `src/components/app-chrome.tsx` — no new nav links in this plan.
- `src/components/creator-area-create-form.tsx` — reuse, don't edit.
- Auth configuration (`src/auth*`, `src/lib/auth/**`).
- Any waitlist/request-access persistence — non-approved users just see a notice (deferred, see Maintenance notes).
- Choosing the real platform name — the placeholder is the deliverable.

## Git workflow

- Branch from the repo default branch: `codex/007-creator-landing-page` (repo convention is `codex/<slug>`; update local `master` from remote first, per `AGENTS.md`).
- Short imperative commit messages, matching `git log` style (e.g. `add selectable OBS overlay styles`). One commit per step or logical unit is fine.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the platform-name constant and landing-state helper

Create `src/lib/creators/platform.ts`:

```ts
// Nome provisório da plataforma white label. O nome definitivo ainda não foi
// decidido: quando for, trocar apenas esta constante.
export const PLATFORM_NAME = "[nome da plataforma]";

export type CreatorLandingState = "visitor" | "closed_beta" | "approved";

export function resolveCreatorLandingState(input: {
  hasUsableSession: boolean;
  canCreateArea: boolean;
}): CreatorLandingState {
  if (!input.hasUsableSession) {
    return "visitor";
  }
  return input.canCreateArea ? "approved" : "closed_beta";
}
```

The placeholder value is intentionally bracketed so it is impossible to mistake for a final name; every place the name appears must render this constant, never a hardcoded string.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Test the landing-state helper

Create `src/lib/creators/platform.test.ts` (Vitest; model the structure on `src/lib/creators/access.test.ts` — plain `describe`/`it`/`expect`, no DOM). Cover:

1. no session → `"visitor"` (regardless of `canCreateArea`),
2. session + not allowed → `"closed_beta"`,
3. session + allowed → `"approved"`.

**Verify**: `npm test -- platform` → the new tests pass.

### Step 3: Create the sign-in CTA client component

Create `src/components/creator-landing-cta.tsx`, a `"use client"` component modeled on `src/components/auth-buttons.tsx`:

- Uses `getProviders`/`signIn` from `next-auth/react` and `GOOGLE_AUTHORIZATION_PARAMS` from `@/lib/auth/google`.
- Primary button (repo `Button` component from `@/components/ui/button`, `variant="accent"`) with a CTA label such as `Criar a minha área` that calls `signIn("google", { callbackUrl: "/criar-area" }, GOOGLE_AUTHORIZATION_PARAMS)`.
- If the `credentials` provider exists (demo mode), render the demo-login variant the same way `auth-buttons.tsx:58-66` does, also with `callbackUrl: "/criar-area"`.
- No eyebrow labels; Portuguese copy with correct accents.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Rewrite `/criar-area` as the public landing page

Rewrite `src/app/(viewer)/criar-area/page.tsx`:

1. Replace `requireSession()` with `auth()` (`import { auth } from "@/auth";`). Remove the `notFound()` import and call.
2. Compute the state:
   ```tsx
   const session = await auth();
   const hasUsableSession = Boolean(session?.user?.email && session.user.activeViewerId);
   const canCreateArea = hasUsableSession ? await canCreateCreatorArea(session!.user!.email) : false;
   const landingState = resolveCreatorLandingState({ hasUsableSession, canCreateArea });
   ```
   (A session without `activeViewerId` is treated as `visitor` — same usability bar `requireSession` applies.)
3. Add page metadata using the constant:
   ```tsx
   export const metadata = { title: `${PLATFORM_NAME} — crie a área da sua comunidade` };
   ```
4. Render, for **all** states, a landing pitch above the fold:
   - Hero: headline about the creator's community having its own place during the live (e.g. `Sua live, sua área, sua comunidade.`), one paragraph naming `{PLATFORM_NAME}` as the platform in beta, no eyebrow label.
   - A "what your community gets" section with 3–4 cards in the `PIPETZ_STEPS` visual pattern (`src/app/page.tsx:56-82`): viewers acumulam pontos assistindo, apostam em bolões durante o jogo, resgatam efeitos que aparecem na live, tudo com a identidade do criador no próprio endereço (`{slug}.ludylops.live`).
5. Render the state-specific block after/beside the pitch:
   - `visitor` → `<CreatorLandingCta />` plus one line saying creation is in closed beta (`beta fechado`).
   - `closed_beta` → a bordered notice card: heading like `Beta fechado`, body explaining novas áreas estão em beta fechado e o acesso é liberado por convite para o email da conta Google usada no login; mention which email is logged in (`session.user.email`) so the creator knows which address to ask to have approved. No form, no 404.
   - `approved` → the existing behavior: `Suas áreas` list (`listCreatorAreasForOwner(session.user!.activeViewerId)`) and `<CreatorAreaCreateForm />` in the bordered panel, as the current page does (keep those excerpts' styling).
6. Every mention of the platform name renders `PLATFORM_NAME` — grep your own diff for a hardcoded bracket string.

**Verify**: `npm run lint` → exit 0; `npx tsc --noEmit` → exit 0.

**Verify (behavior, demo mode)**: run `npm run dev` without `DATABASE_URL` and open `http://localhost:3000/criar-area` logged out → the pitch and CTA render (no redirect to `/`). Stop the dev server afterwards.

### Step 5: Update README route description

In `README.md`, change the route line (currently line 171):

```
- `/criar-area`: redireciona para `/owner`.
```

to describe reality, e.g.:

```
- `/criar-area`: landing pública da plataforma white label, com criação de área para emails aprovados no beta.
```

**Verify**: `Select-String -Path README.md -Pattern "criar-area"` shows only the new text.

### Step 6: Full verification

Run the complete gate: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

**Verify**: all exit 0; test count ≥ 292 (289 baseline + 3 new).

## Test plan

- New file `src/lib/creators/platform.test.ts` covering the three landing states (see Step 2), modeled on `src/lib/creators/access.test.ts`.
- No page-level React tests — the repo has no component-test setup for server pages; the demo-mode manual check in Step 4 covers rendering.
- Verification: `npm test` → all pass, including the 3 new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0 with ≥292 tests; `platform.test.ts` exists and passes
- [ ] `npm run build` exits 0
- [ ] `Select-String -Path "src/app/(viewer)/criar-area/page.tsx" -Pattern "notFound|requireSession"` → no matches
- [ ] `Select-String -Path "src/app/(viewer)/criar-area/page.tsx","src/components/creator-landing-cta.tsx" -Pattern "\[nome da plataforma\]"` → no matches (the name only ever comes from `PLATFORM_NAME`)
- [ ] `git diff --stat` (vs. base) touches only the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/lib/creators/access.ts` or `src/app/(viewer)/criar-area/page.tsx` does not exist — the white-label foundation this plan builds on was never committed/merged. Report which files are missing.
- The current `criar-area/page.tsx` no longer matches the excerpt in "Current state" (someone already reworked the page).
- Making the CTA work appears to require changing auth configuration or session helpers (out of scope) — report what's blocking instead of touching them.
- Portuguese copy renders with mojibake (`vocÃª`, `Ã¡rea`) after your edits — stop and report your write method rather than committing corrupted text.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Renaming the platform** (the whole point of the placeholder): change `PLATFORM_NAME` in `src/lib/creators/platform.ts` and re-grep the repo for the old bracket string; also revisit the page `metadata.title`.
- **Waitlist**: the `closed_beta` state is a dead end by design (the operator approves emails manually in Admin → Comunidade → Beta áreas). If demand grows, a follow-up can persist "quero participar" requests — that would need a new table/API and was deliberately deferred.
- **Reviewer focus**: Portuguese accents in all new copy; no eyebrow labels; confirm logged-out `/criar-area` does not redirect; confirm a non-approved logged-in user sees the notice (not a 404) but still gets 403 from `POST /api/me/creator-area` if they try the API directly.
- The `.ludylops.live` suffix is hardcoded in `creator-area-create-form.tsx:123` and mirrored by `DEFAULT_CREATOR_DOMAIN` in `src/lib/creators/defaults.ts:8`; if the platform later gets its own apex domain, both move together.
