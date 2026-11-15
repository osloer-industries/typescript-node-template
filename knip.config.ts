import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: [
        "src/index.ts",
        "scripts/fixture-vitest.config.ts",
        "scripts/**/*.{mjs,ts}",
        "scripts/**/*.d.mts",
      ],
      ignoreDependencies: ["@stryker-mutator/core", "@stryker-mutator/vitest-runner"],
      ignoreBinaries: ["stryker"],
      project: ["src/**/*.ts", "scripts/**/*.{ts,mjs,d.mts}"],
    },
    "packages/eslint-sonarjs": {
      entry: ["**/*.test.mjs"],
      project: ["**/*.{mjs,ts}"],
    },
  },
};

export default config;
