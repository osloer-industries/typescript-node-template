# ADR 0010: Agent and local working files are not committed

## Status

Accepted

## Context

Coding agents write session state, caches and per-tool configuration into the working tree:
`.omo/` plans and run-continuation sessions, `.codegraph` indexes, `.claude/`, `.cursor/`,
`CLAUDE.md`, `.mcp.json` and similar. In osloer-industries/lunch-money nine such files were
committed, including agent session JSON in a repository that handles financial data. Once
committed they leak local context, go stale, and steer later agents with outdated instructions.
Per-tool instruction files also conflict with [ADR 0002](0002-agents-md-single-instruction-file.md).

GitHub push rulesets that restrict file paths only exist for private and internal repositories
on the Team plan, so they cannot enforce this on the public repositories in the fleet.

Related: [issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60),
[ADR 0005](0005-placement-template-vs-org-github.md).

## Decision

- **Deny by default.** Agent and local working files are never tracked. The list (tool state
  directories, per-tool instruction and config files, `*.local.md`) is maintained in one place:
  the org reusable `agent-files-guard.yml` in `osloer-industries/.github`.
- **Enforce in CI, org-wide.** Every repository calls the reusable, pinned by SHA, and the org
  `main` ruleset requires its status check. It is language-agnostic (`git ls-files` with glob
  pathspecs), so Bun repositories are covered too.
- **Prevent locally.** The template's `.gitignore` mirrors the list so agents cannot stage these
  files by accident. `.gitignore` is a guardrail path (CODEOWNERS, guardrail-change check).
- **Explicit opt-in.** A repository commits a listed path only by naming it in
  `.github/agent-files.allow`, one glob per line with a `# reason:` comment. Lines without a
  reason fail the check. `.github/` is code-owned, so opt-ins need maintainer review.

## Consequences

- Local `CLAUDE.md`, `.claude/settings.local.json` and similar files keep working on a developer's
  machine. They just never reach the repository.
- A repository that later wants shared hook wiring (e.g. `.claude/settings.json`, issue #47) must
  opt it in explicitly, with a reason that reviewers can see.
- New agent tools need their paths added to the reusable's deny list; until then they are caught
  only by review.

## Alternatives considered

- **GitHub push rulesets (restrict file paths)** — rejected: unavailable for public repositories.
- **Allowlist every dot-prefixed path** — rejected: high friction for ordinary tool config
  (`.nvmrc`, `.editorconfig`, `.oxlintrc.json`) for little extra protection.
- **`.gitignore` only** — rejected: `git add -f` and edited ignore files bypass it silently.
