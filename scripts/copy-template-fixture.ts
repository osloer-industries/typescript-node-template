import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { listJsPathsOnDisk } from "./list-untyped-js-on-disk.mjs";

function writeFixtureJsAllowlist(targetDir: string): void {
  const paths = listJsPathsOnDisk(targetDir).toSorted((a, b) => a.localeCompare(b));
  mkdirSync(join(targetDir, "quality"), { recursive: true });
  writeFileSync(
    join(targetDir, "quality/js-allowlist.json"),
    `${JSON.stringify({ version: 1, paths }, null, 2)}\n`,
    "utf8",
  );
}

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
] as const;

const docDirectories = ["docs"] as const;

const agentsSkillsDir = ".agents/skills";
const agentsCheckPathStubs = [
  "scripts/setup.test.ts",
  "scripts/check-fleet-adoption-doc.ts",
  "scripts/journey.e2e.test.ts",
] as const;

const agentsCheckSupportFiles = [
  ".github/dependabot.yml",
  ".github/agent-files.allow",
  "CODEOWNERS",
] as const;

const jscpdFixturePaths = [
  "packages/eslint-sonarjs/README.md",
  ".github/pull_request_template.md",
  ".github/workflows/ci.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/pr-title.yml",
  ".github/workflows/release.yml",
  ".github/workflows/auto-merge.yml",
] as const;

const pathGroups: readonly (readonly string[])[] = [
  rootFiles,
  agentsCheckSupportFiles,
  [
    "scripts/setup.mjs",
    "scripts/setup-lib.mjs",
    "scripts/setup-lib.d.mts",
    "scripts/run-npm.ts",
    "scripts/ci-npm-workspace.ts",
    "scripts/run-sonar-coverage.ts",
    "scripts/lint-sonarjs.mjs",
    "scripts/count-suppressions.ts",
    "scripts/check-ts-only.ts",
    "scripts/shrink-only-ratchet.ts",
    "scripts/list-untyped-js-on-disk.mjs",
    "quality/js-allowlist.json",
    "scripts/oxlint-plugin-osloer.ts",
    "scripts/check-no-claude-md.ts",
    "scripts/agents-check.ts",
    "scripts/agents-check-patterns.mjs",
    "scripts/check-guardrail-changes.ts",
    "scripts/git-list-changed-paths.ts",
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

function buildFixtureTsconfig(repoRoot: string): string {
  const base: { compilerOptions: Record<string, unknown> } = JSON.parse(
    readFileSync(join(repoRoot, "tsconfig.json"), "utf8"),
  );
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

export function copyTemplateFixture(repoRoot: string, targetDir: string): void {
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
    let stubBody = "export function agentsCheckPathStub(): boolean {\n  return true;\n}\n";
    if (relativePath === "scripts/setup.test.ts") {
      stubBody =
        "import { describe, expect, it } from \"vitest\";\n\nexport function agentsCheckPathStub(): boolean {\n  return true;\n}\n\ndescribe(\"agents-check cited setup tests\", () => {\n  it(\"keeps the cited path present for consumer fixtures\", () => {\n    expect(agentsCheckPathStub()).toBe(true);\n  });\n});\n";
    } else if (relativePath === "scripts/journey.e2e.test.ts") {
      stubBody =
        "import { describe, expect, it } from \"vitest\";\n\nexport function journeyE2ePathStub(): boolean {\n  return true;\n}\n\ndescribe(\"agents-check cited journey e2e\", () => {\n  it(\"keeps the cited path present for consumer fixtures\", () => {\n    expect(journeyE2ePathStub()).toBe(true);\n  });\n});\n";
    }
    writeFileSync(destination, stubBody);
  }
  for (const relativePath of pathGroups.flat()) {
    const source = join(repoRoot, relativePath);
    const destination = join(targetDir, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
  writeFixtureJsAllowlist(targetDir);
}