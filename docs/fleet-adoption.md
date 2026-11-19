# Fleet adoption

Deterministic map of [org reusable workflows](https://github.com/osloer-industries/.github/blob/main/docs/consuming-workflows.md)
and template harness features across consuming repositories.

**Verification date:** 2026-11-19 (default branches; workflow YAML and config on GitHub).

## Reusable pin snapshot

| Repository | Org `.github` pin (comment) | Notes |
| --- | --- | --- |
| typescript-node-template | `348b254ef112f4f8e239a41e7adb3f3e2dac3944` (`# v0.1.6`) | Template reference; latest org tag `a6ee91211fd9ba096ec141bacdb67985a82b6767` (`# v0.1.7`) |
| lunch-money | `348b254ef112f4f8e239a41e7adb3f3e2dac3944` (`# v0.1.6`) | Bun repo; `.github/workflows/` on `main` |
| lunch-money-de-invest-sync | `a081e1b87b5309ff2b3999e8d6804d8ebec5c518` (`# v0.1.1`) | |
| vakt | `348b254ef112f4f8e239a41e7adb3f3e2dac3944` (`# v0.1.6`) | Consolidated `ci.yml` on `main` |
| homeexchange-mcp | `a6ee91211fd9ba096ec141bacdb67985a82b6767` (`# v0.1.7`) in `ci.yml`; `348b254…` (`# v0.1.6`) in `release.yml`, `pr-title.yml`, `dependency-review.yml` | Mixed pins across workflow files |
| expat-finance-hub | `a6ee91211fd9ba096ec141bacdb67985a82b6767` (`# v0.1.7`) | org repo; consolidated `ci.yml` on `main` |
| coast-fire-visualizer | `348b254ef112f4f8e239a41e7adb3f3e2dac3944` (`# v0.1.6`) | Next.js app; org `ci.yml` on `main` |
| markdown-link-check | *none* | Legacy Actions; default branch `master` |
| osloer-industries/.github | `a6ee91211fd9ba096ec141bacdb67985a82b6767` (`# v0.1.7`) | Publisher; [#39](https://github.com/osloer-industries/.github/pull/39), [#40](https://github.com/osloer-industries/.github/pull/40) shipped in `v0.1.3` |

Cell legend: **adopted** · **partial** · **migrating** · **not adopted** · **n/a**. Each cell is
`state` — caveat — tracking (`not adopted, no tracking issue` only when the repo has issues disabled).
**migrating** means an open PR is the verified adoption path (not yet on `main`).

Fleet rollup issues: template [#145](https://github.com/osloer-industries/typescript-node-template/issues/145);
de-invest-sync [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104);
vakt [#155](https://github.com/osloer-industries/vakt/issues/155);
homeexchange-mcp [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111);
coast-fire-visualizer [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18);
expat-finance-hub [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33);
lunch-money [#24](https://github.com/osloer-industries/lunch-money/issues/24).

## Bun limitations (org reusables)

Org release **`v0.1.7`** (`a6ee91211fd9ba096ec141bacdb67985a82b6767`) includes
[#40](https://github.com/osloer-industries/.github/pull/40) (released in `v0.1.3`): **`package-manager: npm|bun`**
(default `npm`) and **`bun-version-file`** on `node-npm-quality.yml`, `sonarqube-cloud-node.yml`, `mutation-changed.yml`,
and `node-setup-smoke.yml`. Bun repos pass `package-manager: bun` on pins **≥ `v0.1.3`**.

| Org reusable | With `package-manager: bun` | Remaining limitations |
| --- | --- | --- |
| [`node-npm-quality.yml`](https://github.com/osloer-industries/.github/blob/v0.1.7/.github/workflows/node-npm-quality.yml) | `bun install`, `bun audit`, `bun run` for the check script input | Caller must pass the repo's check script name (for example `check`) |
| [`sonarqube-cloud-node.yml`](https://github.com/osloer-industries/.github/blob/v0.1.7/.github/workflows/sonarqube-cloud-node.yml) | `bun install` + `bun run` for the coverage script input | Coverage paths must match `sonar-project.properties` |
| [`mutation-changed.yml`](https://github.com/osloer-industries/.github/blob/v0.1.7/.github/workflows/mutation-changed.yml) | `bun install` + configured mutation scripts | Still invokes **`node_modules/.bin/stryker`** |
| [`node-setup-smoke.yml`](https://github.com/osloer-industries/.github/blob/v0.1.7/.github/workflows/node-setup-smoke.yml) | `bun install` + setup script via `bun run` | Default `scenarios-json` includes **`npm-package`** — trim for Bun |

**lunch-money** (`main`, verified 2026-11-19) — org pin **`348b254…` `# v0.1.6`**: `node-npm-quality.yml` with
`package-manager: bun`; `workflow-security.yml`, `codeql-javascript-typescript.yml` (artifact mode, `security-extended`);
PR-only `sonarcloud-zero-issues.yml` in `ci-passed` `needs` with `sonar-zero-issues-job: sonar-zero-open-issues`
(Sonar automatic analysis restored locally — no `sonarqube-cloud-node.yml` in `ci.yml`); `ci-passed.yml`;
`dependency-review.yml`, org semantic PR (`pull_request`), Dependabot `osloer-reusables` + Bun ecosystem.

**vakt** — multiple `node-npm-quality.yml` jobs with `package-manager: bun`, plus `mutation-changed.yml` with Bun
on `# v0.1.6`.

Other fleet reusables: `workflow-security.yml`, `codeql-javascript-typescript.yml`, `ci-passed.yml` (Sonar skip
tolerance on **`v0.1.3`**+), `semantic-pull-request.yml`, `dependency-review.yml`, `release-please.yml`, `auto-merge.yml`,
`sonarcloud-zero-issues.yml`.

## Adoption matrix

| Feature | typescript-node-template | lunch-money | lunch-money-de-invest-sync | vakt | homeexchange-mcp | coast-fire-visualizer | markdown-link-check | `.github` | expat-finance-hub |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| workflow-security.yml | adopted — `ci.yml` `# v0.1.6` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | adopted — `ci.yml` `# v0.1.6` — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `ci.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — `ci.yml` `# v0.1.6` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — `ci.yml` `# v0.1.7` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | adopted — `ci.yml` `# v0.1.6` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | adopted — `ci.yml` `# v0.1.7` — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| codeql-javascript-typescript.yml | adopted — `ci.yml` `# v0.1.6` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | adopted — `ci.yml`; artifact mode, `security-extended` — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `codeql.yml` artifact mode — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — `ci.yml` `# v0.1.6` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — `ci.yml` `# v0.1.7` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | adopted — `ci.yml`; artifact mode — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | adopted — `ci.yml` `# v0.1.7` — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| node-npm-quality.yml | partial — Quality runs `npm run precommit` (Oxlint through unit tests; full `check` locally pre-merge) — [#114](https://github.com/osloer-industries/typescript-node-template/pull/114), [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | adopted — org `node-npm-quality` `package-manager: bun` in `ci.yml` — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `ci.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — multiple Bun quality jobs in `ci.yml` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — org reusable in `ci.yml` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | adopted — org reusable in `ci.yml` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | adopted — `ci.yml` `# v0.1.7` — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| mutation-changed.yml | adopted — `ci.yml` mutation jobs — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | not adopted — n/a — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | not adopted — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — org `mutation-changed` `package-manager: bun` — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a — ships reusable | not adopted — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| node-setup-smoke.yml | adopted — matrix in `ci.yml` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | not adopted — n/a (no template setup CLI) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | not adopted — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | not adopted — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| sonarqube-cloud-node.yml | adopted — `sonar-analyze` in `ci.yml` `# v0.1.6` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | not adopted — automatic analysis + zero-open only (local restore job) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | partial — inlined scan in `ci.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — `sonar-scan` org reusable `package-manager: bun` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — `ci.yml` `# v0.1.7` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | adopted — `sonar-analyze` in `ci.yml` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | adopted — `ci.yml` `# v0.1.7` — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| sonarcloud-zero-issues.yml + ci-passed PR-only contract | adopted — PR-only job in `ci.yml`; in local `ci-passed` `needs`; `ce-task-id` from Sonar — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | adopted — in `ci-passed` `needs`; `sonar-zero-issues-job` `# v0.1.6` — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | partial — PR-only inlined scan; not in aggregate gate — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | partial — zero-open in `ci-passed` `needs`; local `sonarcloud` aggregator enforces PR contract — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — in `ci-passed` `needs` `# v0.1.7` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | adopted — in `ci-passed` `needs` `# v0.1.6` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a — [#39](https://github.com/osloer-industries/.github/pull/39) in `v0.1.3`+ | adopted — in consolidated `ci-passed` `# v0.1.7` — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| ci-passed.yml | partial — in-repo `scripts/ci-passed-gate.ts` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | adopted — org `ci-passed.yml` `# v0.1.6` — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | not adopted — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — org `ci-passed.yml` `# v0.1.6` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — org `ci-passed.yml` `# v0.1.7` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | adopted — org `ci-passed.yml` `# v0.1.6` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | partial — inlined gate in org `ci.yml` | adopted — org `ci-passed.yml` in `ci.yml` — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| harness-approval gate (`guardrail-detect` + `harness-approval` environment) | adopted — `ci.yml`; [ADR 0012](adr/0012-blocking-guardrail-change-check.md) — [#103](https://github.com/osloer-industries/typescript-node-template/pull/103) | not adopted — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | not adopted — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | not adopted — template-only until fleet rollout | not adopted — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| semantic-pull-request.yml | partial — `amannn` in `pr-title.yml` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145), [#56](https://github.com/osloer-industries/typescript-node-template/issues/56) | adopted — org reusable in `pr-title.yml` (`pull_request`) — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `pr-title.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — org reusable `# v0.1.6` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — org reusable `# v0.1.6` in `pr-title.yml` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | adopted — org reusable `# v0.1.6` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | adopted — `semantic-pull-request.yml` `# v0.1.7` — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| dependency-review.yml | partial — marketplace action inlined — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | adopted — `dependency-review.yml` `# v0.1.6` — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | n/a — GHAS-free `dependency-diff-audit.mjs` (keep local) — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — org reusable `# v0.1.6` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — org reusable `# v0.1.6` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — private repo — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | adopted — org reusable `# v0.1.7` — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| release-please.yml | adopted — `release.yml` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | not adopted — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `release.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | n/a — semantic-release + Homebrew in `release.yml` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — org reusable `# v0.1.6` in `release.yml` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | partial — verify `release.yml` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | partial — npm/Docker on tag; not Release Please — issues disabled; no tracking issue | adopted — in-repo `release-please.yml` | partial — org reusable `# v0.1.7` gated on `RELEASE_TOKEN` — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| auto-merge.yml | not adopted — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | not adopted — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | not adopted — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — `auto-merge.yml` `# v0.1.6` — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | adopted — `auto-merge-caller.yml` | not adopted — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| Dependabot (`osloer-reusables`) | adopted — `.github/dependabot.yml` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | adopted — `osloer-reusables` + `bun` on `main` — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — on `main` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — `osloer-reusables` group on `main` — [#155](https://github.com/osloer-industries/vakt/issues/155) | adopted — on `main` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | partial — `.github/dependabot.yml` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | adopted | adopted — `osloer-reusables` on `main` — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| lefthook + `npm run prepare` | adopted — `lefthook.yml` pre-commit `npm run precommit` — [#114](https://github.com/osloer-industries/typescript-node-template/pull/114), [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | adopted — `lefthook.yml` pre-commit `bun run check` — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `lefthook.yml` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | not adopted — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| jscpd (`lint:dup`) | adopted — `.jscpd.json` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | adopted — in `bun run check` — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | adopted — `.jscpd.json` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | not adopted — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | not adopted — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | not adopted — issues disabled; no tracking issue | n/a | not adopted — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| e2e / domain CI | n/a — setup smoke only — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) | not adopted — [#24](https://github.com/osloer-industries/lunch-money/issues/24) | partial — macOS + TZ jobs — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) | adopted — `docker-e2e` + platform bats in `ci.yml` — [#155](https://github.com/osloer-industries/vakt/issues/155) | not adopted — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) | adopted — Playwright `e2e` job in `ci.yml` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) | partial — CLI integration in `ci.yml` — issues disabled; no tracking issue | n/a | not adopted — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |

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

- Org `ci-passed.yml` / `ci-passed-gate.ts`: [#39](https://github.com/osloer-industries/.github/pull/39) (**released
  in `v0.1.3`**) — input **`sonar-zero-issues-job`** (default `sonar-zero-open-issues`; callers may **only rename** that
  job id).
- Bun-capable npm-bound reusables: [#40](https://github.com/osloer-industries/.github/pull/40) (**released in
  `v0.1.3`**) — `package-manager`, `bun-version-file`.

Callers on pins **before `v0.1.3`** should keep zero-open **out** of `ci-passed` `needs` until they bump (gate allows
`success` only, no Sonar skip tolerance).

### Per-repo state and action items

| Repository | Current wiring | Action item |
| --- | --- | --- |
| typescript-node-template | PR-only zero-open in local `ci-passed` `needs`; org reusables at `# v0.1.6` | **Adopt now:** bump org pins to `# v0.1.7`; switch to org `ci-passed.yml` — [#145](https://github.com/osloer-industries/typescript-node-template/issues/145) |
| lunch-money | Org `ci-passed` `# v0.1.6`; zero-open in `needs` + `sonar-zero-issues-job`; no org Sonar scan job | Optional: adopt `sonarqube-cloud-node.yml` if moving off automatic analysis — [#24](https://github.com/osloer-industries/lunch-money/issues/24) |
| lunch-money-de-invest-sync | Inlined Sonar; pin `# v0.1.1`; no `ci-passed` | **Adopt now:** bump to `# v0.1.7`; org Sonar + zero-open in `ci-passed` — [#104](https://github.com/osloer-industries/lunch-money-de-invest-sync/issues/104) |
| expat-finance-hub | Consolidated `ci.yml` `# v0.1.7`; zero-open in org `ci-passed` | Align pin across all workflow files on `# v0.1.7` — [#33](https://github.com/osloer-industries/expat-finance-hub/issues/33) |
| vakt | Org Sonar + zero-open in `ci-passed` `# v0.1.6`; custom `sonarcloud` aggregator | Optional: drop local aggregator; set `sonar-zero-issues-job` on org `ci-passed` — [#155](https://github.com/osloer-industries/vakt/issues/155) |
| homeexchange-mcp | Org stack in `ci.yml` `# v0.1.7`; some workflows still `# v0.1.6` | **Adopt now:** unify pins to `# v0.1.7` — [#111](https://github.com/osloer-industries/homeexchange-mcp/issues/111) |
| coast-fire-visualizer | Org `ci.yml` `# v0.1.6` with Sonar + `ci-passed` | Optional: bump to `# v0.1.7` — [#18](https://github.com/osloer-industries/coast-fire-visualizer/issues/18) |

## Maintainer rules

When you add or change a template feature or an org reusable in this repository:

1. Update the matching row in this file (state, pin, caveat, links).
2. Open or reference a PR/issue in **each** consuming repository that should adopt the change.
3. Record those links in the table column for that repo.

CI enforces step 1 on pull requests: workflow or composite-action edits require
`docs/fleet-adoption.md` in the same diff (`scripts/check-fleet-adoption-doc.ts`).

Regenerate a blank matrix for manual passes: `node scripts/print-fleet-adoption-matrix.ts`.
