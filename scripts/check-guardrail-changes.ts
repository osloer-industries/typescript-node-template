import { appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listChangedPaths as listGitChangedPaths } from "./git-list-changed-paths.mjs";

/** Paths (file or directory prefix) treated as agent harness / guardrails. */
export const GUARDRAIL_PATH_PREFIXES = [
  ".github/",
  "AGENTS.md",
  ".gitignore",
  ".agents/",
  "CODEOWNERS",
  "scripts/agents-check.ts",
  "scripts/check-fleet-adoption-doc.ts",
  "docs/fleet-adoption.md",
  ".oxlintrc.json",
  "vitest.config.ts",
  "lefthook.yml",
  "scripts/suppression-baseline.json",
  "scripts/count-suppressions.ts",
  "scripts/gate-self.test.ts",
  "scripts/check-guardrail-changes.ts",
  "scripts/oxlint-plugin-osloer.ts",
  "scripts/agent-hooks/",
  "packages/eslint-sonarjs/",
] as const;

export const GITHUB_OUTPUT_GUARDRAIL_CHANGED = "guardrail_changed";

const TSCONFIG_JSON_PATTERN = /^tsconfig[^/]*\.json$/;

export function isGuardrailPath(changedPath: string): boolean {
  const normalized = changedPath.replaceAll("\\", "/");
  if (TSCONFIG_JSON_PATTERN.test(normalized)) {
    return true;
  }
  return GUARDRAIL_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix),
  );
}

const GIT_EXECUTABLE = process.env.GUARDRAIL_GIT_PATH ?? "/usr/bin/git";

export function listChangedPaths(baseRef: string, headRef: string, cwd: string): string[] {
  return listGitChangedPaths(baseRef, headRef, cwd, GIT_EXECUTABLE);
}

export function findGuardrailChanges(changedPaths: readonly string[]): string[] {
  return changedPaths.filter(isGuardrailPath);
}

export function computeGuardrailChanged(changedPaths: readonly string[]): boolean {
  return findGuardrailChanges(changedPaths).length > 0;
}

export function formatGuardrailDetectMessage(
  changedPaths: readonly string[],
): string {
  const guardrail = findGuardrailChanges(changedPaths);
  if (guardrail.length === 0) {
    return "No guardrail path changes detected.\n";
  }
  return (
    `Guardrail paths changed (${guardrail.length}): ${guardrail.join(", ")}\n` +
    "Approval is required from the harness-approval deployment (Review deployments, then Approve).\n"
  );
}

export function writeGithubStepOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile === undefined || outputFile.length === 0) {
    return;
  }
  appendFileSync(outputFile, `${name}=${value}\n`, "utf8");
}

export function runGuardrailDetectCli(moduleUrl: string, argv: readonly string[]): number {
  const repoRoot = resolve(dirname(fileURLToPath(moduleUrl)), "..");
  const baseRef = argv[0] ?? process.env.GUARDRAIL_BASE_REF;
  const headRef = argv[1] ?? process.env.GUARDRAIL_HEAD_REF ?? "HEAD";
  if (typeof baseRef !== "string" || baseRef.length === 0) {
    throw new Error(
      "Missing base ref. Pass argv[0] or set GUARDRAIL_BASE_REF (e.g. origin/main or pull_request base SHA).",
    );
  }

  const changed = listChangedPaths(baseRef, headRef, repoRoot);
  const guardrailChanged = computeGuardrailChanged(changed);
  writeGithubStepOutput(GITHUB_OUTPUT_GUARDRAIL_CHANGED, guardrailChanged ? "true" : "false");
  process.stdout.write(formatGuardrailDetectMessage(changed));
  return 0;
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  process.exit(runGuardrailDetectCli(import.meta.url, process.argv.slice(2)));
}