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
5. After the first green runs, add required checks using the job names from the org
   [workflow table](https://github.com/osloer-industries/.github/blob/main/docs/consuming-workflows.md#available-reusables).
   When the caller is a job on `CI`, the check name is `workflow-security / Workflow security` (reusable workflow
   name + job name).

## Cross-repo `workflow-security` (org fix required at `43cd5bb`)

At commit `43cd5bb5596d8f80c73537bd3dab29b4d8a95ade`, the org `workflow-security.yml` reusable resolves
`github.workflow_ref` to the **caller** workflow when invoked via `workflow_call`, so its support checkout
fetches `validate-zizmor-thresholds.ts` from the consumer repo instead of `osloer-industries/.github`.
The job fails with `MODULE_NOT_FOUND` before actionlint or zizmor run.

**Fix (org `.github`, not a template workaround):** check out `osloer-industries/.github` at
`${{ github.workflow_sha }}` instead of parsing `github.workflow_ref`. Re-pin every consumer `uses:` ref after
that merge.

Until that org fix lands, workflow-security callers will fail even when `actions: read` is granted on the caller
workflow and job.

## Callers in this template

| Caller file | Org reusable | Notes |
| --- | --- | --- |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`workflow-security` job) | `workflow-security.yml` | actionlint + zizmor; caller workflow and job need `actions: read` (zizmor online audits); default empty `min-severity` / `min-confidence` (strictest). |
| [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml) | `codeql-javascript-typescript.yml` | Public repo: default Code Scanning upload. Private repos without GHAS: set `code-scanning-upload: false` and keep `fail-on-sarif-level: error` (see org doc). |

Other workflows (CI quality, setup smoke, dependency review, Sonar, release, PR title) may still be inlined
in this template until they are migrated; fleet-wide copies belong in org `.github` per
[ADR 0005](adr/0005-placement-template-vs-org-github.md).

## Private repository CodeQL

Do not enable paid GitHub Advanced Security for CodeQL alone. Use artifact mode from the org doc:

```yaml
jobs:
  analyze:
    uses: osloer-industries/.github/.github/workflows/codeql-javascript-typescript.yml@REUSABLES_SHA
    with:
      code-scanning-upload: false
      fail-on-sarif-level: error
```

Download the `codeql-sarif-*` artifact when triaging findings.
