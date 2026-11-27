import { execFileSync } from "node:child_process";

export function listChangedPaths(
  baseRef: string,
  headRef: string,
  cwd: string,
  gitExecutable = "/usr/bin/git",
): string[] {
  const output = execFileSync(gitExecutable, ["diff", "--name-only", `${baseRef}...${headRef}`], {
    cwd,
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}