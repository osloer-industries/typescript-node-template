import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const fixtureVitestConfig = `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 }
    }
  }
});
`;

const rootFiles = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.build.json",
  ".oxlintrc.json",
  ".npmrc",
  ".nvmrc",
  ".node-version"
];

const pathGroups = [
  rootFiles,
  ["scripts/setup.mjs", "scripts/setup-lib.mjs", "scripts/setup-lib.d.mts", "scripts/run-npm.mjs", "scripts/run-npm.d.mts"],
  ["src/index.ts", "src/index.test.ts"]
];

/**
 * @param {string} repoRoot
 * @param {string} targetDir
 */
export function copyTemplateFixture(repoRoot, targetDir) {
  writeFileSync(join(targetDir, "vitest.config.ts"), fixtureVitestConfig);
  for (const relativePath of pathGroups.flat()) {
    const source = join(repoRoot, relativePath);
    const destination = join(targetDir, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
}
