# Fleet adoption

Deterministic map of [org reusable workflows](https://github.com/osloer-industries/.github/blob/main/docs/consuming-workflows.md)
and template harness features across consuming repositories.

**Verification date:** 2026-11-16 (default branches; files and workflow YAML on GitHub).

## Reusable pin snapshot

| Repository | Org `.github` pin (comment) | Notes |
| --- | --- | --- |
| typescript-node-template | `d1fd7700ad30c0bafbe1d0e4b1eac1fbbb4137b3` (`# v0.1.2`) | Template reference |
| lunch-money-de-invest-sync | `a081e1b87b5309ff2b3999e8d6804d8ebec5c518` (`# v0.1.1`) | Mixed with v0.1.2 CodeQL pin on some fleet repos |
| vakt | `d1fd7700ad30c0bafbe1d0e4b1eac1fbbb4137b3` (`# v0.1.2`) | Partial caller set |
| homeexchange-mcp | `d1fd7700ad30c0bafbe1d0e4b1eac1fbbb4137b3` (`# v0.1.2`) | Partial caller set |
| tn819/expat-finance-hub | `a081e1b87b5309ff2b3999e8d6804d8ebec5c518` (`# v0.1.1`) | See ADR in that repo |
| lunch-money | *unverified* | This agent token cannot read the repository (HTTP 404) |
| coast-fire-visualizer | *none* | Inlined CI; no org `uses:` on `main` |
| markdown-link-check | *none* | Legacy Actions; default branch `master` |
| osloer-industries/.github | *publisher* | Defines reusables; dogfoods unit/e2e CI only |

Cell legend: **adopted** · **partial** · **not adopted** · **n/a**. Each cell is
`state` — caveat — tracking link (`not adopted, no tracking issue` when none exists).

## Adoption matrix

| Feature | typescript-node-template | lunch-money | lunch-money-de-invest-sync | vakt | homeexchange-mcp | coast-fire-visualizer | markdown-link-check | `.github` | expat-finance-hub |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| workflow-security.yml | adopted — in `ci.yml` — [#128](https://github.com/osloer-industries/typescript-node-template/pull/128) | not adopted, no tracking issue | adopted — `ci.yml` — not adopted, no tracking issue | adopted — `ci.yml` | adopted — `ci.yml` | not adopted, no tracking issue | not adopted, no tracking issue | n/a — publishes reusable | adopted — `ci.yml` |
| codeql-javascript-typescript.yml | adopted — `ci.yml`; public upload — [#128](https://github.com/osloer-industries/typescript-node-template/pull/128) | not adopted, no tracking issue | adopted — artifact mode `code-scanning-upload: false` — not adopted, no tracking issue | adopted — `codeql.yml` | adopted — `codeql.yml` | partial — inlined `codeql-action`, `upload: false` — not adopted, no tracking issue | not adopted, no tracking issue | n/a | partial — read `codeql.yml` (org reusable present) |
| node-npm-quality.yml | partial — inlined Quality job runs `npm run check` — not adopted, no tracking issue | not adopted, no tracking issue | adopted — `ci.yml` | not adopted — Bun build job — not adopted, no tracking issue | partial — inlined `npm run check` in `ci.yml` — not adopted, no tracking issue | partial — inlined lint/typecheck/coverage — not adopted, no tracking issue | not adopted, no tracking issue | n/a | adopted — `ci.yml` |
| mutation-changed.yml | adopted — inlined mutation jobs + `run-mutation-changed.ts` — not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | n/a — ships reusable + unit tests | not adopted, no tracking issue |
| node-setup-smoke.yml | adopted — matrix in `ci.yml` | unverified | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | n/a | not adopted, no tracking issue |
| sonarqube-cloud-node.yml | adopted — `sonar-analyze` in `ci.yml` — [#128](https://github.com/osloer-industries/typescript-node-template/pull/128) | unverified | partial — inlined `SonarSource/sonarqube-scan-action` in `ci.yml`, not org reusable — not adopted, no tracking issue | partial — inlined scan in `ci.yml` — not adopted, no tracking issue | partial — inlined scan in `ci.yml` — not adopted, no tracking issue | partial — optional token inlined `sonar.yml` — not adopted, no tracking issue | not adopted, no tracking issue | n/a | adopted — `sonar.yml` reusable |
| sonarcloud-zero-issues.yml + ci-passed PR-only contract | **partial — broken on `push`** — see [§ Sonar zero-open + ci-passed](#sonar-zero-open-issues-and-ci-passed) — [#128](https://github.com/osloer-industries/typescript-node-template/pull/128) | unverified | partial — PR-only `sonar.yml`, not in `ci-passed` — not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | n/a — script enforces `pull_request` only | partial — `if: pull_request` on job; no `ci-passed` yet — not adopted, no tracking issue |
| ci-passed.yml | adopted — listed in `ci.yml`; **fails `main` push until Sonar row fixed** — [#128](https://github.com/osloer-industries/typescript-node-template/pull/128) | unverified — expected in [PR #23](https://github.com/osloer-industries/lunch-money/pull/23) | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | partial — inlined gate in org `ci.yml` | not adopted, no tracking issue |
| semantic-pull-request.yml | partial — `amannn/action-semantic-pull-request` in `pr-title.yml`, not org reusable — not adopted, no tracking issue | unverified | adopted — `pr-title.yml` | not adopted, no tracking issue | partial — `amannn` in `pr-title.yml` — not adopted, no tracking issue | partial — `amannn` in `pr-title.yml` — not adopted, no tracking issue | not adopted, no tracking issue | n/a | adopted — `semantic-pull-request.yml` |
| dependency-review.yml | partial — `dependency-review-action` inlined, not org reusable — not adopted, no tracking issue | unverified | **n/a** — GHAS-free `dependency-diff-audit.mjs` gate (keep local) | adopted — org reusable `dependency-review.yml` | partial — marketplace action in caller | not adopted, no tracking issue | not adopted, no tracking issue | n/a | adopted — org reusable (verify on `main`) |
| release-please.yml | adopted — `release.yml` org reusable | unverified | adopted — `release.yml` org reusable | partial — verify `release.yml` — not adopted, no tracking issue | partial — `googleapis/release-please-action`, not org reusable — not adopted, no tracking issue | partial — verify `release.yml` — not adopted, no tracking issue | partial — release-on-tag/npm publish, not Release Please — not adopted, no tracking issue | adopted — in-repo `release-please.yml` | adopted — `release-please.yml` org reusable |
| auto-merge.yml | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | adopted — `auto-merge-caller.yml` | not adopted, no tracking issue |
| Dependabot (`osloer-reusables`) | adopted — `.github/dependabot.yml` | unverified | adopted — present on `main` | not adopted, no tracking issue | adopted — present | partial — `.github/dependabot.yml` | not adopted, no tracking issue | adopted | not adopted, no tracking issue |
| lefthook + `npm run prepare` | adopted — `lefthook.yml` | unverified | adopted — `lefthook.yml` | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue |
| jscpd (`lint:dup`) | adopted — `.jscpd.json` | unverified | adopted — `.jscpd.json` | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue | not adopted, no tracking issue |
| e2e / domain CI | n/a — setup smoke only | unverified | partial — macOS + TZ matrix jobs | adopted — `docker-e2e` in `ci.yml` | not adopted, no tracking issue | not adopted, no tracking issue | partial — integration CLI smoke in `ci.yml` | n/a | not adopted, no tracking issue |

## Sonar zero-open-issues and ci-passed

The org script `sonarcloud-zero-issues.ts` **exits with error unless `github.event_name` is
`pull_request`** (it needs `pull_request.number` and head SHA). Callers must therefore:

1. Run the `sonarcloud-zero-issues.yml` job only on pull requests (`if: github.event_name == 'pull_request'`
   on the job, and/or a dedicated workflow with `on: pull_request` only).
2. List that job under `ci-passed` `needs:` only when the aggregate gate treats a **skipped** PR-only
   upstream job as success on `push` to `main` (today `ci-passed-gate.ts` allows **`success` only** at
   `d1fd7700…` / v0.1.2).

| Repository | PR-only zero-open gate | In `ci-passed` needs | `push` to `main` safe | Tracking |
| --- | --- | --- | --- | --- |
| typescript-node-template | **no** — job runs on `push` | yes | **no** — job fails; `ci-passed` fails — [#128](https://github.com/osloer-industries/typescript-node-template/pull/128) merged 2026-11-16 | Fix in separate PR (not open in this repo at verification); **not adopted, no tracking issue** for push fix |
| lunch-money-de-invest-sync | yes — `sonar.yml` `on: pull_request` only | no | yes (no aggregate) | not adopted, no tracking issue |
| tn819/expat-finance-hub | yes — `if: github.event_name == 'pull_request'` on job | no | yes (no aggregate yet) | not adopted, no tracking issue |
| vakt | n/a — no zero-open job | no | yes | not adopted, no tracking issue |
| homeexchange-mcp | n/a | no | yes | not adopted, no tracking issue |
| coast-fire-visualizer | n/a | no | yes | not adopted, no tracking issue |
| lunch-money | unverified | unverified | unverified | Blocked on [PR #23](https://github.com/osloer-industries/lunch-money/pull/23) per maintainer |

## Maintainer rules

When you add or change a template feature or an org reusable in this repository:

1. Update the matching row in this file (state, pin, caveat, links).
2. Open or reference a PR/issue in **each** consuming repository that should adopt the change.
3. Record those links in the table column for that repo.

CI enforces step 1 on pull requests: workflow or composite-action edits require
`docs/fleet-adoption.md` in the same diff (`scripts/check-fleet-adoption-doc.ts`).

Regenerate a blank matrix for manual passes: `node scripts/print-fleet-adoption-matrix.ts`.
