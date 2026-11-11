import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

/** Agent hook scripts live under `scripts/agent-hooks/`; repo root is two levels up. */
export function repoRootFromAgentHook(moduleUrl: string): string {
  return resolve(dirname(fileURLToPath(moduleUrl)), "../..");
}

export async function runAgentHookMain(
  moduleUrl: string,
  argvEntry: string | undefined,
  run: (argv: readonly string[]) => Promise<number>,
): Promise<void> {
  if (!isDirectExecution(moduleUrl, argvEntry)) {
    return;
  }
  process.chdir(repoRootFromAgentHook(moduleUrl));
  process.exitCode = await run(process.argv.slice(2));
}
