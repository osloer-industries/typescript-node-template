# ADR 0002: AGENTS.md is the single agent-instruction file

## Status

Accepted

## Context

Agent tools (Claude Code, Cursor, Codex, and others) each historically expected a
vendor-specific markdown file. Duplicating the same operational guidance in multiple
files drifts quickly and breaks the template’s provider-neutral goal.

Related planning: [issue #41](https://github.com/osloer-industries/typescript-node-template/issues/41),
[issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60).
Implementation PR [#65](https://github.com/osloer-industries/typescript-node-template/pull/65)
(symlink approach) was **not** merged.

## Decision

- **`AGENTS.md`** at the repository root is the **only** canonical agent-instruction file.
- Do **not** add or maintain `CLAUDE.md`, `.cursorrules`, or other vendor copies of the same
  content. Claude Code reads `AGENTS.md` natively.

## Consequences

- One place to update verification ladders, change recipes, and harness rules.
- Template-sync and agents always target `AGENTS.md`; no symlink or merge drift.
- Vendor-specific UX must consume `AGENTS.md` as-is or via their own discovery, not a forked
  copy in this repo.

## Alternatives considered

- **`CLAUDE.md` symlink to `AGENTS.md`** — rejected; owner decision to rely on native
  `AGENTS.md` support instead ([#65](https://github.com/osloer-industries/typescript-node-template/pull/65)
  closed without merge).
- **Parallel vendor files** — rejected; duplicates content and violates neutrality in `AGENTS.md`
  header policy.
