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
  "lefthook.yml",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "README.md",
  "SECURITY.md",
];

const docFiles = ["docs/architecture.md", "docs/sonar-quality-gate.md"];

const pathGroups = [
  rootFiles,
  docFiles,
  [
    "scripts/setup.mjs",
    "scripts/setup-lib.mjs",
    "scripts/setup-lib.d.mts",
    "scripts/run-npm.mjs",
    "scripts/run-npm.d.mts",
    "scripts/lint-sonarjs.mjs",
    "scripts/count-suppressions.ts",
    "scripts/suppression-baseline.json",
  ],
  ["src/index.ts", "src/index.test.ts"],
  [
    "packages/eslint-sonarjs/package.json",
    "packages/eslint-sonarjs/package-lock.json",
    "packages/eslint-sonarjs/eslint.config.mjs",
    "packages/eslint-sonarjs/run.mjs",
    "packages/eslint-sonarjs/list-enabled-rules.mjs",
    "packages/eslint-sonarjs/tsconfig.json",
  ],
];

/**
 * @param {string} repoRoot
 */
export function buildFixtureTsconfig(repoRoot) {
  const base = JSON.parse(readFileSync(join(repoRoot, "tsconfig.json"), "utf8"));
  const compilerOptions = { ...base.compilerOptions };
  delete compilerOptions.allowJs;
  delete compilerOptions.checkJs;
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
  for (const relativePath of pathGroups.flat()) {
    const source = join(repoRoot, relativePath);
    const destination = join(targetDir, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
}
