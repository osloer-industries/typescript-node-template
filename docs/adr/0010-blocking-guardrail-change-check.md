# ADR 0010: Blocking guardrail change check in CI (not branch rulesets)

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
- The **Quality** job runs **`scripts/check-guardrail-changes.ts`** on pull requests. When the diff
  touches a **protected path**, the step **exits 1** unless the PR has:
  1. the **`harness-change`** label (for intentional harness work, including maintainer/agent PRs), or
  2. an **approving pull request review** from a login listed in `CODEOWNER_LOGINS` inside the script
     (today `@tn819`), fetched via the GitHub API using `GITHUB_TOKEN` with `pull-requests: read`.
- **Dependabot** pull requests that bump Action SHAs under `.github/**` have **no bypass**: a maintainer
  must **approve** the PR (or add `harness-change` when appropriate). Routine SHA bumps are expected to
  use maintainer approval only.
- Protected paths match the hardening list: `AGENTS.md`, `.oxlintrc.json`, `vitest.config.ts`,
  `tsconfig*.json`, `lefthook.yml`, `.github/**`, `scripts/suppression-baseline.json`,
  `scripts/count-suppressions.ts`, `scripts/gate-self.test.ts`, `packages/eslint-sonarjs/**`, plus
  `CODEOWNERS`, `scripts/check-guardrail-changes.ts`, and `scripts/agent-hooks/` (in-loop sensors share
  the same path list).
- **`scripts/gate-self.test.ts`** includes a canary proving the check **fails** on harness diffs without
  approval and **passes** otherwise.

We **do not** enable “require CODEOWNERS review” branch protection in this change; the script is the
enforcement mechanism documented here and in `CONTRIBUTING.md`.

## Consequences

- Harness PRs fail CI until a maintainer approves or labels them; this includes template hardening PRs.
- Workflow `permissions` must include **`pull-requests: read`** on the Quality job so review lookup works.
- Fleet repos should copy the script, `CODEOWNERS`, workflow env wiring, and ADR during template-sync.
- Org-wide reusable `guardrail-changes.yml` remains optional ([ADR 0005](0005-placement-template-vs-org-github.md));
  this repo implements the policy inline until a shared reusable is agreed.

## Alternatives considered

- **Branch protection / rulesets requiring CODEOWNERS review** — rejected for this template change:
  settings are not versioned, differ per repo, and were explicitly out of scope for the agent task.
- **Notice-only (exit 0)** — rejected; [#89](https://github.com/osloer-industries/typescript-node-template/issues/89).
- **Separate bypass label for Dependabot** — rejected; approving review is the supported path for routine
  Action SHA updates.
