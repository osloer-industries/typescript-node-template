# ADR 0001: Record agent-hardening decisions in ADRs

## Status

Accepted

## Context

The template is being hardened for agent-driven development (escape-hatch lint, harness
protection, MCP contract tests, fleet CI). Several choices affect the public contract of
repos created from this template (for example harness layout, hook wiring files, or CI
placement).

## Decision

- Store architecture decisions as markdown ADRs under `docs/adr/`.
- Link new ADRs from `docs/adr/README.md` and mention the process in `AGENTS.md`.
- Flag decisions that need maintainer approval in the ADR body before implementation merges.

## Consequences

- Agents and humans have a durable, reviewable log beyond issue comments.
- Template consumers can diff ADRs during template-sync PRs.
- Additional ADRs should stay small; supersede rather than silently edit accepted ADRs.
