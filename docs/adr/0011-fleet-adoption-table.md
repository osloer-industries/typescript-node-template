# ADR 0011: Fleet adoption table and workflow sync gate

## Status

Accepted

## Context

Org reusable workflows and template harness features roll out across a fixed set of consuming
repositories. Without a single checked-in map, drift (pin skew, missing gates, PR-only jobs wired
into push-triggered `ci-passed`) is discovered only when CI breaks on `main`.

## Decision

1. Maintain **`docs/fleet-adoption.md`** as the source of truth for adoption state, pins, caveats,
   and links to implementing PRs or issues in each consuming repo.
2. Require every change to **`.github/workflows/**`** or **`.github/actions/**`** in this template to
   update `docs/fleet-adoption.md` in the same pull request, enforced by
   `scripts/check-fleet-adoption-doc.ts` in CI (`fleet-adoption-doc` job, listed under `ci-passed`).
3. When adding or changing a template feature or org reusable, open or reference tracking work in
   each consuming repo and record links in the table.
4. Optional helper: `scripts/print-fleet-adoption-matrix.ts` prints the row/column skeleton for
   manual verification runs (markdown remains authoritative).

## Consequences

- Workflow PRs carry an explicit fleet impact note.
- Guardrail path list includes `scripts/check-fleet-adoption-doc.ts` (CODEOWNERS / harness approval).
- `sonarcloud-zero-issues.yml` is **pull_request-only** by design; callers that list it under
  `ci-passed` on `push` must gate the job with `if: github.event_name == 'pull_request'` and ensure
  the aggregate gate treats a PR-only skip as success on `push` (see fleet-adoption Sonar row).
