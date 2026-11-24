# ADR 0012: Blocking guardrail change check in CI (not branch rulesets)

## Status

Accepted

## Context

Phase 3 hardening requires harness edits (lint config, workflows, `AGENTS.md`, suppression tooling)
to be **visible and blocking** before merge. Issue [#48](https://github.com/osloer-industries/typescript-node-template/issues/48)
introduced `CODEOWNERS` and a CI **notice** that always exited 0 ([#67](https://github.com/osloer-industries/typescript-node-template/pull/67)).
Issue [#89](https://github.com/osloer-industries/typescript-node-template/issues/89) makes that check
fail closed when approval is missing.

We deliberately **do not** rely on GitHub branch protection or rulesets for this guarantee: repo settings
vary across the fleet, Advanced Security features are out of scope, and the template must enforce behavior
in **checked-in code** that template-sync can propagate.

Related: [issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60) (plan),
[ADR 0005](0005-placement-template-vs-org-github.md) (guardrail script stays in the template).

## Decision

- **`CODEOWNERS`** names the real maintainer **`@tn819`** (Thomas) for all harness paths listed there.
- **`guardrail-detect`** runs **`scripts/check-guardrail-changes.ts`** on pull requests. It **never fails
  the workflow on its own**; it writes **`guardrail_changed=true|false`** to `GITHUB_OUTPUT` and logs
  which harness paths changed.
- **`harness-approval`** always runs after **`guardrail-detect`** succeeds. When **`guardrail_changed`** is
  **`false`**, the job uses **no** deployment environment and a waiver step exits **`success`**. When **`true`**, the
  job uses Environment **`harness-approval`** at job level (required reviewer **`@tn819`**, admin bypass disabled)
  and stays **waiting** until Thomas uses **Review deployments** on the PR checks (including GitHub mobile) and
  taps **Approve**. A **new push** requires a **fresh** deployment approval for the new commit SHA.
- The aggregate org **`ci-passed.yml`** job **`needs`** every CI job, including **`harness-approval`** and
  **`guardrail-detect`**. **Rejected**, **cancelled**, or **failed** deployment reviews block merge; skipped
  **`harness-approval`** is not used (org gate fails closed on skipped upstream jobs).
- **Dependabot** Action SHA bumps under `.github/**` still require maintainer **deployment approval**
  (the bot is not the environment reviewer).
- Protected paths match the hardening list: `AGENTS.md`, `.oxlintrc.json`, `vitest.config.ts`,
  `tsconfig*.json`, `lefthook.yml`, `.github/**`, `scripts/suppression-baseline.json`,
  `scripts/count-suppressions.ts`, `scripts/gate-self.test.ts`, `packages/eslint-sonarjs/**`, plus
  `CODEOWNERS`, `scripts/check-guardrail-changes.ts`, and `scripts/agent-hooks/` (in-loop sensors share
  the same path list).
- **`scripts/gate-self.test.ts`** includes a canary proving the detector **reports** harness diffs without
  exiting non-zero and **passes** for non-guardrail diffs.

We **do not** enable “require CODEOWNERS review” branch protection in this change; the workflow plus
environment gate is the enforcement mechanism documented here and in `CONTRIBUTING.md`.

## Consequences

- Harness PRs block **`ci-passed`** until the **`harness-approval`** deployment is approved; this includes
  template hardening PRs.
- Pull request workflows no longer subscribe to **`labeled`** / **`unlabeled`** events for guardrails.
- Fleet repos should copy the script, `CODEOWNERS`, workflow jobs, the `harness-approval` environment, and
  this ADR during template-sync.
- Org-wide reusable `guardrail-changes.yml` remains optional ([ADR 0005](0005-placement-template-vs-org-github.md));
  this repo implements the policy inline until a shared reusable is agreed.

## Alternatives considered

- **Branch protection / rulesets requiring CODEOWNERS review** — rejected for this template change:
  settings are not versioned, differ per repo, and were explicitly out of scope for the agent task.
- **Notice-only (exit 0)** — rejected; [#89](https://github.com/osloer-industries/typescript-node-template/issues/89).
- **`harness-change` label plus issue timeline verification** — superseded; labels and `issues: read`
  permissions were brittle (bot-applied labels, self-approval on maintainer PRs). Environment deployment
  approval is the supported maintainer control.
