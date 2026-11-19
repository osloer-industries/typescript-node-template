#!/usr/bin/env node
/**
 * Prints the fleet adoption matrix skeleton (rows × columns) for manual verification.
 * The checked-in docs/fleet-adoption.md is the source of truth; this script is not run in CI.
 */

const FEATURE_ROWS = [
  "workflow-security.yml",
  "codeql-javascript-typescript.yml",
  "node-npm-quality.yml (or equivalent CI quality)",
  "mutation-changed.yml / template mutation job",
  "node-setup-smoke.yml",
  "sonarqube-cloud-node.yml",
  "sonarcloud-zero-issues.yml + ci-passed PR-only contract",
  "ci-passed.yml aggregate",
  "semantic-pull-request.yml",
  "dependency-review.yml (or GHAS-free local gate)",
  "release-please.yml",
  "auto-merge.yml",
  "Dependabot (osloer-reusables group)",
  "lefthook.yml + npm run prepare",
  "jscpd (.jscpd.json / lint:dup)",
  "e2e / domain CI suite",
] as const;

const REPO_COLUMNS = [
  "typescript-node-template",
  "lunch-money",
  "lunch-money-de-invest-sync",
  "vakt",
  "homeexchange-mcp",
  "coast-fire-visualizer",
  "markdown-link-check",
  "osloer-industries/.github",
  "expat-finance-hub",
] as const;

const header = ["Feature", ...REPO_COLUMNS].join(" | ");
const separator = ["---", ...REPO_COLUMNS.map(() => "---")].join(" | ");

process.stdout.write(
  [
    "# Fleet adoption matrix scaffold",
    "",
    `Generated: ${new Date().toISOString().slice(0, 10)} (re-verify against default branches)`,
    "",
    header,
    separator,
    ...FEATURE_ROWS.map((row) => [row, ...REPO_COLUMNS.map(() => "TBD")].join(" | ")),
    "",
    "Copy cells into docs/fleet-adoption.md after verifying each repository.",
    "",
  ].join("\n"),
);