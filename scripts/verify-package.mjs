#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { runNpm } from "./run-npm.mjs";

/**
 * @param {import("node:fs").PathLike} [packageJsonPath]
 */
export function shouldVerifyPackage(packageJsonPath = "package.json") {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return Boolean(pkg.exports || pkg.bin);
}

/**
 * @param {{ runNpmFn?: typeof runNpm, packageJsonPath?: string, stdio?: import("node:child_process").StdioOptions }} [options]
 */
export function runVerifyPackage(options = {}) {
  const { runNpmFn = runNpm, packageJsonPath = "package.json", stdio = "inherit" } = options;
  if (!shouldVerifyPackage(packageJsonPath)) {
    return { skipped: true };
  }
  runNpmFn(["exec", "--", "publint", "."], { stdio });
  runNpmFn(["exec", "--", "attw", "--pack"], { stdio });
  return { skipped: false };
}

/* v8 ignore start */
if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  const result = runVerifyPackage();
  if (result.skipped) {
    console.log("Skipping package verification: no exports or bin entry in package.json.");
  }
}
/* v8 ignore stop */
