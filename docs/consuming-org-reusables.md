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
6. After the first green runs, require a **single** branch protection check: **`ci-passed`** with GitHub check
   context **`ci-passed / ci-passed`** (job `name:` on the org reusable called from
   [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)). Do not list individual scanner jobs as required—the
   aggregate job already fails when any upstream job fails or is cancelled.
7. Enable **Allow auto-merge** on the repository (**Settings > General > Pull Requests**) and restrict
   merge methods to **squash** only so Dependabot and Release Please squash commits match Conventional Commit
   prefixes (`chore(deps):`, `ci(deps):`) enforced by the PR title workflow.
8. Configure org **auto-merge** credentials: repository (or organization) secret **`RELEASE_APP_PRIVATE_KEY`**
   (PEM for the osloer-reviewer GitHub App) and repository variable **`OSLOER_RELEASE_APP_ID`** = **`5745328`**.
   Mirror **`RELEASE_APP_PRIVATE_KEY`** into **Dependabot secrets** so workflows on `dependabot/*` branches can
   mint the installation token. Copy [`.github/workflows/auto-merge.yml`](../.github/workflows/auto-merge.yml)
   from this template (org reusable pin **`# v0.1.7`**).

### Auto-merge behavior (org reusable)

The org [`auto-merge.yml`](https://github.com/osloer-industries/.github/blob/v0.1.7/.github/workflows/auto-merge.yml)
approves and enables **`gh pr merge --auto`** (merge completes only after required checks pass). It does **not**
use `pull_request_target` and does not check out pull request code.

| Source | Auto-merges when | Never auto-merges |
| --- | --- | --- |
| **Dependabot** | `version-update:semver-patch` or `version-update:semver-minor` (including grouped `osloer-reusables` patch/minor bumps) | **semver-major** dependency updates |
| **Release Please** (`release-please--*` branches, osloer-reviewer) | Manifest diff is patch/minor only, allowlisted files, no `BREAKING CHANGE` / `⚠ BREAKING CHANGES` in PR body or changelog | Major manifest bumps, breaking markers, or unparseable manifest (fail closed). Pre-1.0 breaking changes bump **minor** and stay manual |

Auto-merge waits for branch protection required checks. Register only **`ci-passed / ci-passed`** as required—not
individual scanner jobs—so Dependabot and release PRs merge once the aggregate pipeline is green.

Pin every org reusable to the same `.github` release tag commit SHA (for example
`0bf1af4007d3e4c1037fadd7e2fbf1970564d4d5 # v0.1.9`); use the tag in the `#` comment, not `main`, so
zizmor ref-version-mismatch stays green when org `main` advances. Bump via Dependabot (`osloer-reusables`
group) or template-sync when a new `.github` tag ships. For the composite gate, use an inline `ci-passed` job
with `ci-passed-gate@<pin-sha>` (static SHA). Org reusables resolve vendored scripts from `job.workflow_sha`
(the pinned `uses:` ref).

Grant **job-level** `actions: read` on the workflow-security calling job (not at workflow level; Sonar rule
`githubactions:S8264`).

## Callers in this template

| Caller file | Org reusable | Notes |
| --- | --- | --- |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`ci-paths-scope` job) | `ci-paths-scope.yml` | Docs-only skip + `workflows-changed` outputs; gates heavy jobs ([#170](https://github.com/osloer-industries/typescript-node-template/issues/170)). |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`workflow-security` job) | `workflow-security.yml` | actionlint + zizmor when `workflows-changed` is true; **job**-level `actions: read` (zizmor online audits). |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`codeql` job) | `codeql-javascript-typescript.yml` | **`push` / `schedule` / `merge_group` only** on PR workflows (not every `pull_request` synchronize). Public repo: default Code Scanning upload. Private: artifact mode (org doc). |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`sonar-analyze` job) | `sonarqube-cloud-node.yml` | `npm run coverage:sonar` (`run-sonar-coverage.mjs` installs nested `packages/eslint-sonarjs` via `ci-npm-workspace.mjs` after the reusable’s root `npm ci`, then `test:coverage`); requires `SONAR_TOKEN`. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`quality` job) | `node-npm-quality.yml` | `precommit` via org package-manager ([#114](https://github.com/osloer-industries/typescript-node-template/pull/114)); `fetch-depth: 0`; `pr-pre-check-script: scripts/check-guardrail-changes.ts`; `npm-prefixes-json` for `packages/eslint-sonarjs`. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`mutation` job) | `mutation-changed.yml` | Thin caller; script runs from org pin at `job.workflow_sha`. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`setup-smoke` job) | `node-setup-smoke.yml` | Default four-scenario matrix. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`journey-e2e` job) | *(in-repo)* | Black-box `npm run test:e2e` for the template setup journey ([#129](https://github.com/osloer-industries/typescript-node-template/pull/129)); replace in generated repos. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`sonar-zero-open-issues` job) | `sonarcloud-zero-issues.yml` | Pull requests only (`if: github.event_name == 'pull_request'`); `ce-task-id` from `sonar-analyze`. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`ci-passed` job) | `ci-passed-gate` composite action | Aggregate gate via `.github/actions/ci-passed-gate` (no nested `workflow_call`); `needs:` every upstream job. Tolerates selective skips (Sonar off-PR, CodeQL off-PR, workflow-security, docs-only). |
| [`dependency-review.yml`](../.github/workflows/dependency-review.yml) | `dependency-review.yml` | Job-level `contents` / `actions` / `pull-requests` read and `security-events: write` (nested OSV reusable). |
| [`pr-title.yml`](../.github/workflows/pr-title.yml) | `semantic-pull-request.yml` | `pull_request` types `opened` / `reopened` / `edited` only (not `synchronize`); `concurrency` on caller; job-level `pull-requests: read`. |
| [`release.yml`](../.github/workflows/release.yml) | `release-please.yml` | Release GitHub App secrets (see org doc). |
| [`.github/workflows/auto-merge.yml`](../.github/workflows/auto-merge.yml) | `auto-merge.yml` (`# v0.1.9`) | `RELEASE_APP_PRIVATE_KEY`, `vars.OSLOER_RELEASE_APP_ID` (`5745328` in this org); squash merge; `allow-dependabot` + `allow-release-prs`. |

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
