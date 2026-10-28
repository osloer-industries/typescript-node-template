# Architecture Decision Records

We document significant technical decisions as short ADRs in this folder.

## Format

Each ADR is a markdown file named `NNNN-short-title.md` with:

- **Status** — proposed, accepted, deprecated, superseded
- **Context** — what forced the decision
- **Decision** — what we chose
- **Consequences** — trade-offs and follow-ups
- **Alternatives considered** — options we rejected and why

## Index

| ADR | Title |
| --- | --- |
| [0001](0001-record-agent-hardening-decisions.md) | Record agent-hardening decisions in ADRs |
| [0002](0002-agents-md-single-instruction-file.md) | AGENTS.md is the single agent-instruction file |
| [0003](0003-typescript-scripts-on-node-24.md) | Repo scripts and CI helpers are TypeScript on Node 24 |
| [0004](0004-workflow-security-zizmor-and-actionlint.md) | Workflow security via zizmor and checksum-verified actionlint |
| [0005](0005-placement-template-vs-org-github.md) | CI reusables in org `.github`, repo-shaped config in the template |
| [0006](0006-escape-hatch-lint-and-suppression-baseline.md) | Escape-hatch lint with shrink-only suppression baseline |
| [0007](0007-gate-canary-self-tests.md) | Gate canary self-tests alongside CI lint |
| [0008](0008-codeql-on-private-repos.md) | CodeQL on private repositories |
