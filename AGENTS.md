<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Encoding Safety

- Avoid round-tripping UTF-8 source files through PowerShell `Get-Content` / `Set-Content`, especially for `.ts`, `.tsx`, `.md`, and Portuguese copy with accents. On this machine that can turn `você` into `vocÃª` and `à` into `Ã `.
- Prefer `apply_patch` for manual edits. For scripted rewrites, use .NET file APIs with explicit UTF-8 read/write settings instead of `Get-Content` / `Set-Content`.

## Brazilian Portuguese Copy

- Public-facing copy in Portuguese must use correct Brazilian Portuguese accents and spelling. Do not intentionally omit accents in UI text, metadata, validation messages, seeds, demo data, or documentation meant for users.
- Before finishing changes that add or edit Portuguese copy, review the touched text for missing accents and common words such as `indicação`, `indicações`, `você`, `página`, `conteúdo`, `índole`, `análise`, `inspirações`, `comunidade`, `prioridade`, `visível`, `próprio`, `inválido`, `sugestão`, and `recomendação`.
- If a file already contains mojibake such as `IndicaÃ§Ãµes`, `vocÃª`, or `Ã¡`, fix the affected copy instead of copying the corrupted text forward.
- When using `apply_patch`, write Portuguese copy with the intended accents directly in the patch and verify the rendered page or relevant source after editing.

# Website Voice (No Self-Reference)

The website must never refer to itself or describe its own interface, and it is not selling or promoting itself to the user.

- Write user-facing copy about the viewer, the streamer, and what happens in the live — never about the site, its pages, panels, dashboards, navigation, or how it compares to other tools or interfaces.
- Avoid self-referential or self-marketing phrasing such as `sem atravessar um painel cheio de números`, `a página inicial mostra...`, or `o que move a página`. Speak directly to the viewer and the live experience instead.

# No Eyebrow / Kicker Labels

Never add eyebrow (kicker) labels above headings — the small mono, uppercase, letter-spaced line that sits above a section title (for example `PIPETZ`, `CAMPANHA ATUAL`, `CAMINHOS PRINCIPAIS`, `APOSTA ABERTA`). Let headings stand on their own.

# GitHub PR Linking

When creating a GitHub PR, explicitly state which issue it closes in the PR description so GitHub links it automatically.
Put the closing keyword in the PR description/body, not just in a comment.

Use one of these formats:
- `Closes #123`
- `Fixes #123`
- `Resolves #123`
- `Closes owner/repo#123` for an issue in another repository

If a PR closes multiple issues, repeat the keyword for each issue, for example: `Closes #123, closes #456`.

GitHub documents that automatic linking/closing keywords are interpreted when the PR targets the repository's default branch.

# Streamer.bot Integration

This platform is integrated with Streamer.bot, and many features may depend on Streamer.bot actions, triggers, variables, or other configuration.

When working on features that touch this integration, agents should:
- Assume Streamer.bot configuration may be required for the feature to work correctly.
- Check the up-to-date Streamer.bot documentation before giving setup instructions, because Streamer.bot behavior and configuration steps may change over time.
- Guide the user on the required Streamer.bot setup so the application and Streamer.bot are configured to work together correctly.

# Branch Hygiene

Before creating a new branch, always update the local code from the remote base branch first, usually `master` or the repository default branch, so the branch starts from the latest state.
