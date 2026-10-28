# ADR 0005: CI reusables in org `.github`, repo-shaped config in the template

## Status

Accepted

## Context

Osloer Industries maintains many repositories from one TypeScript Node template. CI logic that is
identical everywhere should not be copy-pasted; repo-specific layout, tests, and agent instructions
must remain in each consumer.

Related: [issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60),
[osloer-industries/.github](https://github.com/osloer-industries/.github) reusables and
**template-sync** PRs.

## Decision

- **Shared CI logic** (security scanning reusables, common job patterns) lives in
  **`osloer-industries/.github`** as callable workflows/actions.
- **Repo-shaped artifacts** stay in the **template** (and each consumer): `.github/workflows` wiring,
  `scripts/`, tests, `AGENTS.md`, `docs/`, Oxlint/SonarJS config, Vitest thresholds.
- **template-sync** realigns consumers when org reusables or template harness change; ADRs and
  `AGENTS.md` document intentional divergences.

## Consequences

- Template PRs focus on behavior and tests; fleet-wide CI policy updates land in `.github` once.
- Consumers must pin reusable refs (SHA or semver) per org policy; Dependabot/ template-sync handle
  drift.
- Agents should read `AGENTS.md` and ADRs for “what lives here” vs “what lives in org `.github`”.

## Alternatives considered

- **Monolithic template workflows only** — rejected; duplicates security and quality jobs across repos
  and fights org-wide policy updates.
- **Everything in org `.github` only** — rejected; loses repo-specific setup scenarios, MCP contract
  tests, and coverage thresholds tied to this codebase.
