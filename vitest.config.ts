import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    isolate: true,
    fileParallelism: false,
    include: [
      "src/**/*.test.ts",
      "scripts/**/*.test.ts",
      "scripts/**/*.test.mjs",
      "packages/**/*.test.mjs",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: [
        "src/**/*.ts",
        "scripts/**/*.mjs",
        "packages/markdown-link-check/**/*.mjs",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "scripts/**/*.test.ts",
        "scripts/**/*.test.mjs",
        "scripts/test-mcp.mjs",
        "packages/**/*.test.mjs",
      ],
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
  },
});
