import { execFileSync } from "node:child_process";

/**
 * @param {string} baseRef
 * @param {string} headRef
 * @param {string} cwd
 * @param {string} [gitExecutable]
 * @returns {string[]}
 */
export function listChangedPaths(
  baseRef,
  headRef,
  cwd,
  gitExecutable = "/usr/bin/git",
) {
  const output = execFileSync(gitExecutable, ["diff", "--name-only", `${baseRef}...${headRef}`], {
    cwd,
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
