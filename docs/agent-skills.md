# Shared agent skills

Cross-tool skills live under [`.agents/skills/`](../.agents/skills/) as `SKILL.md` files
([Agent Skills](https://agentskills.io) format). They are the only committed agent path besides
[AGENTS.md](../AGENTS.md) ([ADR 0010](adr/0010-agent-and-local-files-not-committed.md)).

## Who loads skills

| Client | Behavior |
| --- | --- |
| **Cursor** and **Codex** | Read `.agents/skills/` directly. |
| **Claude Code** | Loads project skills from `.claude/skills/`. This template does **not** commit that folder — [vakt](https://github.com/osloer-industries/vakt) generates a local symlink bridge (uncommitted) per org decision. |
| **Claude Code `AGENTS.md`** | Version 2.1.277+ reads `AGENTS.md` when no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` exists at or above the repo. A personal `CLAUDE.local.md` switches `AGENTS.md` off — do not add one to the template. |

## Skill index in AGENTS.md

The **Skills** section in [AGENTS.md](../AGENTS.md) (between `<!-- agents:skills:begin -->` and
`<!-- agents:skills:end -->`) is generated. After adding or renaming a skill, run:

```sh
npm run agents:index
```

`npm run agents:check` fails when the index is stale, when frontmatter is invalid, when cited paths or
`npm run` scripts inside a skill do not resolve, or when an executable file appears under a skill
directory (skills are instruction-only until a separate executable policy exists).

## Adding a skill

1. Create `.agents/skills/<name>/SKILL.md` with YAML frontmatter:
   - `name` must equal `<name>` (lowercase letters, digits, hyphens only; ≤ 64 characters).
   - `description` must be non-empty (≤ 1024 characters).
2. Keep instructions **provider-neutral**. Link to `AGENTS.md` and `docs/` instead of copying long ladders.
3. Cite repository paths and `npm run` scripts with backticks or Markdown links so `agents:check` can verify them.
4. Run `npm run agents:index`, then `npm run agents:check` and `npm run lint:md`.

## Content rules (security)

Skills are instructions agents execute with repository and tool access. Treat them like code:

- No `curl | sh`, downloading and executing remote scripts, or instructions to read secrets, tokens, or `.env` files.
- No third-party skill imports from marketplaces in the template harness (maintainers vet additions via CODEOWNERS on `.agents/`).
- No executable files inside skill directories until an explicit policy allows them.

See also [docs/agent-guard-hooks.md](agent-guard-hooks.md) for in-loop guard hooks on guardrail paths.

## Platform references

Portable format and conventions for skills in this repo:

- [Agent Skills specification](https://agentskills.io/specification) (frontmatter `name` / `description`)
- [Cursor skills](https://cursor.com/docs/skills) (reads `.agents/skills/` directly)
- [Claude Code skills](https://code.claude.com/docs/en/skills) (project skills; this template uses
  vakt’s local bridge per the table above — do not commit `.claude/skills/` copies)
