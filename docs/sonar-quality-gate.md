# SonarCloud quality gate

This template often has **two Sonar integrations**:

| Check | Source | Typical behavior |
| --- | --- | --- |
| **SonarCloud Code Analysis** | SonarCloud GitHub App (automatic analysis) | Enforces the **quality gate** on new/changed code; this check can fail the PR. |
| **SonarQube Cloud / Analyze** | `.github/workflows/sonar.yml` | Runs only when `SONAR_TOKEN` is set; otherwise skips and reports success. |

A green Actions Sonar job does **not** guarantee a green **SonarCloud Code Analysis** check. Fix findings on the PR diff or adjust Sonar project settings deliberately—not by disabling gates without team approval.

## Before you push

1. Run `npm run check` locally.
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

This template’s root `package.json` has **no** `preinstall` / `postinstall` scripts. Prefer:

```yaml
- run: npm ci --ignore-scripts
```

In setup code, prefer:

```javascript
runNpm(["install", "--save-exact", "--ignore-scripts"], { cwd: baseDir, stdio: "inherit" });
```

If a dependency truly needs install scripts, document why and scope the exception (single step or package), do not enable scripts globally “just in case”.

### Tests and lint

- Vitest **`toThrow()`** must include a message or regex (Oxlint `vitest/require-to-throw-message`).
- Keep cyclomatic complexity, promise safety, and import-cycle rules in [`.oxlintrc.json`](../.oxlintrc.json)—they reduce correctness issues Sonar may also report.

## Change checklist (agents and humans)

When adding or changing:

| Area | Do |
| --- | --- |
| Child processes | Use `runNpm` or an absolute tool path; never bare `"npm"` / `"node"` from PATH for security-sensitive setup |
| CI install steps | Add `--ignore-scripts` unless lifecycle scripts are required |
| Setup CLI | Reuse `setup-lib.mjs` + existing verify flags; run post-setup checks via `runNpm` |
| New dependencies | `npm install --save-exact`, commit lockfile, `npm audit --omit=dev` |

## Sonar configuration

See [README.md](../README.md#sonarqube-cloud-setup) for organization/project keys, `SONAR_TOKEN`, and disabling **Automatic Analysis** when using the Actions scanner exclusively.

Analysis scope is defined in [`sonar-project.properties`](../sonar-project.properties) (`src`, `scripts`, test inclusions/exclusions).

## Optional skill

For Cursor and other agents, copy or symlink [`skills/sonar-quality-gate/SKILL.md`](../skills/sonar-quality-gate/SKILL.md) into your environment’s skills directory so the same rules load automatically outside this file.
