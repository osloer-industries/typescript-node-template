import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { copyTemplateFixture } from "./copy-template-fixture.mjs";
import { npmExecutablePath } from "./run-npm.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const setupEntry = join(repoRoot, "scripts/setup.mjs");
const gitExecutable = process.env.JOURNEY_E2E_GIT_PATH ?? "/usr/bin/git";

const npmEnv = {
  ...process.env,
  NPM_CONFIG_FUND: "false",
  NPM_CONFIG_AUDIT: "false",
};

function runNpmIn(cwd: string, args: readonly string[], timeoutMs: number): void {
  execFileSync(npmExecutablePath(), args, {
    cwd,
    stdio: "pipe",
    timeout: timeoutMs,
    env: npmEnv,
  });
}

function runNodeIn(cwd: string, script: string, args: readonly string[]): string {
  return execFileSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 60_000,
    env: npmEnv,
  });
}

function initGitRepo(cwd: string): void {
  execFileSync(gitExecutable, ["init"], { cwd, stdio: "pipe" });
  execFileSync(gitExecutable, ["config", "user.email", "journey-e2e@example.com"], { cwd, stdio: "pipe" });
  execFileSync(gitExecutable, ["config", "user.name", "journey-e2e"], { cwd, stdio: "pipe" });
  execFileSync(gitExecutable, ["add", "."], { cwd, stdio: "pipe" });
  execFileSync(gitExecutable, ["commit", "-m", "fixture"], { cwd, stdio: "pipe" });
}

describe("template main journey (e2e)", () => {
  it(
    "scaffolds via setup CLI with verification, then runs the built CLI",
    () => {
      const projectDir = mkdtempSync(join(tmpdir(), "journey-e2e-"));
      try {
        copyTemplateFixture(repoRoot, projectDir);
        initGitRepo(projectDir);
        runNpmIn(projectDir, ["ci", "--ignore-scripts"], 300_000);
        runNpmIn(projectDir, ["ci", "--ignore-scripts", "--prefix", "packages/eslint-sonarjs"], 300_000);
        execFileSync(
          process.execPath,
          [
            setupEntry,
            "--scenario",
            "cli",
            "--name",
            "@e2e/journey-cli",
            "--description",
            "E2E template journey",
            "--yes",
          ],
          {
            cwd: projectDir,
            stdio: "pipe",
            timeout: 600_000,
            env: npmEnv,
          },
        );
        const greeting = runNodeIn(projectDir, join(projectDir, "dist/index.js"), ["Oslo"]);
        expect(greeting.trim()).toBe("Hello, Oslo!");
      } finally {
        rmSync(projectDir, { recursive: true, force: true });
      }
    },
    1_200_000,
  );
});