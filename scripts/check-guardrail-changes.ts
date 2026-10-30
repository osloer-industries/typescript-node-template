import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Paths (file or directory prefix) treated as agent harness / guardrails. */
export const GUARDRAIL_PATH_PREFIXES = [
  ".github/",
  "AGENTS.md",
  "CODEOWNERS",
  "scripts/check-guardrail-changes.ts",
  ".oxlintrc.json",
  "lefthook.yml",
  "scripts/suppression-baseline.json",
  "scripts/count-suppressions.ts",
  "packages/eslint-sonarjs/",
] as const;

export function isGuardrailPath(changedPath: string): boolean {
  const normalized = changedPath.replaceAll("\\", "/");
  return GUARDRAIL_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix),
  );
}

const GIT_EXECUTABLE = process.env.GUARDRAIL_GIT_PATH ?? "/usr/bin/git";

export function listChangedPaths(baseRef: string, headRef: string, cwd: string): string[] {
  const output = execFileSync(GIT_EXECUTABLE, ["diff", "--name-only", `${baseRef}...${headRef}`], {
    cwd,
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function findGuardrailChanges(changedPaths: readonly string[]): string[] {
  return changedPaths.filter(isGuardrailPath);
}

export function runGuardrailCheckCli(moduleUrl: string, argv: readonly string[]): void {
  const repoRoot = resolve(dirname(fileURLToPath(moduleUrl)), "..");
  const baseRef = argv[0] ?? process.env.GUARDRAIL_BASE_REF;
  const headRef = argv[1] ?? process.env.GUARDRAIL_HEAD_REF ?? "HEAD";
  if (typeof baseRef !== "string" || baseRef.length === 0) {
    throw new Error(
      "Missing base ref. Pass argv[0] or set GUARDRAIL_BASE_REF (e.g. origin/main or pull_request base SHA).",
    );
  }

  const changed = listChangedPaths(baseRef, headRef, repoRoot);
  const guardrail = findGuardrailChanges(changed);
  if (guardrail.length === 0) {
    process.stdout.write("No guardrail path changes detected.\n");
    return;
  }

  process.stdout.write(
    `Guardrail paths changed (${guardrail.length}): ${guardrail.join(", ")}\n` +
      "Ensure CODEOWNERS reviewers approve these harness edits.\n",
  );
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  runGuardrailCheckCli(import.meta.url, process.argv.slice(2));
}
