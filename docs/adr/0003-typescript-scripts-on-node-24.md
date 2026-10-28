# ADR 0003: Repo scripts and CI helpers are TypeScript on Node 24

## Status

Accepted

## Context

The template standardizes on Node.js 24 and strict TypeScript for application code. CI helpers
(guardrail checks, suppression counting, gate canaries, setup) must stay type-safe, testable with
Vitest, and free of a second runtime in every consumer repo.

Related: [issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60),
Node 24 native type stripping (no `--experimental-strip-types` in scripts).

## Decision

- Implement **repo scripts and CI helpers in TypeScript** (under `scripts/**/*.ts`), executed with
  **Node 24** using native type stripping (`node scripts/foo.ts`).
- Keep existing **`.mjs`** entrypoints where they are the stable CLI surface (`setup.mjs`,
  `run-npm.mjs`, `lint-sonarjs.mjs`); new testable logic prefers TypeScript modules imported or
  spawned from those entrypoints.
- Do **not** introduce **Python** (or other runtimes) for template-local automation.

## Consequences

- One toolchain (`npm run check`, Vitest coverage) covers scripts and `src/`.
- Agents and contributors use the same strict TS rules on harness code.
- Shell-only one-liners remain acceptable for workflow glue; non-trivial logic belongs in TS.

## Alternatives considered

- **Python helpers** — rejected; adds runtime and dependency management outside the Node template
  contract.
- **JavaScript without types** — rejected for new helpers; loses typecheck and Oxlint type-aware
  coverage on harness code.
