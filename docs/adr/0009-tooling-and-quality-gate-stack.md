# ADR 0009: Tooling and quality-gate stack

## Status

Accepted

## Context

The template runs many linters, test tools, and CI integrations. Agents and maintainers need a single
place that records **why** each tool is in the stack and what we rejected. Operational detail stays in
`AGENTS.md` and [docs/sonar-quality-gate.md](../sonar-quality-gate.md); this ADR is the decision log.

Related: [issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60),
PR [#27](https://github.com/osloer-industries/typescript-node-template/pull/27) (verifiability baseline),
PR [#13](https://github.com/osloer-industries/typescript-node-template/pull/13) (type-aware Oxlint),
[ADR 0004](0004-workflow-security-zizmor-and-actionlint.md),
[ADR 0008](0008-codeql-on-private-repos.md).

---

## Root `package.json` devDependencies

### `oxlint`

<!-- devDependency: oxlint -->

**Why chosen:** Primary fast linter for `src/`, `scripts/`, and `packages/` with type-aware TypeScript
rules, Vitest plugin rules, and escape-hatch enforcement ([#13](https://github.com/osloer-industries/typescript-node-template/pull/13),
[#62](https://github.com/osloer-industries/typescript-node-template/pull/62)). Present since the initial
template ([#2101f66](https://github.com/osloer-industries/typescript-node-template/commit/2101f66)).

**Alternatives considered:** ESLint as the only linter; Biome as an all-in-one linter.

**Why they lost:** ESLint alone is slower at template scale and duplicates SonarJS’s ESLint path; Biome
would replace Oxlint + parts of the markdown/dup stack without matching the SonarJS `recommended` parity
we already enforce via `eslint-plugin-sonarjs` in `packages/eslint-sonarjs`.

### `oxlint-tsgolint`

<!-- devDependency: oxlint-tsgolint -->

**Why chosen:** Oxlint optional companion for **type-aware** analysis when `.oxlintrc.json` sets
`options.typeAware: true` ([#13](https://github.com/osloer-industries/typescript-node-template/pull/13)).

**Alternatives considered:** Type-aware ESLint-only analysis for all rules.

**Why they lost:** Type-aware ESLint for the full rule set is already split to SonarJS package; Oxlint
type-aware rules need `oxlint-tsgolint` in the Oxlint ecosystem today.

### `typescript` (root)

<!-- devDependency: typescript -->

**Why chosen:** Authoritative **`tsc`** typecheck and emit for application code on **TypeScript 7**
(`npm run typecheck`, `npm run build`). Initial template shipped TS 7
([#2101f66](https://github.com/osloer-industries/typescript-node-template/commit/2101f66)).

**Alternatives considered:** Stay on TypeScript 5.x/6.x for slower upgrade churn; single TS version for
ESLint and `tsc` by downgrading root.

**Why they lost:** Template targets current TS for consumers; downgrading root would block TS 7 consumers.
Split compiler version for SonarJS is documented in
[docs/sonar-quality-gate.md](../sonar-quality-gate.md) and
the nested `typescript` devDependency in `packages/eslint-sonarjs`.

### `vitest`

<!-- devDependency: vitest -->

**Why chosen:** ESM-native test runner colocated with `*.test.ts`, integrated with Oxlint Vitest rules,
and used in CI via `npm run test:coverage` ([#2101f66](https://github.com/osloer-industries/typescript-node-template/commit/2101f66),
[#27](https://github.com/osloer-industries/typescript-node-template/pull/27)).

**Alternatives considered:** Node.js built-in test runner only; Jest.

**Why they lost:** Built-in runner lacks the same Vitest+Oxlint ecosystem; Jest is heavier and less aligned
with ESM `NodeNext` defaults in this template.

### `@vitest/coverage-v8`

<!-- devDependency: @vitest/coverage-v8 -->

**Why chosen:** V8 coverage provider for **80%** thresholds in `vitest.config.ts` and LCOV for Sonar
when `SONAR_TOKEN` is set ([#27](https://github.com/osloer-industries/typescript-node-template/pull/27)).

**Alternatives considered:** Istanbul/nyc; no coverage gate.

**Why they lost:** Vitest documents V8 as the primary provider; skipping coverage would not enforce template
coverage contracts in `AGENTS.md`.

### `jscpd`

<!-- devDependency: jscpd -->

**Why chosen:** Duplication detection on TypeScript, JavaScript, and Markdown with **0%** tolerated
duplication in `.jscpd.json` ([#27](https://github.com/osloer-industries/typescript-node-template/pull/27)).

**Alternatives considered:** Sonar duplication only; manual review.

**Why they lost:** Sonar duplication is PR/cloud scoped; jscpd runs locally in `npm run check` and blocks
copy-pasted agent instructions across markdown.

### `markdownlint-cli2`

<!-- devDependency: markdownlint-cli2 -->

**Why chosen:** Markdown structure/style lint for docs and READMEs in `npm run lint:md`.

**Alternatives considered:** markdownlint-cli v1; no markdown lint.

**Why they lost:** **Rationale not recorded, inferred:** cli2 is the maintained batch interface aligned with
config in `.markdownlint-cli2.jsonc`; skipping markdown lint would allow broken lists/headings in agent docs.

### `@osloer-industries/markdown-link-check`

<!-- devDependency: @osloer-industries/markdown-link-check -->

**Why chosen:** Link checking via org fork pinned by git tag in `package.json` (`npm run lint:md-links`);
documented in `AGENTS.md` because Dependabot does not bump git-tag dependencies.

**Alternatives considered:** Upstream `markdown-link-check`; no link checking.

**Why they lost:** Fork carries org-specific fixes/tags; no link check allows dead links in harness docs.

### `lefthook`

<!-- devDependency: lefthook -->

**Why chosen:** Git hooks runner for staged Oxlint, SonarJS, and markdownlint (`lefthook.yml`, `npm run
prepare`); CI uses `npm ci --ignore-scripts` so hooks never run in Actions
([#32](https://github.com/osloer-industries/typescript-node-template/pull/32)).

**Alternatives considered:** Husky; no pre-commit hooks.

**Why they lost:** **Rationale not recorded, inferred:** Lefthook supports per-command globs without
extra shell scripts; Husky would work but switching cost with no recorded driver issue.

### `@types/node`

<!-- devDependency: @types/node -->

**Why chosen:** TypeScript typings for Node.js APIs in `src/` and `scripts/` matching engine **Node 24**
(`.nvmrc`).

**Alternatives considered:** `@types/node` major pinned to older Node; inline custom typings.

**Why they lost:** Dependabot ignores major bumps for `@types/node` in `.github/dependabot.yml` to avoid
accidental engine mismatch; custom typings do not scale.

---

## `packages/eslint-sonarjs` devDependencies

### `packages/eslint-sonarjs` — `eslint`

<!-- devDependency: packages/eslint-sonarjs/eslint -->

**Why chosen:** ESLint 9 flat config runner for `eslint-plugin-sonarjs` in an isolated package
([#27](https://github.com/osloer-industries/typescript-node-template/pull/27)).

**Alternatives considered:** Oxlint `jsPlugins` loading SonarJS; ESLint at repo root for all rules.

**Why they lost:** Oxlint + SonarJS plugin fails under root TS 7 (documented in
[docs/sonar-quality-gate.md](../sonar-quality-gate.md)); root ESLint would duplicate Oxlint’s role for
non-Sonar rules.

### `packages/eslint-sonarjs` — `eslint-plugin-sonarjs`

<!-- devDependency: packages/eslint-sonarjs/eslint-plugin-sonarjs -->

**Why chosen:** Local **Sonar `recommended`** rules (`npm run lint:sonarjs`) to shift-left SonarCloud
findings ([#27](https://github.com/osloer-industries/typescript-node-template/pull/27)).

**Alternatives considered:** SonarCloud-only analysis; Semgrep rules in ESLint.

**Why they lost:** Sonar-only waits for PR feedback; Semgrep rule model differs from Sonar rule keys the
team already gates on in SonarCloud.

### `packages/eslint-sonarjs` — `@typescript-eslint/parser`

<!-- devDependency: packages/eslint-sonarjs/@typescript-eslint/parser -->

**Why chosen:** TypeScript parser for SonarJS ESLint on `src/**/*.ts` and `scripts/**/*.ts` with
`projectService: true` in `eslint.config.mjs`.

**Alternatives considered:** Babel parser; untyped ESLint.

**Why they lost:** SonarJS TS rules expect typed AST; untyped parsing misses many rules.

### `packages/eslint-sonarjs` — `typescript`

<!-- devDependency: packages/eslint-sonarjs/typescript -->

**Why chosen:** Pin **TypeScript 6** for the parser/compiler API used by `@typescript-eslint/parser` while
root stays on **TypeScript 7** ([#27](https://github.com/osloer-industries/typescript-node-template/pull/27),
[docs/sonar-quality-gate.md](../sonar-quality-gate.md)).

**Alternatives considered:** Single TS 7 everywhere; downgrade root to TS 6.

**Why they lost:** `ts-api-utils` / SonarJS plugin load breaks under TS 7 for Oxlint jsPlugins; downgrading
root would violate template TS 7 goal.

---

## CI and GitHub automation (workflows / org reusables)

### CI: Dependabot

<!-- ci-tool: dependabot -->

**Why chosen:** Weekly npm and GitHub Actions updates with **cooldown** and grouped dev-deps
(`.github/dependabot.yml`, [#61](https://github.com/osloer-industries/typescript-node-template/pull/61)).

**Alternatives considered:** Renovate; manual-only bumps.

**Why they lost:** **Rationale not recorded, inferred:** Dependabot is native to GitHub with org-familiar
PR flow; Renovate adds another bot/policy surface.

### CI: `dependency-review-action`

<!-- ci-tool: dependency-review-action -->

**Why chosen:** Fail PRs that introduce **high** severity vulnerable dependencies
(`.github/workflows/dependency-review.yml`).

**Alternatives considered:** `npm audit` only in CI.

**Why they lost:** Audit in Quality job covers manifest; dependency-review adds GitHub Advisory diff on PR
changes.

### CI: CodeQL (`github/codeql-action`)

<!-- ci-tool: codeql -->

**Why chosen:** Scheduled and PR JavaScript/TypeScript analysis with `security-and-quality` queries
(`.github/workflows/codeql.yml`, [#13](https://github.com/osloer-industries/typescript-node-template/pull/13)).

**Alternatives considered:** Disable CodeQL on private repos pending license/GHAS
([ADR 0008](0008-codeql-on-private-repos.md)).

**Why they lost:** ADR 0008 is **proposed**; workflow remains until Thomas decides replacement (Semgrep CE,
GHAS, Sonar-only).

### CI: SonarQube Cloud scan action

<!-- ci-tool: sonarqube-scan-action -->

**Why chosen:** Optional Actions scanner when `SONAR_TOKEN` is set; complements SonarCloud GitHub App
(`.github/workflows/sonar.yml`, [docs/sonar-quality-gate.md](../sonar-quality-gate.md)).

**Alternatives considered:** SonarCloud automatic analysis only; drop Actions job.

**Why they lost:** Automatic analysis alone does not always match local `lint:sonarjs`; Actions job uploads
coverage LCOV when configured.

### CI: zizmor

<!-- ci-tool: zizmor -->

**Why chosen:** Static analysis for workflow supply-chain mistakes via org reusable
([ADR 0004](0004-workflow-security-zizmor-and-actionlint.md),
`zizmorcore/zizmor-action@v0.8.0`, `advanced-security: false`, fail closed).

**Alternatives considered:** poutine; octoscan.

**Why they lost:** Documented in ADR 0004 — overlap and duplicate baselines vs zizmor as primary.

### CI: actionlint

<!-- ci-tool: actionlint -->

**Why chosen:** Workflow syntax/semantics lint with **checksum-verified** install in org reusable
([ADR 0004](0004-workflow-security-zizmor-and-actionlint.md)).

**Alternatives considered:** Unpinned curl install; rely on GitHub’s workflow editor only.

**Why they lost:** Unpinned installs are supply-chain risk; editor does not catch all cross-job issues.

### CI: `npm audit` (Quality job)

<!-- ci-tool: npm-audit -->

**Why chosen:** High-severity production dependency audit in CI and documented in `AGENTS.md` after lockfile
changes.

**Alternatives considered:** OWASP Dependency-Check; no audit.

**Why they lost:** **Rationale not recorded, inferred:** `npm audit` is built into npm with zero extra
services for a template.
