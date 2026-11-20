import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const rootFiles = [
  "package.json",
  "package-lock.json",
  "tsconfig.build.json",
  ".oxlintrc.json",
  ".npmrc",
  ".nvmrc",
  ".node-version",
  ".markdownlint.json",
  ".markdownlint-cli2.jsonc",
  ".markdownlintignore",
  ".markdown-link-check.json",
  ".jscpd.json",
  "knip.config.ts",
  "lefthook.yml",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "README.md",
  "SECURITY.md",
  ".github/pull_request_template.md",
];

const docDirectories = ["docs"];

const agentsSkillsDir = ".agents/skills";

const agentsCheckPathStubs = ["scripts/setup.test.ts", "scripts/check-fleet-adoption-doc.ts"];

const agentsCheckSupportFiles = [
  ".github/dependabot.yml",
  ".github/agent-files.allow",
  "CODEOWNERS",
];

const jscpdFixturePaths = [
  "packages/eslint-sonarjs/README.md",
  ".github/pull_request_template.md",
  ".github/workflows/ci.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/pr-title.yml",
  ".github/workflows/release.yml",
];

const pathGroups = [
  rootFiles,
  agentsCheckSupportFiles,
  [
    "scripts/setup.mjs",
    "scripts/setup-lib.mjs",
    "scripts/setup-lib.d.mts",
    "scripts/run-npm.mjs",
    "scripts/run-npm.d.mts",
    "scripts/ci-npm-workspace.mjs",
    "scripts/run-sonar-coverage.mjs",
    "scripts/lint-sonarjs.mjs",
    "scripts/count-suppressions.ts",
    "scripts/oxlint-plugin-osloer.ts",
    "scripts/check-no-claude-md.ts",
    "scripts/agents-check.ts",
    "scripts/agents-check-patterns.mjs",
    "scripts/check-guardrail-changes.ts",
    "scripts/git-list-changed-paths.mjs",
    "scripts/suppression-baseline.json",
    "scripts/fixture-vitest.config.ts",
  ],
  ["src/index.ts", "src/index.test.ts"],
  [
    "packages/eslint-sonarjs/package.json",
    "packages/eslint-sonarjs/package-lock.json",
    "packages/eslint-sonarjs/eslint.config.mjs",
    "packages/eslint-sonarjs/sonarjs-rules.mjs",
    "packages/eslint-sonarjs/run.mjs",
    "packages/eslint-sonarjs/list-enabled-rules.mjs",
    "packages/eslint-sonarjs/list-enabled-rules.test.mjs",
    "packages/eslint-sonarjs/sonarjs-rules.test.mjs",
    "packages/eslint-sonarjs/run.test.mjs",
    "packages/eslint-sonarjs/tsconfig.json",
  ],
  jscpdFixturePaths,
];

/**
 * @param {string} repoRoot
 */
function buildFixtureTsconfig(repoRoot) {
  const base = JSON.parse(readFileSync(join(repoRoot, "tsconfig.json"), "utf8"));
  const compilerOptions = { ...base.compilerOptions };
  return `${JSON.stringify(
    {
      compilerOptions,
      include: ["src/**/*.ts", "scripts/**/*.ts", "scripts/**/*.d.ts", "vitest.config.ts"],
      exclude: ["dist", "coverage", "node_modules"],
    },
    null,
    2,
  )}\n`;
}

/**
 * @param {string} repoRoot
 * @param {string} targetDir
 */
export function copyTemplateFixture(repoRoot, targetDir) {
  writeFileSync(join(targetDir, "tsconfig.json"), buildFixtureTsconfig(repoRoot));
  cpSync(
    join(repoRoot, "scripts/fixture-vitest.config.ts"),
    join(targetDir, "vitest.config.ts"),
  );
  for (const relativeDir of docDirectories) {
    cpSync(join(repoRoot, relativeDir), join(targetDir, relativeDir), { recursive: true });
  }
  cpSync(join(repoRoot, agentsSkillsDir), join(targetDir, agentsSkillsDir), { recursive: true });
  cpSync(join(repoRoot, "scripts/agent-hooks"), join(targetDir, "scripts/agent-hooks"), {
    recursive: true,
  });
  for (const relativePath of agentsCheckPathStubs) {
    const destination = join(targetDir, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    const stubBody =
      relativePath === "scripts/setup.test.ts"
        ? "import { describe, expect, it } from \"vitest\";\n\nexport function agentsCheckPathStub(): boolean {\n  return true;\n}\n\ndescribe(\"agents-check cited setup tests\", () => {\n  it(\"keeps the cited path present for consumer fixtures\", () => {\n    expect(agentsCheckPathStub()).toBe(true);\n  });\n});\n"
        : "export function agentsCheckPathStub(): boolean {\n  return true;\n}\n";
    writeFileSync(destination, stubBody);
  }
  for (const relativePath of pathGroups.flat()) {
    const source = join(repoRoot, relativePath);
    const destination = join(targetDir, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
}
