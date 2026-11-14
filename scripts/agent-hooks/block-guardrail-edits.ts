import { findGuardrailChanges } from "../check-guardrail-changes.js";
import { runAgentHookMain } from "./cli-entry.js";
import {
  HOOK_EXIT_BLOCK,
  HOOK_EXIT_OK,
  readHookInput,
  type HookExitCode,
} from "./hook-contract.js";

export function evaluateBlockGuardrailEdits(paths: readonly string[]): {
  exitCode: HookExitCode;
  message: string;
} {
  const normalized = paths.map((entry) => entry.replaceAll("\\", "/").trim()).filter(Boolean);
  const blocked = findGuardrailChanges(normalized);
  if (blocked.length === 0) {
    return { exitCode: HOOK_EXIT_OK, message: "No guardrail path edits in this batch." };
  }
  const list = blocked.join(", ");
  return {
    exitCode: HOOK_EXIT_BLOCK,
    message:
      `Blocked agent edit to guardrail path(s): ${list}. ` +
      "Harness changes require human review (see CODEOWNERS and AGENTS.md).",
  };
}

export async function runBlockGuardrailEditsCli(argv: readonly string[]): Promise<HookExitCode> {
  const input = await readHookInput(argv);
  const paths = input.paths ?? [];
  if (paths.length === 0) {
    process.stderr.write("block-guardrail-edits: no paths provided (stdin.paths or --paths).\n");
    return HOOK_EXIT_OK;
  }
  const result = evaluateBlockGuardrailEdits(paths);
  if (result.exitCode === HOOK_EXIT_OK) {
    process.stdout.write(`${result.message}\n`);
  } else {
    process.stderr.write(`${result.message}\n`);
  }
  return result.exitCode;
}

await runAgentHookMain(import.meta.url, process.argv[1], runBlockGuardrailEditsCli);
