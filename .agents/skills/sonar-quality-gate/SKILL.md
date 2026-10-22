---
name: sonar-quality-gate
description: Avoid SonarCloud quality gate failures on Node/TypeScript changes—PATH-safe npm, CI install flags, and template-specific checks. Use when editing scripts/setup, CI workflows, child_process, or when a PR fails SonarCloud Code Analysis.
---

# SonarCloud quality gate (typescript-node-template)

Apply this skill when changing JavaScript/TypeScript, `scripts/`, or GitHub Actions in this repository, or
when **SonarCloud Code Analysis** fails on a pull request.

## Quick rules

1. **Never** use `execFileSync("npm", …)` or `spawn("npm", …)`. Use `runNpm` from `scripts/run-npm.mjs`
   (absolute npm path via `npm_execpath` or next to `node`).
2. **CI / setup installs**: use `npm ci --ignore-scripts` or `npm install --save-exact --ignore-scripts`
   unless a documented lifecycle script is required.
3. Run **`npm run check`** before finishing; fix Oxlint/Vitest issues (including `toThrow` with a message/regex).
4. Remember **SonarCloud app** quality gate ≠ green **SonarQube Cloud / Analyze** workflow when `SONAR_TOKEN` is unset.

## Workflow

1. Read the failing SonarCloud PR dashboard link from the GitHub check.
2. Filter to **new code** / security findings on changed lines.
3. Map findings to this repo:
   - PATH / command injection style → switch to `runNpm`.
   - npm lifecycle / supply chain → add `--ignore-scripts` or narrow the exception.
4. Re-run `npm run check` and push.

## Canonical reference

Full checklist and context: [docs/sonar-quality-gate.md](../../../docs/sonar-quality-gate.md)

Implementation reference: [scripts/run-npm.mjs](../../../scripts/run-npm.mjs),
[scripts/setup-lib.mjs](../../../scripts/setup-lib.mjs),
[.github/workflows/ci.yml](../../../.github/workflows/ci.yml).
