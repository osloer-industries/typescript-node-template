# Fleet adoption

Deterministic map of [org reusable workflows](https://github.com/osloer-industries/.github/blob/main/docs/consuming-workflows.md)
and template harness features across consuming repositories.

**Verification date:** 2026-11-16 (default branches; workflow YAML and config on GitHub).

## Reusable pin snapshot

| Repository | Org `.github` pin (comment) | Notes |
| --- | --- | --- |
| typescript-node-template | `348b254ef112f4f8e239a41e7adb3f3e2dac3944` (`# v0.1.6`) | Template reference |
| lunch-money | migrating via [lunch-money#23](https://github.com/osloer-industries/lunch-money/pull/23) (bun repo) — `d1fd7700ad30c0bafbe1d0e4b1eac1fbbb4137b3` (`# v0.1.2`) on PR branch | No `.github/` on `main`. [#23](https://github.com/osloer-industries/lunch-money/pull/23) (pushed, CI pending). After merge, [#13](https://github.com/osloer-industries/lunch-money/pull/13) should merge `main` only |
| lunch-money-de-invest-sync | `a081e1b87b5309ff2b3999e8d6804d8ebec5c518` (`# v0.1.1`) | |
| vakt | `d1fd7700ad30c0bafbe1d0e4b1eac1fbbb4137b3` (`# v0.1.2`) | Partial caller set |
| homeexchange-mcp | `d1fd7700ad30c0bafbe1d0e4b1eac1fbbb4137b3` (`# v0.1.2`) | Partial caller set |
| tn819/expat-finance-hub | `a081e1b87b5309ff2b3999e8d6804d8ebec5c518` (`# v0.1.1`) | |
| coast-fire-visualizer | *none* | Inlined CI; no org `uses:` on `main` |
| markdown-link-check | *none* | Legacy Actions; default branch `master` |
| osloer-industries/.github | *publisher* | Defines reusables; dogfoods unit/e2e CI only |

Cell legend: **adopted** · **partial** · **migrating** · **not adopted** · **n/a**. Each cell is
`state` — caveat — tracking (`not adopted, no tracking issue` only when the repo has issues disabled).
**migrating** means an open PR is the verified adoption path (not yet on `main`).

Fleet rollup issues: template [#145](https://github.com/osloer-industries/typescript-node-template/issues/145);
de-invest-sync [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104);
vakt [#155](https://github.com/osloer-industries/vakt/issues/155);
homeexchange-mcp [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111);
coast-fire-visualizer [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18);
expat-finance-hub [#33](https://github.com/tn819/expat-finance-hub/issues/33);
lunch-money [#24](https://github.com/osloer-industries/lunch-money/issues/24).

## Bun limitations (org reusables)

On `main` at `v0.1.2` (`d1fd7700…`), `node-npm-quality.yml`, `sonarqube-cloud-node.yml`, `mutation-changed.yml`, and
`node-setup-smoke.yml` install and run via **npm only**. Open org PR
[#40](https://github.com/osloer-industries/.github/pull/40) adds **`package-manager: npm|bun`** (default `npm`) plus
**`bun-version-file`** to those reusables. After the **next `v0.x.y` tag** after `v0.1.2` ships [#40](https://github.com/osloer-industries/.github/pull/40),
Bun repos can call them with `package-manager: bun` instead of maintaining a parallel local quality job.

| Org reusable | After `package-manager: bun` (post–#40 tag) | Remaining limitations |
| --- | --- | --- |
| [`node-npm-quality.yml`](https://github.com/osloer-industries/.github/blob/main/.github/workflows/node-npm-quality.yml) | `bun install`, `bun audit`, `bun run` for the check script input | Caller must pass the repo's check script name (for example `check`) |
| [`sonarqube-cloud-node.yml`](https://github.com/osloer-industries/.github/blob/main/.github/workflows/sonarqube-cloud-node.yml) | `bun install` + `bun run` for the coverage script input | **Sonar coverage paths** must match output of `bun run <coverage script>` and `sonar-project.properties` |
| [`mutation-changed.yml`](https://github.com/osloer-industries/.github/blob/main/.github/workflows/mutation-changed.yml) | `bun install` + configured mutation scripts | PR/full paths still run **`node_modules/.bin/stryker`**; Stryker config must work with Bun-installed deps |
| [`node-setup-smoke.yml`](https://github.com/osloer-industries/.github/blob/main/.github/workflows/node-setup-smoke.yml) | `bun install` + setup script via `bun run` | Default `scenarios-json` includes **`npm-package`** — Bun callers need a **trimmed** list; n/a without template setup CLI |

Other fleet reusables (no `package-manager` input on `v0.1.2`): callable from Bun repos as-is —
`workflow-security.yml`, `codeql-javascript-typescript.yml` (no package install; `setup-node` + `node` only for
artifact SARIF gate), `ci-passed.yml`, `semantic-pull-request.yml`, `dependency-review.yml`, `release-please.yml`,
`auto-merge.yml`, `sonarcloud-zero-issues.yml` (`setup-node` + `node` for org script only).

**lunch-money** ([#23](https://github.com/osloer-industries/lunch-money/pull/23) branch, verified 2026-11-16) —
org reusables at `d1fd7700…` `# v0.1.2`: `workflow-security.yml` and `codeql-javascript-typescript.yml`
(SARIF artifact mode, `queries: security-extended`) and `ci-passed.yml` in `ci.yml`; `dependency-review.yml`
in `dependency-review.yml`; `sonarcloud-zero-issues.yml` in `sonarcloud.yml` (`on: pull_request` only;
**not** in `ci-passed` `needs` until org tag with [#39](https://github.com/osloer-industries/.github/pull/39) — see
[Sonar zero-open + ci-passed](#sonar-zero-open-issues-and-ci-passed)); `semantic-pull-request.yml` in `pr-title.yml`
(`pull_request_target`); Dependabot `osloer-reusables` group. Until the post–`v0.1.2` org tag ([#40](https://github.com/osloer-industries/.github/pull/40)),
[#23](https://github.com/osloer-industries/lunch-money/pull/23) keeps a **local `check` job**:
`bun install --frozen-lockfile --ignore-scripts`, `bun audit --production`, `bun run check` (same as lefthook
`pre-commit`), not `node-npm-quality.yml`.

## Adoption matrix

| Feature | typescript-node-template | lunch-money | lunch-money-de-invest-sync | vakt | homeexchange-mcp | coast-fire-visualizer | markdown-link-check | `.github` | expat-finance-hub |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| workflow-security.yml | adopted — `ci.yml` — [#128](https://github.com/osloer-industries/typescript-node-template/pull/128) | migrating via lunch-money#23 (bun repo) — `ci.yml` → org reusable `# v0.1.2` — [#23](https://github.com/osloer-industries/lunch-money/pull/23) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `ci.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — `ci.yml` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — `ci.yml` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted on `main` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | adopted — `ci.yml` — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| codeql-javascript-typescript.yml | adopted — `ci.yml` — [#128](https://github.com/osloer-industries/typescript-node-template/pull/128) | migrating via lunch-money#23 (bun repo) — `ci.yml`; artifact mode, `security-extended` — [#23](https://github.com/osloer-industries/lunch-money/pull/23) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `codeql.yml` artifact mode — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — `codeql.yml` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — `codeql.yml` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | partial — inlined `codeql-action`, `upload: false` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | adopted — `codeql.yml` — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| node-npm-quality.yml | partial — inlined Quality (`npm run check`) — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | migrating via lunch-money#23 (bun repo) — local `check` until org [#40](https://github.com/osloer-industries/.github/pull/40) tag — [#23](https://github.com/osloer-industries/lunch-money/pull/23) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `ci.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — Bun build job — [#155](https://github.com/osloer-industries/vakt/issues/155) | partial — inlined `npm run check` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | partial — inlined lint/typecheck — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | adopted — `ci.yml` — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| mutation-changed.yml | adopted — `ci.yml` mutation jobs — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | not adopted — npm reusable; out of [#23](https://github.com/osloer-industries/lunch-money/pull/23) scope — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | not adopted — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a — ships reusable | not adopted — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| node-setup-smoke.yml | adopted — matrix in `ci.yml` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | not adopted — n/a (no template setup CLI) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | not adopted — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | not adopted — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| sonarqube-cloud-node.yml | adopted — `sonar-analyze` in `ci.yml` — [#128](https://github.com/osloer-industries/typescript-node-template/pull/128) | not adopted — npm reusable; [#23](https://github.com/osloer-industries/lunch-money/pull/23) uses zero-open only — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | partial — inlined scan in `ci.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | partial — inlined scan in `ci.yml` — [#155](https://github.com/osloer-industries/vakt/issues/155) | partial — inlined scan in `ci.yml` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | partial — optional token in `sonar.yml` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | adopted — `sonar.yml` reusable — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| sonarcloud-zero-issues.yml + ci-passed PR-only contract | partial — adopt org contract via [#144](https://github.com/osloer-industries/typescript-node-template/pull/144) — [#128](https://github.com/osloer-industries/typescript-node-template/pull/128) | migrating via lunch-money#23 (bun repo) — PR-only; out of `ci-passed` until org tag — action: wire into `ci-passed` after tag — [#23](https://github.com/osloer-industries/lunch-money/pull/23) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | partial — PR-only `sonar.yml`; not in `ci-passed` — action: add to `ci-passed` after org tag — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — if adopted, org standard — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — if adopted, org standard — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — if adopted, org standard — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a — script is PR-only | partial — PR-only; not in `ci-passed` — action: add to `ci-passed` after org tag — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| ci-passed.yml | adopted — `ci.yml`; Sonar skip contract via [#144](https://github.com/osloer-industries/typescript-node-template/pull/144) — [#128](https://github.com/osloer-industries/typescript-node-template/pull/128) | migrating via lunch-money#23 (bun repo) — needs `workflow-security`, local `check`, `codeql` — [#23](https://github.com/osloer-industries/lunch-money/pull/23) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | not adopted — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | partial — inlined gate in org `ci.yml` | not adopted — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| harness-approval gate (`guardrail-detect` + `harness-approval` environment) | adopted — `ci.yml`; [ADR 0012](adr/0012-blocking-guardrail-change-check.md) — [#103](https://github.com/osloer-industries/typescript-node-template/pull/103) | not adopted — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | not adopted — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | not adopted — template-only until fleet rollout | not adopted — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| semantic-pull-request.yml | partial — `amannn` in `pr-title.yml` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145), [#56](https://github.com/osloer-industries/typescript-node-template/issues/56), [#111](https://github.com/osloer-industries/typescript-node-template/issues/111) | migrating via lunch-money#23 (bun repo) — org reusable in `pr-title.yml` (`pull_request_target`) — [#23](https://github.com/osloer-industries/lunch-money/pull/23) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `pr-title.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | partial — `amannn` in `pr-title.yml` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111), [#98](https://github.com/osloer-industries/homeexchange-mcp/pull/98) | partial — `amannn` in `pr-title.yml` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18), [#13](https://github.com/osloer-industries/coast-fire-visualizer/pull/13) | not adopted — issues disabled; no tracking issue | n/a | adopted — `semantic-pull-request.yml` — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| dependency-review.yml | partial — marketplace action inlined — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145), [#56](https://github.com/osloer-industries/typescript-node-template/issues/56), [#111](https://github.com/osloer-industries/typescript-node-template/issues/111) | migrating via lunch-money#23 (bun repo) — `dependency-review.yml` on `pull_request` — [#23](https://github.com/osloer-industries/lunch-money/pull/23) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | n/a — GHAS-free `dependency-diff-audit.mjs` (keep local) — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — org reusable — [#155](https://github.com/osloer-industries/vakt/issues/155) | partial — marketplace action — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — private repo — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | adopted — org reusable — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| release-please.yml | adopted — `release.yml` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | not adopted — out of [#23](https://github.com/osloer-industries/lunch-money/pull/23) scope — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `release.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | n/a — semantic-release + Homebrew in `release.yml` — [#155](https://github.com/osloer-industries/vakt/issues/155) | partial — `googleapis/release-please-action` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | partial — verify `release.yml` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | partial — npm/Docker on tag; not Release Please — issues disabled; no tracking issue | adopted — in-repo `release-please.yml` | adopted — `release-please.yml` — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| auto-merge.yml | not adopted — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | not adopted — out of [#23](https://github.com/osloer-industries/lunch-money/pull/23) scope — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | not adopted — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | adopted — `auto-merge-caller.yml` | not adopted — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| Dependabot (`osloer-reusables`) | adopted — `.github/dependabot.yml` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | migrating via lunch-money#23 (bun repo) — `osloer-reusables` group + `bun` ecosystem — [#23](https://github.com/osloer-industries/lunch-money/pull/23) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — on `main` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — `osloer-reusables` group on `main` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — on `main` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | partial — `.github/dependabot.yml` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | adopted | adopted — `osloer-reusables` on `main` — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| lefthook + `npm run prepare` | adopted — `lefthook.yml` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | migrating via lunch-money#23 (bun repo) — `lefthook.yml` pre-commit `bun run check` — [#23](https://github.com/osloer-industries/lunch-money/pull/23) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `lefthook.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | not adopted — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| jscpd (`lint:dup`) | adopted — `.jscpd.json` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | migrating via lunch-money#23 (bun repo) — in `bun run check` via [#23](https://github.com/osloer-industries/lunch-money/pull/23) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `.jscpd.json` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | not adopted — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| e2e / domain CI | n/a — setup smoke only — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | not adopted — out of [#23](https://github.com/osloer-industries/lunch-money/pull/23) scope — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | partial — macOS + TZ jobs — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — `docker-e2e` in `ci.yml` — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | partial — CLI integration in `ci.yml` — issues disabled; no tracking issue | n/a | not adopted — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |

## Sonar zero-open-issues and ci-passed

The org script `sonarcloud-zero-issues.ts` **exits with error unless `github.event_name` is
`pull_request`** (it needs `pull_request.number` and head SHA).

### Org standard

1. **`sonarcloud-zero-issues.yml` is listed in `ci-passed` `needs`** and runs **only on `pull_request`**
   (scope the job or workflow so it does not run on `push`).
2. **`ci-passed` tolerates `skipped` only for that zero-open job and only on non-`pull_request` events**
   (for example `push` to the default branch). On **`pull_request`**, a skipped, cancelled, or missing
   zero-open job **fails** the gate. On **`push`**, no other upstream job's skip is tolerated.

Implementation:

- Template: [#144](https://github.com/osloer-industries/typescript-node-template/pull/144).
- Org `ci-passed.yml` / `ci-passed-gate.ts`: [#39](https://github.com/osloer-industries/.github/pull/39) — input
  **`sonar-zero-issues-job`** (default `sonar-zero-open-issues`; callers may **only rename** that job id).
- Bun-capable npm-bound reusables: [#40](https://github.com/osloer-industries/.github/pull/40) (`package-manager`,
  `bun-version-file`).

Both org PRs target the **next `v0.x.y` tag** after `v0.1.2` (`d1fd7700…`). Until callers pin that tag, keep
zero-open **out** of `ci-passed` `needs` when the pinned gate still allows `success` only (no Sonar skip tolerance).

### Per-repo state and action items

| Repository | Current wiring | Action item |
| --- | --- | --- |
| typescript-node-template | zero-open in `ci-passed` `needs`; job still runs on `push` on `main` | **Adopt** org contract in [#144](https://github.com/osloer-industries/typescript-node-template/pull/144) |
| lunch-money | [#23](https://github.com/osloer-industries/lunch-money/pull/23): PR-only `sonarcloud.yml`; **not** in `ci-passed` | Keep out until org tag ([#39](https://github.com/osloer-industries/.github/pull/39)); then **add** to `ci-passed` `needs` — [#24](https://github.com/osloer-industries/lunch-money/issues/24) |
| lunch-money-de-invest-sync | PR-only `sonar.yml`; **not** in `ci-passed` | **Move** into `ci-passed` `needs` after org tag ([#39](https://github.com/osloer-industries/.github/pull/39)) — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) |
| tn819/expat-finance-hub | PR-only job; **not** in `ci-passed` | **Move** into `ci-passed` `needs` after org tag ([#39](https://github.com/osloer-industries/.github/pull/39)) — [#33](https://github.com/tn819/expat-finance-hub/issues/33) |
| vakt | no zero-open job | When adopting zero-open, **follow** org standard — [#155](https://github.com/osloer-industries/vakt/issues/155) |
| homeexchange-mcp | no zero-open job | When adopting zero-open, **follow** org standard — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) |
| coast-fire-visualizer | no zero-open job | When adopting zero-open, **follow** org standard — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) |

## Maintainer rules

When you add or change a template feature or an org reusable in this repository:

1. Update the matching row in this file (state, pin, caveat, links).
2. Open or reference a PR/issue in **each** consuming repository that should adopt the change.
3. Record those links in the table column for that repo.

CI enforces step 1 on pull requests: workflow or composite-action edits require
`docs/fleet-adoption.md` in the same diff (`scripts/check-fleet-adoption-doc.ts`).

Regenerate a blank matrix for manual passes: `node scripts/print-fleet-adoption-matrix.ts`.
