# Cursor agent setup (on-demand context)

This template keeps **[AGENTS.md](../AGENTS.md)** as the single **provider-neutral** instruction source. Cursor-specific files below **extend** it (scoped rules, skills, Cloud bootstrap)—they must not copy long prose from `AGENTS.md` or `docs/`.

## How Cursor loads context

| Layer | When it loads | This repo |
| --- | --- | --- |
| **AGENTS.md** | Baseline for Agent (root + nested dirs) | Always commit at root |
| **docs/** | Agent reads via links in AGENTS.md / rules | `architecture.md`, `sonar-quality-gate.md`, this file |
| **Skills** | Name + description in catalog; full `SKILL.md` when relevant or `/skill-name` | `.agents/skills/` (auto-discovered) |
| **Project rules** | By glob, “Agent decides”, or `@rule` | `.cursor/rules/*.mdc` (thin pointers only) |
| **Cloud environment** | VM bootstrap for Cloud Agents | `.cursor/environment.json` |
| **MCP / plugins** | Tool catalog at session start; tools on use | Optional `.cursor/mcp.json` or team dashboard plugins |

IDE Agent and Cloud Agents both use committed `.cursor/` and `.agents/` files. User-only settings (`~/.cursor/skills/`, user rules) apply locally unless **Sync Skills for Cloud Agents** is enabled.

## Layout shipped with this template

```text
AGENTS.md                          # Canonical map, verification, recipes
docs/
  architecture.md
  sonar-quality-gate.md
  cursor-agent-setup.md            # This file
.agents/skills/                    # Auto-discovered skills (portable path)
  sonar-quality-gate/SKILL.md
skills/                            # Same skill source (mirrors .agents/skills)
.cursor/
  environment.json                 # Cloud Agent: install + check
  rules/typescript-node.mdc        # Scoped TS/CI conventions (short)
.cursorignore                      # Extra paths Agent should not read (create locally if needed)
```

If the environment blocks committing `.cursorignore`, add it locally with at least `dist/`, `coverage/`, `node_modules/`, and `.env*`.

After `npm run setup`, nested **AGENTS.md** under `packages/*` is optional for monorepos; this starter is single-package.

## First-time setup (fork from template)

### Local IDE

1. Clone, then `npm ci` (or `npm ci --ignore-scripts` if you match CI).
2. Open the folder in Cursor; confirm **AGENTS.md** appears in project context.
3. **Cursor Settings → Rules**: review project rules under `.cursor/rules/`.
4. **Cursor Settings → Skills**: confirm `sonar-quality-gate` (from `.agents/skills/`).

### Cloud Agents

1. [Cursor → Cloud Agents](https://cursor.com/agents): link this repository.
2. Prefer a **saved environment** with install `npm ci --ignore-scripts` and verify `npm run check`, or rely on committed [`.cursor/environment.json`](../.cursor/environment.json).
3. Add secrets in the dashboard (never in git): `SONAR_TOKEN`, API keys, etc.
4. In SonarCloud, disable **Automatic Analysis** if you use the GitHub Actions Sonar workflow—see [README](../README.md#sonarqube-cloud-setup).

### Team plugins (optional)

Install org **plugins** once (rules, skills, MCP bundled) via Cursor dashboard instead of duplicating them in every repo. Repo-local `.cursor/mcp.json` is only for project-specific servers.

## Adding a new skill

1. Create `.agents/skills/{name}/SKILL.md` with YAML frontmatter (`name`, `description`).
2. Keep workflow steps in the skill; link to `docs/` for long reference.
3. Mirror under `skills/{name}/` if you want a provider-neutral copy path.
4. Add one line to **AGENTS.md** repository map if the skill is required reading.

## Adding a scoped rule

1. Add `.cursor/rules/{topic}.mdc` with frontmatter:

```yaml
---
description: When to apply this rule (Agent decides mode)
globs: "scripts/**/*.{mjs,ts}"
alwaysApply: false
---
```

Then add a short body: bullet checklist only; link `@AGENTS.md` or `@docs/sonar-quality-gate.md` instead of pasting content.

## MCP scenario (`npm run setup --scenario mcp`)

Generated projects include an MCP server stub. To wire Cursor:

1. Run setup with scenario `mcp`.
2. Add `.cursor/mcp.json` (or user MCP config) pointing at the built server command, for example stdio launch of `node dist/index.js` after `npm run build`.
3. Document tool contracts in `src/` and keep Zod boundaries—see [sonar-quality-gate.md](sonar-quality-gate.md).

## Anti-patterns

- Duplicating **AGENTS.md** in `CLAUDE.md`, `.cursorrules`, or large always-on rules.
- Committing secrets or tokens in rules, skills, or `environment.json`.
- Skills only under `skills/` with no `.agents/skills/` copy (Cursor will not auto-discover).
- Inlining entire architecture docs in rules (use links and `@` file references).

## Verification

After changing Cursor config:

```sh
npm run check
```

Documentation is checked with `npm run lint:md` (markdownlint) and `npm run lint:md-links` (relative paths + HTTP URLs).

Open a new Agent chat and ask it to follow the verification ladder in AGENTS.md; it should cite `npm run check` and linked docs without needing the whole repository in context.
