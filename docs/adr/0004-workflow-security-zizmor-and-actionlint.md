# ADR 0004: Workflow security via zizmor and checksum-verified actionlint

## Status

Accepted

## Context

GitHub Actions workflows in org repos need static analysis for supply-chain and permission mistakes.
Private repos cannot assume every GitHub Advanced Security feature is available without cost.

Related: [issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60),
org reusable workflow
[osloer-industries/.github#6](https://github.com/osloer-industries/.github/issues/6).

## Decision

- Run **zizmor** in CI via **`zizmorcore/zizmor-action@v0.8.0`** (pinned semver tag on the action),
  with **`advanced-security: false`** and **fail closed** on findings.
- Run **actionlint** with a **checksum-verified** install (not “latest” curl without verification).
- Package both as a **reusable workflow** in **`osloer-industries/.github`**; consumer repos (including
  this template) call the reusable rather than forking divergent security steps.

## Consequences

- Workflow changes get consistent security gates across the fleet.
- Template `.github/workflows/` stays thin: pin org reusables and repo-specific jobs only.
- zizmor without GHAS advanced mode still catches many issues; some GHAS-only rules stay unavailable
  on private repos without upgrade.

## Alternatives considered

- **poutine / octoscan** — overlap with zizmor on workflow static analysis; not chosen as the primary
  gate to avoid duplicate maintenance and conflicting baselines.
- **OpenSSF Scorecard / StepSecurity Harden-Runner** — valuable but **paid tiers** or org settings
  often required for private repos at the desired depth; deferred in favor of zizmor + actionlint baseline.
