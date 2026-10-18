import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.ts", "scripts/**/*.mjs"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "scripts/**/*.test.mjs",
        // CLI entry; covered by CI setup-smoke matrix jobs.
        "scripts/setup.mjs"
      ],
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 }
    }
  }
});
