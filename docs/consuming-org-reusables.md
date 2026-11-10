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

Pin both reusables to the same org `.github` `main` merge SHA (for example `d4865a4b2c70c8433188f5200beac104b1c7fe86`
after [osloer-industries/.github#9](https://github.com/osloer-industries/.github/pull/9)); bump via Dependabot or
template-sync when org `main` moves.

Grant **job-level** `actions: read` on the workflow-security calling job (not at workflow level; Sonar rule
`githubactions:S8264`).

## Callers in this template

| Caller file | Org reusable | Notes |
| --- | --- | --- |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`workflow-security` job) | `workflow-security.yml` | actionlint + zizmor; **job**-level `actions: read` on the calling job (zizmor online audits); default empty `min-severity` / `min-confidence` (strictest). |
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
