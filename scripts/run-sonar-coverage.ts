#!/usr/bin/env node
// Tooling rationale: ADR 0009 (docs/adr/0009-tooling-and-quality-gate-stack.md)
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { runCiNpmWorkspace } from "./ci-npm-workspace.ts";
import { runNpm } from "./run-npm.ts";

/** Coverage for org `sonarqube-cloud-node.yml` after root `npm ci` (nested eslint-sonarjs only). */
export interface RunSonarCoverageOptions {
  runInstall?: typeof runNpm;
}

export function runSonarCoverage(options: RunSonarCoverageOptions = {}): void {
  const runInstall = options.runInstall ?? runNpm;
  runCiNpmWorkspace({
    runInstall,
    skipRootCi: true,
    installEslintSonarjs: true,
  });
  runInstall(["run", "test:coverage"], { stdio: "inherit" });
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  runSonarCoverage();
}