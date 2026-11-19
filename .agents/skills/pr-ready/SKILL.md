---
name: pr-ready
description: Confirm a branch is ready for review using Lefthook pre-commit, local npm run check, green ci-passed on the PR head, and the pull request template checklist.
---

# Pull request ready for review

Use this skill before marking a pull request ready or asking for human review.

## Pre-commit (never skip)

1. After `npm ci`, run **`npm run prepare`** once so Lefthook hooks install
   ([`lefthook.yml`](../../../lefthook.yml) — see [AGENTS.md](../../../AGENTS.md)).
2. Commit with hooks enabled; **do not** use `git commit --no-verify` or other bypasses to skip
   pre-commit.
3. While editing, prefer **`npm run check:fast`**; see [verify-change](../verify-change/SKILL.md).

## CI before ready-for-review

1. Run **`npm run check`** locally, then push.
2. Every pull request must show green **`ci-passed`** on the **latest head commit** before review
   (branch protection; full ladder in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)).
3. If CI fails, fix the root cause and push again. Do not mark the PR ready while checks are red.

Provider stop hooks may also run `check:fast` before an agent ends a turn — see
[docs/agent-guard-hooks.md](../../../docs/agent-guard-hooks.md).

## Checklist (from [.github/pull_request_template.md](../../../.github/pull_request_template.md))

- [ ] Behavior matches the linked issue; tests cover success, failure, and boundary cases
  where relevant.
- [ ] Public exports, CLI behavior, plugin interfaces, or MCP tools are documented when changed.
- [ ] **Fleet adoption:** harness changes update
  [docs/fleet-adoption.md](../../../docs/fleet-adoption.md); consuming repos have a linked PR or
  issue (or documented exception).
- [ ] **`npm run check`** completed locally (includes `lint:md`, `lint:md-links`, and `agents:check`).
- [ ] **`ci-passed`** green on the PR head commit (not only local verification).
- [ ] **`npm audit --omit=dev`** when `package.json` or `package-lock.json` changed.
- [ ] **`scripts/setup.test.ts`** exercised when `scripts/setup-lib.mjs` profiles changed.
- [ ] Documentation updated when behavior changed.
- [ ] No secrets, credentials, or generated files committed.

## Skills and conventions

Shared repo skills (use with this checklist):

- [verify-change](../verify-change/SKILL.md) — verification ladder and reading gate failures.
- [write-adr](../write-adr/SKILL.md) — record harness decisions in `docs/adr/`.

Layout, security rules, and **`agents:check`** validation (every `.agents/skills/<name>/SKILL.md`
must exist, frontmatter must match `<name>`, citations must resolve, index must be current):
[docs/agent-skills.md](../../../docs/agent-skills.md).

Portable skill file format:
[Agent Skills specification](https://agentskills.io/specification).

## Title and scope

- Use a Conventional Commit PR title (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`,
  `ci:`).
- Keep the diff focused; link issues with `Closes #…` when appropriate.
- If guardrail paths changed (`.agents/`, workflows, CODEOWNERS, lint harness), expect CODEOWNERS /
  `harness-approval` review — see [AGENTS.md](../../../AGENTS.md).

## Skills index

When adding or editing skills under `.agents/skills/`, run **`npm run agents:index`** so the
**Skills** table in [AGENTS.md](../../../AGENTS.md) stays in sync (`agents:check` fails on a stale
index).
