# ADR 0007: Gate canary self-tests alongside CI lint

## Status

Accepted

## Context

`npm run lint` and `npm run lint:sonarjs` prove the **current tree** is clean. They do not prove that
a disabled rule or broken toolchain would still reject **planted** anti-patterns. Early gate tests also
false-passed when any subprocess throw or “no files matched” was treated as success.

Related: [issue #44](https://github.com/osloer-industries/typescript-node-template/issues/44),
[issue #75](https://github.com/osloer-industries/typescript-node-template/issues/75),
PR [#74](https://github.com/osloer-industries/typescript-node-template/pull/74) (canary harness, **merged** on `main`),
PR [#77](https://github.com/osloer-industries/typescript-node-template/pull/77) (`no-empty` + gap docs;
replaces auto-closed #76).

## Decision

- Maintain **`scripts/gate-self.test.ts`** with **per-rule canaries**: run Oxlint or SonarJS ESLint on
  a **small synthetic file**, assert **exit status 1** and output containing the **expected rule id**
  (for example `typescript/no-explicit-any`, `sonarjs/no-trivial-assertions`, `no-empty`).
- Include a **negative control**: when lint exits **0**, the canary assertion must **fail** (proving the
  harness does not treat “no findings” as a successful rejection).
- SonarJS canaries use paths under **`scripts/gate-self-*`** so ESLint’s `files` globs and TypeScript
  project service see the probe (not a temp dir outside the repo).
- Do **not** re-run full-repo `npm run lint` inside canaries; CI already does that.
- Document the **comment-only catch** gap: `catch { /* comment */ }` is not flagged by Oxlint `no-empty`
  or SonarJS `no-ignored-exceptions` in our stack; fix by handling or rethrowing.

## Consequences

- Regressions that turn off a rule or break ESLint invocation are caught even when the repo stays clean.
- Tests stay fast and focused; duplication with CI lint is intentional (different proof obligation).
- Remaining swallow patterns rely on review and `AGENTS.md` until a stock rule covers them.

## Alternatives considered

- **CI lint only** — rejected; does not detect “rule switched off but tree still clean”.
- **Custom ESLint plugin for comment-only catch** — rejected for now; documented gap instead (see PR #77).
