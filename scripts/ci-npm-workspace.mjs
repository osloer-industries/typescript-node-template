#!/usr/bin/env node
import { parseArgs } from "node:util";
import { runNpm } from "./run-npm.mjs";

const { values } = parseArgs({
  options: {
    "install-eslint-sonarjs": { type: "boolean", default: false },
  },
});

runNpm(["ci", "--ignore-scripts"], { stdio: "inherit" });
if (values["install-eslint-sonarjs"]) {
  runNpm(["ci", "--ignore-scripts", "--prefix", "packages/eslint-sonarjs"], { stdio: "inherit" });
}