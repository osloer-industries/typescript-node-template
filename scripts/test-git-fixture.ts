import { execFileSync } from "node:child_process";

export function gitExecutableForTests(envVar: string, fallback = "/usr/bin/git"): string {
  return process.env[envVar] ?? fallback;
}

export function initGitRepo(tempDir: string, gitExecutable: string): void {
  execFileSync(gitExecutable, ["init"], { cwd: tempDir, stdio: "pipe" });
  execFileSync(gitExecutable, ["config", "user.email", "test@example.com"], { cwd: tempDir, stdio: "pipe" });
  execFileSync(gitExecutable, ["config", "user.name", "test"], { cwd: tempDir, stdio: "pipe" });
}

export function gitCommitPaths(
  tempDir: string,
  message: string,
  relativePaths: readonly string[],
  gitExecutable: string,
): string {
  for (const relativePath of relativePaths) {
    execFileSync(gitExecutable, ["add", relativePath], { cwd: tempDir, stdio: "pipe" });
  }
  execFileSync(gitExecutable, ["commit", "-m", message], { cwd: tempDir, stdio: "pipe" });
  return execFileSync(gitExecutable, ["rev-parse", "HEAD"], {
    cwd: tempDir,
    encoding: "utf8",
  }).trim();
}
