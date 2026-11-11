import { relative, resolve } from "node:path";
import type { HookInput } from "./hook-contract.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSeparators(path: string): string {
  return path.replaceAll("\\", "/");
}

/** Workspace root for relative-path normalization (provider payloads use absolute paths). */
export function resolveWorkspaceRoot(payload: Record<string, unknown>, fallbackCwd: string): string {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return resolve(fromEnv.trim());
  }
  const roots = payload.workspace_roots;
  if (Array.isArray(roots)) {
    for (const entry of roots) {
      if (typeof entry === "string" && entry.trim().length > 0) {
        return resolve(entry.trim());
      }
    }
  }
  const cwd = payload.cwd;
  if (typeof cwd === "string" && cwd.trim().length > 0) {
    return resolve(cwd.trim());
  }
  return resolve(fallbackCwd);
}

export function toRepoRelativePath(workspaceRoot: string, filePath: string): string {
  const absolute = resolve(workspaceRoot, filePath);
  const root = resolve(workspaceRoot);
  const rel = relative(root, absolute);
  const normalized = normalizeSeparators(rel);
  if (normalized.length === 0 || normalized === ".") {
    return normalizeSeparators(filePath).replace(/^\.\//, "");
  }
  if (!normalized.startsWith("..")) {
    return normalized;
  }
  const tail = normalizeSeparators(filePath);
  const markers = ["/AGENTS.md", "/CODEOWNERS", "/.github/", "/.oxlintrc.json", "/lefthook.yml"];
  for (const marker of markers) {
    const index = tail.indexOf(marker);
    if (index >= 0) {
      return tail.slice(index + 1);
    }
  }
  return tail.replace(/^\/+/, "");
}

function pushPath(paths: string[], workspaceRoot: string, raw: unknown): void {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return;
  }
  paths.push(toRepoRelativePath(workspaceRoot, raw.trim()));
}

function pathsFromToolInput(toolInput: Record<string, unknown>, workspaceRoot: string): string[] {
  const paths: string[] = [];
  pushPath(paths, workspaceRoot, toolInput.file_path);
  pushPath(paths, workspaceRoot, toolInput.path);

  const edits = toolInput.edits;
  if (Array.isArray(edits)) {
    for (const edit of edits) {
      if (isRecord(edit)) {
        pushPath(paths, workspaceRoot, edit.file_path);
      }
    }
  }

  return paths;
}

export function extractProviderEditPaths(payload: Record<string, unknown>, workspaceRoot: string): string[] {
  const paths: string[] = [];
  pushPath(paths, workspaceRoot, payload.file_path);

  const toolInput = payload.tool_input;
  if (isRecord(toolInput)) {
    paths.push(...pathsFromToolInput(toolInput, workspaceRoot));
  }

  return [...new Set(paths)];
}

export function deriveFastCheckStrike(payload: Record<string, unknown>): number | undefined {
  const stopHookActive = payload.stop_hook_active;
  if (stopHookActive === true) {
    return 1;
  }
  const loopCount = payload.loop_count;
  if (typeof loopCount === "number" && Number.isInteger(loopCount) && loopCount > 0) {
    return loopCount;
  }
  return undefined;
}

function neutralPathsFromExplicitList(explicitPaths: unknown): string[] | undefined {
  if (!Array.isArray(explicitPaths)) {
    return undefined;
  }
  const paths: string[] = [];
  for (const entry of explicitPaths) {
    if (typeof entry === "string" && entry.trim().length > 0) {
      paths.push(normalizeSeparators(entry.trim()));
    }
  }
  return paths.length > 0 ? paths : undefined;
}

function resolvePaths(payload: Record<string, unknown>, workspaceRoot: string): string[] | undefined {
  const explicit = neutralPathsFromExplicitList(payload.paths);
  if (explicit !== undefined) {
    return explicit;
  }
  const extracted = extractProviderEditPaths(payload, workspaceRoot);
  return extracted.length > 0 ? extracted : undefined;
}

function resolveFastCheckStrike(
  payload: Record<string, unknown>,
  forStop: boolean,
): number | undefined {
  const explicitStrike = payload.fastCheckStrike;
  if (typeof explicitStrike === "number" && Number.isInteger(explicitStrike) && explicitStrike >= 0) {
    return explicitStrike;
  }
  if (!forStop) {
    return undefined;
  }
  return deriveFastCheckStrike(payload);
}

/**
 * Maps Claude Code, Cursor, or Codex hook stdin JSON to the neutral {@link HookInput} shape.
 * Explicit `paths` / `fastCheckStrike` fields win when present.
 */
export function adaptProviderHookPayload(
  payload: Record<string, unknown>,
  options: { workspaceRoot: string; forStop: boolean },
): HookInput {
  const input: HookInput = {};
  const paths = resolvePaths(payload, options.workspaceRoot);
  if (paths !== undefined) {
    input.paths = paths;
  }
  const strike = resolveFastCheckStrike(payload, options.forStop);
  if (strike !== undefined) {
    input.fastCheckStrike = strike;
  }
  return input;
}
