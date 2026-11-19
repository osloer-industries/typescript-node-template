---
name: pr-ready
description: Confirm a branch is ready for review using the pull request template checklist, full npm run check, and fleet-adoption rules when harness files change.
---

# Pull request ready for review

Use this skill before marking a pull request ready or asking for human review.

## Checklist (from [.github/pull_request_template.md](../../../.github/pull_request_template.md))

- [ ] Behavior matches the linked issue; tests cover success, failure, and boundary cases
  where relevant.
- [ ] Public exports, CLI behavior, plugin interfaces, or MCP tools are documented when changed.
- [ ] **Fleet adoption:** harness changes update
  [docs/fleet-adoption.md](../../../docs/fleet-adoption.md); consuming repos have a linked PR or
  issue (or documented exception).
- [ ] **`npm run check`** completed locally (includes `lint:md` and `lint:md-links`).
- [ ] **`npm audit --omit=dev`** when `package.json` or `package-lock.json` changed.
- [ ] **`scripts/setup.test.ts`** exercised when `scripts/setup-lib.mjs` profiles changed.
- [ ] Documentation updated when behavior changed.
- [ ] No secrets, credentials, or generated files committed.

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
