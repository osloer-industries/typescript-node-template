import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/** Neutral hook events consumed by vakt when rendering provider wiring (see vakt#144). */
export const NEUTRAL_HOOK_EVENTS = ["preEdit", "stop"] as const;

export type NeutralHookEvent = (typeof NEUTRAL_HOOK_EVENTS)[number];

export type HooksManifest = Record<NeutralHookEvent, string>;

const NEUTRAL_HOOK_EVENT_SET = new Set<string>(NEUTRAL_HOOK_EVENTS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseScriptPath(value: unknown, field: NeutralHookEvent): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`hooks.json field "${field}" must be a non-empty script path.`);
  }
  const path = value.trim();
  if (!path.startsWith("scripts/agent-hooks/")) {
    throw new Error(`hooks.json field "${field}" must point under scripts/agent-hooks/.`);
  }
  if (!path.endsWith(".ts")) {
    throw new Error(`hooks.json field "${field}" must reference a TypeScript script (.ts).`);
  }
  return path;
}

export function parseHooksManifestJson(text: string): HooksManifest {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("hooks.json must not be empty.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("hooks.json must be valid JSON.");
  }
  if (!isRecord(parsed)) {
    throw new Error("hooks.json must be a JSON object.");
  }
  const keys = Object.keys(parsed);
  for (const key of keys) {
    if (!NEUTRAL_HOOK_EVENT_SET.has(key)) {
      throw new Error(`hooks.json has unknown field "${key}".`);
    }
  }
  for (const field of NEUTRAL_HOOK_EVENTS) {
    if (!(field in parsed)) {
      throw new Error(`hooks.json is missing required field "${field}".`);
    }
  }
  return {
    preEdit: parseScriptPath(parsed.preEdit, "preEdit"),
    stop: parseScriptPath(parsed.stop, "stop"),
  };
}

export function validateHooksManifestOnDisk(repoRoot: string, manifest: HooksManifest): void {
  for (const field of NEUTRAL_HOOK_EVENTS) {
    const scriptPath = manifest[field];
    const absolute = resolve(repoRoot, scriptPath);
    if (!existsSync(absolute)) {
      throw new Error(`hooks.json "${field}" script not found: ${scriptPath}`);
    }
  }
}

export const DEFAULT_HOOKS_MANIFEST_RELATIVE = join("scripts", "agent-hooks", "hooks.json");