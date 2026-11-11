import { runNpm } from "../run-npm.mjs";
import { runAgentHookMain } from "./cli-entry.js";
import {
  HOOK_EXIT_BLOCK,
  HOOK_EXIT_OK,
  HOOK_EXIT_WARN,
  readHookInput,
  type HookExitCode,
} from "./hook-contract.js";

export type RunCheckFast = (cwd: string) => void;

export function defaultRunCheckFast(cwd: string): void {
  runNpm(["run", "check:fast"], { cwd, stdio: "pipe" });
}

function failureMessage(strike: number, detail: string): string {
  const trimmed = detail.trim();
  const body = trimmed.length > 0 ? trimmed : "check:fast failed (no output captured).";
  if (strike <= 0) {
    return (
      `Fast verification failed (strike 1). Run npm run check:fast and fix findings before stopping.\n${body}`
    );
  }
  return (
    `Fast verification failed again (strike 2+). Hand off to a human; npm run check is required before merge.\n${body}`
  );
}

export function evaluatePreStopFastCheck(
  fastCheckStrike: number,
  runCheckFast: RunCheckFast,
  cwd: string,
): { exitCode: HookExitCode; message: string } {
  try {
    runCheckFast(cwd);
    return { exitCode: HOOK_EXIT_OK, message: "check:fast passed." };
  } catch (error) {
    const detail = formatExecError(error);
    const exitCode = fastCheckStrike <= 0 ? HOOK_EXIT_WARN : HOOK_EXIT_BLOCK;
    return { exitCode, message: failureMessage(fastCheckStrike, detail) };
  }
}

function formatExecError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  let text = error.message;
  const stdout = Reflect.get(error, "stdout");
  const stderr = Reflect.get(error, "stderr");
  if (typeof stdout === "string" && stdout.length > 0) {
    text += `\n${stdout}`;
  }
  if (typeof stderr === "string" && stderr.length > 0) {
    text += `\n${stderr}`;
  }
  return text;
}

export async function runPreStopFastCheckCli(
  argv: readonly string[],
  runCheckFast: RunCheckFast = defaultRunCheckFast,
  cwd?: string,
): Promise<HookExitCode> {
  const input = await readHookInput(argv, { defaultForStop: true });
  const strike = input.fastCheckStrike ?? 0;
  const workdir = cwd ?? process.cwd();
  const result = evaluatePreStopFastCheck(strike, runCheckFast, workdir);
  if (result.exitCode === HOOK_EXIT_OK) {
    process.stdout.write(`${result.message}\n`);
  } else {
    process.stderr.write(`${result.message}\n`);
  }
  return result.exitCode;
}

await runAgentHookMain(import.meta.url, process.argv[1], runPreStopFastCheckCli);
