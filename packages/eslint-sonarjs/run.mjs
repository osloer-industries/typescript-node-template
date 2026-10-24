#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(pkgDir, "../..");
const requireFromPkg = createRequire(import.meta.url);
const eslintPackageRoot = path.dirname(requireFromPkg.resolve("eslint/package.json"));
const eslintBin = path.join(eslintPackageRoot, "bin/eslint.js");
const configPath = path.join(pkgDir, "eslint.config.mjs");

const userArgs = process.argv.slice(2);
const targets =
  userArgs.length > 0
    ? userArgs
    : ["src", "scripts", "packages/markdown-link-check", "packages/eslint-sonarjs"];

const result = spawnSync(
  process.execPath,
  [eslintBin, "-c", configPath, ...targets],
  { cwd: repoRoot, stdio: "inherit" },
);

process.exit(result.status ?? 1);
