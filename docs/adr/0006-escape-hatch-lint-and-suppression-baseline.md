# ADR 0006: Escape-hatch lint with shrink-only suppression baseline

## Status

Accepted

## Context

Agent-driven edits often regress quality via `@ts-ignore`, blanket disables, `any`, and similar
shortcuts. We need CI-enforced Oxlint rules plus a metric that prevents **growing** suppressions over
time.

Related: [issue #42](https://github.com/osloer-industries/typescript-node-template/issues/42),
[issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60),
PR [#62](https://github.com/osloer-industries/typescript-node-template/pull/62) (escape-hatch rules, merged),
PR [#71](https://github.com/osloer-industries/typescript-node-template/pull/71) (suppression counter, **merged** on `main`).

## Decision

- Enforce **escape-hatch Oxlint rules** (for example `typescript/no-explicit-any`,
  `typescript/ban-ts-comment`, `unicorn/no-abusive-eslint-disable`) in `.oxlintrc.json`.
- Track disable/ts-directive counts in **`scripts/suppression-baseline.json`**; **`npm run lint:suppressions`**
  (`scripts/count-suppressions.ts`) allows the baseline to **shrink only**, never grow without an
  intentional baseline update in review.

## Consequences

- New suppressions fail CI until code is fixed or the baseline is deliberately lowered after cleanup.
- `AGENTS.md` documents enforced rules and points agents at shrinking the baseline, not adding disables.
- Baseline edits are harness changes and should get CODEOWNERS review when that path is enabled.

## Alternatives considered

- **Lint-only, no baseline** — rejected; agents can add one-off disables without a fleet-visible trend.
- **Grow-allowed baseline** — rejected; defeats the shrink-only policy Thomas requested for hardening.
