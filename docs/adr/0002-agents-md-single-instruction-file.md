# ADR 0002: AGENTS.md is the single agent-instruction file

## Status

Accepted

## Context

Agent tools (Claude Code, Cursor, Codex, and others) each historically expected a
vendor-specific markdown file. Duplicating the same operational guidance in multiple
files drifts quickly and breaks the template’s provider-neutral goal.

[Claude Code memory documentation](https://code.claude.com/docs/en/memory) states that Claude Code
reads **`CLAUDE.md`**, not `AGENTS.md`. Cursor and Codex read `AGENTS.md`. A prior draft of this
ADR claimed Claude Code read `AGENTS.md` natively; that was incorrect.

Related planning: [issue #41](https://github.com/osloer-industries/typescript-node-template/issues/41),
[issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60),
[issue #87](https://github.com/osloer-industries/typescript-node-template/issues/87).
Implementation PR [#65](https://github.com/osloer-industries/typescript-node-template/pull/65)
(symlink / one-line `CLAUDE.md` import) was **not** merged.

## Decision

- **`AGENTS.md`** at the repository root is the **only** canonical agent-instruction file in this
  template and in repositories generated from it.
- Do **not** add or maintain `CLAUDE.md`, `.claude/CLAUDE.md`, `.cursorrules`, or other vendor
  copies of the same content.
- **Claude Code is unsupported** for loading repository instructions in generated repos: sessions
  will not automatically load `AGENTS.md`. Contributors using Claude Code must read `AGENTS.md`
  manually or use another supported agent (Cursor, Codex, Cloud Agents).
- **`npm run check`** fails if `CLAUDE.md` or `.claude/CLAUDE.md` is tracked in git (see
  `scripts/check-no-claude-md.ts`), because Claude Code `/init` can reintroduce those files in one
  step.

## Consequences

- One place to update verification ladders, change recipes, and harness rules.
- Template-sync and agents always target `AGENTS.md`; no symlink or merge drift.
- Claude Code users do not get automatic in-repo memory; that trade-off preserves a single
  provider-neutral file and avoids vendor instruction sprawl.
- A SessionStart hook in an org Claude Code plugin (option B in [issue #87](https://github.com/osloer-industries/typescript-node-template/issues/87))
  may inject `AGENTS.md` where the plugin is installed; that lives outside this template.

## Alternatives considered

- **`CLAUDE.md` symlink or `@AGENTS.md` import** — rejected (11 Nov 2026); duplicates or fronts the
  same content and invites drift ([#65](https://github.com/osloer-industries/typescript-node-template/pull/65)
  closed without merge).
- **Claude Code plugin SessionStart hook** — optional fleet path; not part of the template repo
  (see [issue #47](https://github.com/osloer-industries/typescript-node-template/issues/47)).
- **Parallel vendor files** — rejected; duplicates content and violates neutrality in `AGENTS.md`
  header policy.
