import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const fixtureTsconfig = `${JSON.stringify(
  {
    compilerOptions: {
      target: "ES2023",
      lib: ["ES2023"],
      module: "NodeNext",
      moduleResolution: "NodeNext",
      rootDir: ".",
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
      skipLibCheck: true,
      noEmit: true,
      types: ["node", "vitest/globals"],
    },
    include: ["src/**/*.ts", "scripts/**/*.ts", "scripts/**/*.d.ts", "vitest.config.ts"],
    exclude: ["dist", "coverage", "node_modules"],
  },
  null,
  2,
)}\n`;

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
  "tsconfig.build.json",
  ".oxlintrc.json",
  ".npmrc",
  ".nvmrc",
  ".node-version",
  ".markdownlint.json",
  ".markdownlint-cli2.jsonc",
  ".markdownlintignore",
  ".markdown-link-check.json"
];

const pathGroups = [
  rootFiles,
  [
    "scripts/setup.mjs",
    "scripts/setup-lib.mjs",
    "scripts/setup-lib.d.mts",
    "scripts/run-npm.mjs",
    "scripts/run-npm.d.mts"
  ],
  ["src/index.ts", "src/index.test.ts"],
  [
    "packages/markdown-link-check/package.json",
    "packages/markdown-link-check/index.mjs",
    "packages/markdown-link-check/check-repo.mjs",
    "packages/markdown-link-check/ambient.d.ts",
  ],
];

/**
 * @param {string} repoRoot
 * @param {string} targetDir
 */
export function copyTemplateFixture(repoRoot, targetDir) {
  writeFileSync(join(targetDir, "tsconfig.json"), fixtureTsconfig);
  writeFileSync(join(targetDir, "vitest.config.ts"), fixtureVitestConfig);
  for (const relativePath of pathGroups.flat()) {
    const source = join(repoRoot, relativePath);
    const destination = join(targetDir, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
}
