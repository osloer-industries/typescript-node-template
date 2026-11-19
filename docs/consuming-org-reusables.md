# Consuming org reusable workflows

Shared GitHub Actions behavior lives in [osloer-industries/.github](https://github.com/osloer-industries/.github).
This template keeps **thin caller workflows** under `.github/workflows/` and pins each `uses:` ref to a full
commit SHA. The org contract, input defaults, and copy-paste YAML live in
[consuming-workflows.md](https://github.com/osloer-industries/.github/blob/main/docs/consuming-workflows.md)
on that repository.

## Adoption checklist for a new repository

1. Copy the caller workflows you need from this template (or from the org doc examples).
2. Replace `REUSABLES_SHA` with the same commit SHA on every `osloer-industries/.github/.github/workflows/…` line.
3. Keep **repo-shaped** config here: Release Please manifests, `sonar-project.properties`, setup smoke matrix
   inputs, guardrail scripts, and any domain-specific jobs (see [ADR 0005](adr/0005-placement-template-vs-org-github.md)).
4. Enable Dependabot `github-actions` updates on `/` so `ci(deps)` pull requests bump Action SHAs **and** org
   reusable workflow SHAs together.
5. In SonarCloud, **disable Automatic Analysis** for the project and rely on the CI `sonarqube-cloud-node.yml`
   job instead ([docs/sonar-quality-gate.md](sonar-quality-gate.md)). Enable organization secret **`SONAR_TOKEN`**.
6. After the first green runs, require a **single** branch protection check: **`ci-passed`** (job on
   [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)). Do not list individual scanner jobs as required—the
   aggregate job already fails when any upstream job fails or is cancelled.

Pin every org reusable to the same `.github` release tag commit SHA (for example
`a6ee91211fd9ba096ec141bacdb67985a82b6767 # v0.1.7`); use the tag in the `#` comment, not `main`, so
zizmor ref-version-mismatch stays green when org `main` advances. Bump via Dependabot (`osloer-reusables`
group) or template-sync when a new `.github` tag ships. Callers do not pass `reusables-ref`; reusable
workflows resolve their scripts from
`job.workflow_sha` (the pinned `uses:` ref).

Grant **job-level** `actions: read` on the workflow-security calling job (not at workflow level; Sonar rule
`githubactions:S8264`).

## Callers in this template

| Caller file | Org reusable | Notes |
| --- | --- | --- |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`workflow-security` job) | `workflow-security.yml` | actionlint + zizmor; **job**-level `actions: read` on the calling job (zizmor online audits); default empty `min-severity` / `min-confidence` (strictest). |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`codeql` job) | `codeql-javascript-typescript.yml` | Public repo: default Code Scanning upload. Private repos without GHAS: set `code-scanning-upload: false` and keep `fail-on-sarif-level: error` (see org doc). |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`sonar-analyze` job) | `sonarqube-cloud-node.yml` | `npm run coverage:sonar` (`run-sonar-coverage.mjs` installs nested `packages/eslint-sonarjs` via `ci-npm-workspace.mjs` after the reusable’s root `npm ci`, then `test:coverage`); requires `SONAR_TOKEN`. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`quality` job) | `node-npm-quality.yml` | `precommit` via org package-manager ([#114](https://github.com/osloer-industries/typescript-node-template/pull/114)); `fetch-depth: 0`; `pr-pre-check-script: scripts/check-guardrail-changes.ts`; `npm-prefixes-json` for `packages/eslint-sonarjs`. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`mutation` job) | `mutation-changed.yml` | Org `run-mutation-changed.ts` at reusables pin. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`setup-smoke` job) | `node-setup-smoke.yml` | Default four-scenario matrix. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`sonar-zero-open-issues` job) | `sonarcloud-zero-issues.yml` | Pull requests only (`if: github.event_name == 'pull_request'`); `ce-task-id` from `sonar-analyze`. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`ci-passed` job) | `ci-passed.yml` | Org aggregate gate; Sonar zero-open skip tolerated only off `pull_request`. Template [`scripts/ci-passed-gate.ts`](../scripts/ci-passed-gate.ts) still documents future `harness-approval` / `guardrail-detect` semantics until org ports them. |
| [`dependency-review.yml`](../.github/workflows/dependency-review.yml) | `dependency-review.yml` | Job-level `contents` / `actions` / `pull-requests` read and `security-events: write` (nested OSV reusable). |
| [`pr-title.yml`](../.github/workflows/pr-title.yml) | `semantic-pull-request.yml` | `pull_request` caller (not org doc `pull_request_target` — workflow-security zizmor rejects `pull_request_target` in this repo); job-level `pull-requests: read`. |
| [`release.yml`](../.github/workflows/release.yml) | `release-please.yml` | Release GitHub App secrets (see org doc). |

Domain-only jobs remain in-repo (for example `fleet-adoption-doc`, future `harness-approval`) per
[ADR 0005](adr/0005-placement-template-vs-org-github.md).

## Private repository CodeQL

Do not enable paid GitHub Advanced Security for CodeQL alone. Use artifact mode from the org doc. Under
`workflow_call` in a private repository, set workflow-level `permissions: contents: read`, and grant the
**calling job** `contents: read` plus `actions: read`. Without job-level `actions: read`, `github/codeql-action`
fails with **Resource not accessible by integration** (keep `actions: read` on the job, not at workflow
level; Sonar rule `githubactions:S8264`).

```yaml
name: CodeQL

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: codeql-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  analyze:
    permissions:
      contents: read
      actions: read
    uses: osloer-industries/.github/.github/workflows/codeql-javascript-typescript.yml@REUSABLES_SHA
    with:
      code-scanning-upload: false
      fail-on-sarif-level: error
```

Download the `codeql-sarif-*` artifact when triaging findings.
