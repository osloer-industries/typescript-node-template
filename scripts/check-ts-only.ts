import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertAllowlistWriteShrinkOnly,
  assertTrackedPathsMatchAllowlist,
} from "./shrink-only-ratchet.ts";

const ALLOWLIST_RELATIVE_PATH = "quality/js-allowlist.json";

const JS_GIT_PATHSPECS = ["*.mjs", "*.cjs", "*.js", "*.jsx", "*.d.mts"] as const;
const JS_EXTENSIONS = [".mjs", ".cjs", ".js", ".jsx", ".d.mts"] as const;
const WALK_SKIP_DIR_NAMES = new Set(["node_modules", "dist", "coverage", ".git"]);

export interface JsAllowlist {
  readonly version: 1;
  readonly paths: readonly string[];
}

function gitExecutable(): string {
  return process.env.TS_ONLY_GIT_PATH ?? "git";
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return "";
  let text = error.message;
  const stderr = Reflect.get(error, "stderr");
  if (typeof stderr === "string") text += stderr;
  return text;
}

function isNotAGitRepositoryError(error: unknown): boolean {
  return errorText(error).includes("not a git repository");
}

function isJsExtension(fileName: string): boolean {
  return JS_EXTENSIONS.some((suffix) => fileName.endsWith(suffix));
}

function listJsPathsOnDisk(rootDir: string, relativeDir = "", collected: string[] = []): string[] {
  const absoluteDir = join(rootDir, relativeDir);
  for (const entry of readdirSync(absoluteDir)) {
    const relativePath = relativeDir.length > 0 ? `${relativeDir}/${entry}` : entry;
    const absolutePath = join(rootDir, relativePath);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      if (WALK_SKIP_DIR_NAMES.has(entry)) continue;
      listJsPathsOnDisk(rootDir, relativePath, collected);
      continue;
    }
    if (isJsExtension(entry)) {
      collected.push(relativePath.replaceAll("\\", "/"));
    }
  }
  return collected;
}

export function listGitTrackedJsPaths(rootDir: string): string[] {
  const output = execFileSync(gitExecutable(), ["ls-files", ...JS_GIT_PATHSPECS], {
    cwd: rootDir,
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function resolveJsPathsForGate(rootDir: string): string[] {
  try {
    return listGitTrackedJsPaths(rootDir);
  } catch (error) {
    if (!isNotAGitRepositoryError(error)) {
      throw error;
    }
    return listJsPathsOnDisk(rootDir).toSorted((a, b) => a.localeCompare(b));
  }
}

export function loadJsAllowlist(allowlistPath: string): JsAllowlist {
  const parsed: unknown = JSON.parse(readFileSync(allowlistPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid JS allowlist JSON");
  }
  const version = Reflect.get(parsed, "version");
  const pathsValue = Reflect.get(parsed, "paths");
  if (version !== 1 || !Array.isArray(pathsValue)) {
    throw new Error("Invalid JS allowlist shape");
  }
  const paths: string[] = [];
  for (const entry of pathsValue) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error("Invalid JS allowlist path entry");
    }
    paths.push(entry);
  }
  const normalized = paths.map((path) => path.replaceAll("\\", "/"));
  const unique = new Set(normalized);
  if (unique.size !== normalized.length) {
    throw new Error("JS allowlist contains duplicate paths");
  }
  return { version: 1, paths: normalized };
}

export function writeJsAllowlist(allowlistPath: string, paths: readonly string[]): void {
  const sorted = [...paths]
    .map((path) => path.replaceAll("\\", "/"))
    .toSorted((a, b) => a.localeCompare(b));
  const payload: JsAllowlist = { version: 1, paths: sorted };
  writeFileSync(allowlistPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function assertTsOnlyGate(rootDir: string): void {
  const allowlistPath = join(rootDir, ALLOWLIST_RELATIVE_PATH);
  const tracked = resolveJsPathsForGate(rootDir);
  const allowlist = loadJsAllowlist(allowlistPath);
  assertTrackedPathsMatchAllowlist(tracked, allowlist.paths);
}

function repoRootFromModuleUrl(moduleUrl: string): string {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..");
}

export function runCheckTsOnlyCli(moduleUrl: string, argv: readonly string[]): void {
  const rootDir = repoRootFromModuleUrl(moduleUrl);
  const allowlistPath = join(rootDir, ALLOWLIST_RELATIVE_PATH);
  const writeMode = argv.includes("--write-allowlist");
  const tracked = resolveJsPathsForGate(rootDir);
  const allowlist = loadJsAllowlist(allowlistPath);

  if (writeMode) {
    assertAllowlistWriteShrinkOnly(tracked, allowlist.paths);
    writeJsAllowlist(allowlistPath, tracked);
    process.stdout.write(`Wrote JS allowlist (${tracked.length} paths)\n`);
    return;
  }

  assertTrackedPathsMatchAllowlist(tracked, allowlist.paths);
  process.stdout.write(
    `Tracked untyped JS ${tracked.length} (allowlist ${allowlist.paths.length}, shrink-only OK)\n`,
  );
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  runCheckTsOnlyCli(import.meta.url, process.argv.slice(2));
}