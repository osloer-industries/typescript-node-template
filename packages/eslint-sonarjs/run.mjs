#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(pkgDir, "../..");
const requireFromPkg = createRequire(import.meta.url);
const eslintPackageJsonPath = requireFromPkg.resolve("eslint/package.json");

/** @param {readonly string[]} userArgs */
export function resolveLintTargets(userArgs) {
  if (userArgs.length > 0) {
    return [...userArgs];
  }
  return ["src", "scripts", "packages/eslint-sonarjs"];
}

export function resolveEslintBin() {
  const eslintPackageRoot = path.dirname(eslintPackageJsonPath);
  return path.join(eslintPackageRoot, "bin/eslint.js");
}

export function resolveConfigPath() {
  return path.join(pkgDir, "eslint.config.mjs");
}

/**
 * @param {readonly string[]} userArgs
 * @param {{ cwd?: string, eslintBin?: string, configPath?: string, execPath?: string }} [options]
 */
export function runEslintSonarjs(userArgs, options = {}) {
  const eslintBin = options.eslintBin ?? resolveEslintBin();
  const configPath = options.configPath ?? resolveConfigPath();
  const cwd = options.cwd ?? repoRoot;
  const execPath = options.execPath ?? process.execPath;
  const targets = resolveLintTargets(userArgs);
  return spawnSync(execPath, [eslintBin, "-c", configPath, ...targets], { cwd, stdio: "inherit" });
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const result = runEslintSonarjs(process.argv.slice(2));
  process.exit(result.status ?? 1);
}
