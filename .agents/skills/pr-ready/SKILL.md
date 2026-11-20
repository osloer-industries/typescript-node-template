---
name: pr-ready
description: Before review — use Lefthook pre-commit without bypass, run npm run check, keep ci-passed green on the PR head, and follow the pull request template.
---

# Pull request ready for review

Before marking a pull request ready or asking for human review.

## Pre-commit (never skip)

After `npm ci`, run **`npm run prepare`** once so Lefthook installs ([`lefthook.yml`](../../../lefthook.yml);
see [AGENTS.md](../../../AGENTS.md)). Commit with hooks enabled — **do not** use `git commit --no-verify`
or other bypasses.

While editing, use [verify-change](../verify-change/SKILL.md) (`npm run check:fast`).

## Local verification and CI

1. Run **`npm run check`** locally, then push.
2. **`ci-passed`** must be green on the **latest head commit** before review
   ([`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml); branch protection).
3. If CI fails, fix the root cause and push again. Do not mark the PR ready while checks are red.

Provider stop hooks may run `check:fast` before an agent ends a turn — see
[docs/agent-guard-hooks.md](../../../docs/agent-guard-hooks.md).

## Checklist and title

Complete [.github/pull_request_template.md](../../../.github/pull_request_template.md). Use a
Conventional Commit PR title (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `ci:`).
Keep the diff focused; link issues with `Closes #…` when appropriate. Guardrail-path changes need
CODEOWNERS / `harness-approval` review ([AGENTS.md](../../../AGENTS.md)).

## Skills and conventions

- [verify-change](../verify-change/SKILL.md) — verification ladder and reading gate failures.
- [write-adr](../write-adr/SKILL.md) — record harness decisions in `docs/adr/`.
- [docs/agent-skills.md](../../../docs/agent-skills.md) — shared skill layout, `agents:check`, and
  platform docs aligned with this repo ([Agent Skills spec](https://agentskills.io/specification),
  [Cursor skills](https://cursor.com/docs/skills), [Claude Code skills](https://code.claude.com/docs/en/skills)).

When adding or renaming skills under `.agents/skills/`, run **`npm run agents:index`** so the
**Skills** table in [AGENTS.md](../../../AGENTS.md) stays current (`agents:check` fails on a stale index).
