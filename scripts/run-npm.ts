import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export function npmExecutablePath(): string {
  const npmExecPath = process.env.npm_execpath;
  if (typeof npmExecPath === "string" && npmExecPath.length > 0 && existsSync(npmExecPath)) {
    return npmExecPath;
  }
  const adjacent = join(dirname(process.execPath), process.platform === "win32" ? "npm.cmd" : "npm");
  if (existsSync(adjacent)) return adjacent;
  throw new Error("Unable to locate npm without using PATH. Run via npm or install npm next to node.");
}

export function runNpm(args: readonly string[], options: ExecFileSyncOptions = {}): void {
  execFileSync(npmExecutablePath(), args, options);
}