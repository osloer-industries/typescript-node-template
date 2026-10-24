import path from "node:path";
import { fileURLToPath } from "node:url";

import tsParser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

const tsFiles = ["src/**/*.ts", "scripts/**/*.ts"];
const jsFiles = ["scripts/**/*.mjs", "packages/**/*.mjs"];

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  {
    ...sonarjs.configs.recommended,
    files: tsFiles,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: repoRoot,
      },
    },
  },
  {
    ...sonarjs.configs.recommended,
    files: jsFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
];
