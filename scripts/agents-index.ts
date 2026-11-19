import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Thin entry so `npm run agents:index` avoids duplicating skills index logic. */
export function runAgentsIndexWrapper(moduleUrl: string): number {
  const checkScript = join(dirname(fileURLToPath(moduleUrl)), "agents-check.ts");
  const result = spawnSync(process.execPath, [checkScript, "index"], {
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) {
    return false;
  }
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  process.exitCode = runAgentsIndexWrapper(import.meta.url);
}