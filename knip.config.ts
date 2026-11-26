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
      // Invoked via `lint:deps` / `.dependency-cruiser.cjs` (spawn + swc parser), not static imports.
      ignoreDependencies: ["@swc/core", "dependency-cruiser"],
      project: ["src/**/*.ts", "scripts/**/*.{ts,mjs,d.mts}"],
    },
    "packages/eslint-sonarjs": {
      entry: ["**/*.test.mjs"],
      project: ["**/*.{mjs,ts}"],
    },
  },
};

export default config;
