# SonarCloud quality gate

Tooling rationale for Oxlint, SonarJS, Vitest, and CI integrations:
[ADR 0009](adr/0009-tooling-and-quality-gate-stack.md).

This template uses **CI Sonar analysis plus a zero-open-issues gate**:

| Check | Source | Typical behavior |
| --- | --- | --- |
| **CI / Analyze** | `.github/workflows/ci.yml` → org `sonarqube-cloud-node.yml` | Runs `npm run coverage:sonar` (nested `packages/eslint-sonarjs` install, then `test:coverage`), uploads analysis and **coverage** (`coverage/lcov.info`) via `sonar-project.properties`. Requires `SONAR_TOKEN`. |
| **CI / SonarCloud zero open issues** | `.github/workflows/ci.yml` → org `sonarcloud-zero-issues.yml` | **Pull requests only** (job `if:`). After CI analysis, polls SonarCloud and fails when open issues remain on the PR head commit. Pushes to `main` still upload analysis via **CI / Analyze**; the zero-issues job is skipped and **`ci-passed`** treats that skip as success (`scripts/ci-passed-gate.ts` org standard). |

**Disable SonarCloud Automatic Analysis** on every repository generated from this template. Automatic Analysis
and `SonarSource/sonarqube-scan-action` cannot run on the same project. Fix findings on the PR diff or adjust
Sonar project settings deliberately—not by disabling gates without team approval.

## Local enforcement (shift left)

Sonar-style JavaScript and TypeScript rules run locally via **`eslint-plugin-sonarjs`** in
[`packages/eslint-sonarjs/`](../packages/eslint-sonarjs/) (`npm run lint:sonarjs`, included in `npm run check`;
[ADR 0009](adr/0009-tooling-and-quality-gate-stack.md)).

**Oxlint `jsPlugins` + `eslint-plugin-sonarjs` was evaluated** (including Oxlint 1.89.x). Loading the plugin
fails while the template uses **TypeScript 7** at the repo root: rule modules pull in `ts-api-utils`, which
requires the TypeScript 6 compiler API (`TypeFlags.Intrinsic` is unavailable under TS 7). npm `overrides` do
not isolate that resolution for Oxlint’s plugin loader. Oxlint also documents that **JS plugin rules cannot
use TypeScript type-aware analysis yet**; several SonarJS rules would remain uncovered even if load succeeded.

ESLint therefore runs in **`packages/eslint-sonarjs/`**, which pins **TypeScript 6** for
`typescript-eslint` while the root keeps **TypeScript 7** for `tsc`. Dependabot ignores **major** `typescript`
bumps in that directory until typescript-eslint supports TypeScript 7.x (blocked on TypeScript 7.1’s
programmatic API; see [typescript-eslint#12518](https://github.com/typescript-eslint/typescript-eslint/issues/12518)).
The nested package is subject to
the same gates as the rest of the template (Oxlint, `tsc`, Vitest coverage, Dependabot, and `npm audit`). It
lints `src/`, `scripts/`, and `packages/*` using `eslint-plugin-sonarjs` **`recommended`** with every
enabled rule at **error** severity, plus explicit SonarCloud parity rules (`no-await-in-loop` / S9382,
`@typescript-eslint/require-await` / S7503, `sonarjs/no-duplicate-string`, and related shift-left rules).

List enabled rules:

```sh
npm run list-rules --prefix packages/eslint-sonarjs
```

Pre-commit (after `npm run prepare`): Lefthook ([ADR 0009](adr/0009-tooling-and-quality-gate-stack.md)) runs
**`npm run precommit`** (Oxlint, suppression baseline, SonarJS ESLint, jscpd on TypeScript/JavaScript and
docs at 3%, typecheck, and Vitest).
CI **Quality** runs the same command so `--no-verify` commits still fail in Actions.

## Before you push

1. Run `npm run precommit` before every push; run `npm run check` before opening a pull request.
2. Avoid new **security** hotspots called out below (they often fail **Security Rating on New Code**).
3. After pushing, open the SonarCloud PR link from the failed/successful check if you need line-level rules.

## Required patterns in this repo

### Invoke npm without PATH lookup

Sonar flags `execFileSync("npm", …)` and similar because `npm` is resolved via **`PATH`**.

Use [`scripts/run-npm.mjs`](../scripts/run-npm.mjs):

- `npmExecutablePath()` — prefers `process.env.npm_execpath`, then `npm` adjacent to `process.execPath`
- `runNpm(args, options)` — wrapper around `execFileSync`

Do not call `"npm"` as the executable string in new `scripts/` or `src/` code.

### npm install / ci in GitHub Actions

Sonar flags bare `npm ci` / `npm install` without **`--ignore-scripts`** when lifecycle scripts are not required.

This template’s root `package.json` has a **`prepare`** script (Lefthook) that must not run in CI. Always use:

```yaml
- run: npm ci --ignore-scripts
```

In setup code, prefer:

```javascript
runNpm(["install", "--save-exact", "--ignore-scripts"], { cwd: baseDir, stdio: "inherit" });
```

If a dependency truly needs install scripts, document why and scope the exception (single step or package),
do not enable scripts globally “just in case”.

### Tests and lint

- Vitest **`toThrow()`** must include a message or regex (Oxlint `vitest/require-to-throw-message`).
- Keep cyclomatic complexity, promise safety, and import-cycle rules in
  [`.oxlintrc.json`](../.oxlintrc.json)—they reduce correctness issues Sonar may also report.
- Avoid copy-pasted blocks in source and docs; `npm run lint:dup` (jscpd) enforces the same **3%**
  duplication threshold as SonarCloud duplicated-lines-on-new-code on TypeScript, JavaScript, Markdown,
  workflow YAML, and shell under `.jscpd.json`. SonarCloud still runs on the pull request for duplicated-lines-on-new-code,
  org zero-open-issues, and other Sonar rules — refactor shared helpers instead of copying blocks. Lefthook runs
  `lint:dup` via **`npm run precommit`** on every commit.

## Change checklist (agents and humans)

When adding or changing:

| Area | Do |
| --- | --- |
| Child processes | Use `runNpm` or an absolute tool path; never bare `"npm"` / `"node"` from PATH for security-sensitive setup |
| CI install steps | Add `--ignore-scripts` unless lifecycle scripts are required |
| Setup CLI | Reuse `setup-lib.mjs` + existing verify flags; run post-setup checks via `runNpm` |
| New dependencies | `npm install --save-exact`, commit lockfile, `npm audit --omit=dev` |

## Sonar configuration

See [README.md](../README.md#sonarqube-cloud-setup) for organization/project keys, organization **`SONAR_TOKEN`**,
and turning **Automatic Analysis off** in favor of CI analysis.

Analysis scope is defined in [`sonar-project.properties`](../sonar-project.properties) (`src`, `scripts`, test
inclusions/exclusions, and `sonar.javascript.lcov.reportPaths=coverage/lcov.info`). The Sonar job runs
`npm run coverage:sonar` before scan (same Vitest coverage as `test:coverage` after nested install).
`CI / Quality` and local `npm run check` still run the same coverage gate.
