/**
 * Stryker mutation testing for `src/`. TypeScript 7 removes `parseConfigFileTextToJson`,
 * which @stryker-mutator/core calls when rewriting tsconfig paths in its sandbox; point
 * `tsconfigFile` at a missing file so the preprocessor skips that step (no path rewrites needed).
 * See https://github.com/stryker-mutator/stryker-js/issues/6110
 */
export default {
  packageManager: "npm",
  testRunner: "vitest",
  plugins: ["@stryker-mutator/vitest-runner"],
  reporters: ["clear-text", "progress"],
  tsconfigFile: ".stryker-tsconfig-intentionally-missing.json",
  mutate: ["src/**/*.ts", "!src/**/*.test.ts"],
  thresholds: { high: 90, low: 80, break: 80 },
  vitest: {
    configFile: "vitest.config.ts",
  },
};
