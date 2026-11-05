# ADR 0008: CodeQL on private repositories

## Status

Proposed — awaiting Thomas

## Context

CodeQL is attractive for JavaScript/TypeScript security analysis in GitHub Actions. This template and
many org repos are **private**. The CodeQL CLI license
([github/codeql-cli-binaries LICENSE.md](https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md))
permits CI use on **open-source** codebases; **private repos without GitHub Advanced Security (GHAS)**
are not covered for CLI-driven CI the same way.

Related: [osloer-industries/.github#5](https://github.com/osloer-industries/.github/issues/5),
[issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60).

## Decision

**No decision yet.** Thomas to choose among the options below for private fleet repos.

## Consequences

(Depends on chosen option.)

- **CodeQL in CI on private repos without GHAS** — likely **license-incompatible** for CLI-based runs;
  do not enable until legal/tooling path is confirmed.
- **SonarCloud-only or Semgrep CE** — may satisfy “static security in CI” without CodeQL CLI on private
  code.
- **Paid GitHub Code Security / GHAS** — enables GitHub-hosted CodeQL features on private repos at cost.

## Alternatives considered

| Option | Notes |
| --- | --- |
| **Semgrep CE** | Open-source friendly; good CI fit; different rule set than CodeQL. |
| **Paid GitHub Code Security (GHAS)** | Native CodeQL on private repos; cost and org enablement required. |
| **SonarCloud only** | Already part of template quality gate; complements but does not replace CodeQL semantics. |
| **CodeQL on public forks only** | Partial; does not secure private monorepos by itself. |
