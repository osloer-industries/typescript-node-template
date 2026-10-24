import { defineConfig } from "vitest/config";

/** Minimal Vitest coverage config for setup integration fixtures (src-only). */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
  },
});
