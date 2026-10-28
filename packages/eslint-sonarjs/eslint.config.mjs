// Tooling rationale: ADR 0009 (../../docs/adr/0009-tooling-and-quality-gate-stack.md)
import path from "node:path";
import { fileURLToPath } from "node:url";

import tsParser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const recommended = sonarjs.configs.recommended;

const tsFiles = ["src/**/*.ts", "scripts/**/*.ts"];
const jsFiles = ["scripts/**/*.mjs", "packages/**/*.mjs"];

export default [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  {
    name: recommended.name ?? "sonarjs/recommended",
    files: tsFiles,
    plugins: recommended.plugins ?? {},
    rules: recommended.rules ?? {},
    settings: recommended.settings ?? {},
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: repoRoot,
      },
    },
  },
  {
    name: recommended.name ?? "sonarjs/recommended-js",
    files: jsFiles,
    plugins: recommended.plugins ?? {},
    rules: recommended.rules ?? {},
    settings: recommended.settings ?? {},
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
];
