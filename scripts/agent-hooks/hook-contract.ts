/** Hook exit semantics (Claude Code–compatible): 0 = ok, 1 = warn, 2 = block. */
export const HOOK_EXIT_OK = 0;
export const HOOK_EXIT_WARN = 1;
export const HOOK_EXIT_BLOCK = 2;

export type HookExitCode = typeof HOOK_EXIT_OK | typeof HOOK_EXIT_WARN | typeof HOOK_EXIT_BLOCK;

/** Provider-neutral stdin/argv payload for guard hooks (see docs/agent-guard-hooks.md). */
export interface HookInput {
  paths?: string[];
  fastCheckStrike?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePathList(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error('Hook JSON field "paths" must be an array of strings.');
  }
  const paths: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error('Hook JSON field "paths" must contain non-empty strings.');
    }
    paths.push(entry.trim());
  }
  return paths;
}

function parseStrike(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error('Hook JSON field "fastCheckStrike" must be a non-negative integer.');
  }
  return value;
}

export function parseHookInputJson(text: string): HookInput {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Hook stdin must be valid JSON when provided.");
  }
  if (!isRecord(parsed)) {
    throw new Error("Hook stdin JSON must be an object.");
  }
  const input: HookInput = {};
  const paths = parsePathList(parsed.paths);
  if (paths !== undefined) {
    input.paths = paths;
  }
  const strike = parseStrike(parsed.fastCheckStrike);
  if (strike !== undefined) {
    input.fastCheckStrike = strike;
  }
  return input;
}

function splitCommaList(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function parseHookArgv(argv: readonly string[]): HookInput {
  const input: HookInput = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--paths") {
      const next = argv[index + 1];
      if (typeof next !== "string") {
        throw new Error("Missing value for --paths.");
      }
      input.paths = splitCommaList(next);
      index += 1;
      continue;
    }
    if (token === "--fast-check-strike") {
      const next = argv[index + 1];
      if (typeof next !== "string") {
        throw new Error("Missing value for --fast-check-strike.");
      }
      const strike = Number.parseInt(next, 10);
      if (!Number.isInteger(strike) || strike < 0) {
        throw new Error("--fast-check-strike must be a non-negative integer.");
      }
      input.fastCheckStrike = strike;
      index += 1;
    }
  }
  return input;
}

function argvSuppliesHookInput(argv: readonly string[]): boolean {
  const parsed = parseHookArgv(argv);
  return (
  (parsed.paths !== undefined && parsed.paths.length > 0) || parsed.fastCheckStrike !== undefined
  );
}

export async function readHookInput(argv: readonly string[]): Promise<HookInput> {
  if (argvSuppliesHookInput(argv) || process.stdin.isTTY) {
    return parseHookArgv(argv);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim().length > 0) {
    return parseHookInputJson(text);
  }
  return parseHookArgv(argv);
}
