import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listChangedPaths } from "./git-list-changed-paths.mjs";

const GIT_EXECUTABLE = process.env.MUTATION_GIT_PATH ?? "/usr/bin/git";

export function isMutableSrcFile(changedPath: string): boolean {
  const normalized = changedPath.replaceAll("\\", "/");
  if (!normalized.startsWith("src/") || !normalized.endsWith(".ts")) {
    return false;
  }
  return !normalized.endsWith(".test.ts");
}

export function findMutableSrcChanges(changedPaths: readonly string[]): string[] {
  return changedPaths.filter(isMutableSrcFile);
}

export function runMutationChangedCli(moduleUrl: string, argv: readonly string[]): void {
  const repoRoot = resolve(dirname(fileURLToPath(moduleUrl)), "..");
  const baseRef = argv[0] ?? process.env.MUTATION_BASE_REF;
  const headRef = argv[1] ?? process.env.MUTATION_HEAD_REF ?? "HEAD";
  if (typeof baseRef !== "string" || baseRef.length === 0) {
    throw new Error(
      "Missing base ref. Pass argv[0] or set MUTATION_BASE_REF (e.g. pull_request base SHA).",
    );
  }

  const changed = listChangedPaths(baseRef, headRef, repoRoot, GIT_EXECUTABLE);
  const mutateTargets = findMutableSrcChanges(changed);
  if (mutateTargets.length === 0) {
    process.stdout.write("No mutable src/ changes; skipping mutation testing.\n");
    return;
  }

  const strykerExecutable = resolve(repoRoot, "node_modules", ".bin", "stryker");
  process.stdout.write(`Mutation targets (${mutateTargets.length}): ${mutateTargets.join(", ")}\n`);
  execFileSync(
    strykerExecutable,
    ["run", "--mutate", mutateTargets.join(",")],
    { cwd: repoRoot, stdio: "inherit" },
  );
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  runMutationChangedCli(import.meta.url, process.argv.slice(2));
}
