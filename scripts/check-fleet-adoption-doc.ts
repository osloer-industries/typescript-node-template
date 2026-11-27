import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listChangedPaths as listGitChangedPaths } from "./git-list-changed-paths.ts";

/** Checked-in source of truth for org reusable and template-feature adoption. */
export const FLEET_ADOPTION_DOC_PATH = "docs/fleet-adoption.md";

/** Prefixes that count as workflow or composite-action harness edits. */
export const WORKFLOW_HARNESS_PREFIXES = [
  ".github/workflows/",
  ".github/actions/",
] as const;

export function isWorkflowHarnessChange(changedPath: string): boolean {
  const normalized = changedPath.replaceAll("\\", "/");
  return WORKFLOW_HARNESS_PREFIXES.some(
    (prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix),
  );
}

const GIT_EXECUTABLE = process.env.FLEET_ADOPTION_GIT_PATH ?? "/usr/bin/git";

export function listChangedPaths(baseRef: string, headRef: string, cwd: string): string[] {
  return listGitChangedPaths(baseRef, headRef, cwd, GIT_EXECUTABLE);
}

export function evaluateFleetAdoptionDocSync(changedPaths: readonly string[]): {
  ok: boolean;
  workflowChanges: string[];
  message: string;
} {
  const workflowChanges = changedPaths.filter(isWorkflowHarnessChange);
  const docUpdated = changedPaths.includes(FLEET_ADOPTION_DOC_PATH);

  if (workflowChanges.length === 0) {
    return {
      ok: true,
      workflowChanges,
      message: "No workflow or composite-action path changes detected.",
    };
  }

  if (docUpdated) {
    return {
      ok: true,
      workflowChanges,
      message:
        `Workflow or composite-action paths changed (${workflowChanges.length}) and ` +
        `${FLEET_ADOPTION_DOC_PATH} was updated.`,
    };
  }

  return {
    ok: false,
    workflowChanges,
    message:
      `Workflow or composite-action paths changed (${workflowChanges.length}): ${workflowChanges.join(", ")}. ` +
      `Update ${FLEET_ADOPTION_DOC_PATH} in the same pull request (fleet adoption rule in AGENTS.md).`,
  };
}

export function runFleetAdoptionDocCheckCli(moduleUrl: string, argv: readonly string[]): number {
  const repoRoot = resolve(dirname(fileURLToPath(moduleUrl)), "..");
  const baseRef = argv[0] ?? process.env.FLEET_ADOPTION_BASE_REF;
  const headRef = argv[1] ?? process.env.FLEET_ADOPTION_HEAD_REF ?? "HEAD";
  if (typeof baseRef !== "string" || baseRef.length === 0) {
    throw new Error(
      "Missing base ref. Pass argv[0] or set FLEET_ADOPTION_BASE_REF (e.g. origin/main or pull_request base SHA).",
    );
  }

  const changed = listChangedPaths(baseRef, headRef, repoRoot);
  const result = evaluateFleetAdoptionDocSync(changed);
  process.stdout.write(`${result.message}\n`);
  return result.ok ? 0 : 1;
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  process.exit(runFleetAdoptionDocCheckCli(import.meta.url, process.argv.slice(2)));
}