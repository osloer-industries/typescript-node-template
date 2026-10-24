#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runNpm } from "./run-npm.mjs";

const pkgDir = path.resolve(fileURLToPath(new URL("../packages/eslint-sonarjs", import.meta.url)));
const marker = path.join(pkgDir, "node_modules", "eslint", "package.json");

if (!existsSync(marker)) {
  runNpm(["ci", "--ignore-scripts"], { cwd: pkgDir, stdio: "inherit" });
}

const eslintRun = spawnSync(process.execPath, ["run.mjs", ...process.argv.slice(2)], {
  cwd: pkgDir,
  stdio: "inherit",
});
process.exit(eslintRun.status ?? 1);
