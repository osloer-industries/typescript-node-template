import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "scripts/**/*.test.mjs"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.ts", "scripts/setup-lib.mjs", "scripts/run-npm.mjs"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "scripts/**/*.test.ts", "scripts/**/*.test.mjs"],
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 }
    }
  }
});
