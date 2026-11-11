import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Committed provider hook wiring (no policy text — see docs/agent-guard-hooks.md). */
export const PROVIDER_WIRING_RELATIVE_PATHS = [
  ".claude/settings.json",
  ".cursor/hooks.json",
  ".codex/hooks.json",
] as const;

export const BLOCK_GUARDRAIL_SCRIPT = "scripts/agent-hooks/block-guardrail-edits.ts";
export const PRE_STOP_SCRIPT = "scripts/agent-hooks/pre-stop-fast-check.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Walks provider JSON and collects command strings and exec-form `args`. */
export function collectHookCommandStrings(value: unknown, sink: string[]): void {
  if (typeof value === "string") {
    sink.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectHookCommandStrings(entry, sink);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  const command = value.command;
  if (typeof command === "string") {
    sink.push(command);
  }
  const args = value.args;
  if (Array.isArray(args)) {
    for (const arg of args) {
      if (typeof arg === "string") {
        sink.push(arg);
      }
    }
  }
  for (const child of Object.values(value)) {
    collectHookCommandStrings(child, sink);
  }
}

export function readProviderWiringJson(repoRoot: string, relativePath: string): unknown {
  const text = readFileSync(join(repoRoot, relativePath), "utf8");
  return JSON.parse(text);
}

export function wiringReferencesScript(commands: readonly string[], scriptSuffix: string): boolean {
  return commands.some((entry) => entry.includes(scriptSuffix));
}

export function assertProviderWiring(repoRoot: string): { relativePath: string; commands: string[] }[] {
  const reports: { relativePath: string; commands: string[] }[] = [];
  for (const relativePath of PROVIDER_WIRING_RELATIVE_PATHS) {
    const parsed = readProviderWiringJson(repoRoot, relativePath);
    const commands: string[] = [];
    collectHookCommandStrings(parsed, commands);
    if (!wiringReferencesScript(commands, BLOCK_GUARDRAIL_SCRIPT)) {
      throw new Error(`${relativePath} must invoke ${BLOCK_GUARDRAIL_SCRIPT}`);
    }
    if (!wiringReferencesScript(commands, PRE_STOP_SCRIPT)) {
      throw new Error(`${relativePath} must invoke ${PRE_STOP_SCRIPT}`);
    }
    reports.push({ relativePath, commands });
  }
  return reports;
}

export function repoRootFromAgentHooksModule(moduleUrl: string): string {
  return resolve(dirname(fileURLToPath(moduleUrl)), "../..");
}
