#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import { runNpm } from "./run-npm.ts";

const ESLINT_SONARJS_PREFIX = "packages/eslint-sonarjs";

export interface RunCiNpmWorkspaceOptions {
  runInstall?: typeof runNpm;
  installEslintSonarjs?: boolean;
  skipRootCi?: boolean;
}

export function runCiNpmWorkspace(options: RunCiNpmWorkspaceOptions = {}): void {
  const runInstall = options.runInstall ?? runNpm;
  const installEslintSonarjs = options.installEslintSonarjs ?? false;
  const skipRootCi = options.skipRootCi ?? false;

  if (!skipRootCi) {
    runInstall(["ci", "--ignore-scripts"], { stdio: "inherit" });
  }
  if (installEslintSonarjs) {
    runInstall(["ci", "--ignore-scripts", "--prefix", ESLINT_SONARJS_PREFIX], { stdio: "inherit" });
  }
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const { values } = parseArgs({
    options: {
      "install-eslint-sonarjs": { type: "boolean", default: false },
      "skip-root-ci": { type: "boolean", default: false },
    },
  });
  runCiNpmWorkspace({
    installEslintSonarjs: values["install-eslint-sonarjs"],
    skipRootCi: values["skip-root-ci"],
  });
}