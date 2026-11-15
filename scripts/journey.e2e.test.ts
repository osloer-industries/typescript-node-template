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

describe("template main journey (e2e)", () => {
  it(
    "scaffolds via npm run setup, builds, runs the CLI, and passes check",
    () => {
      const projectDir = mkdtempSync(join(tmpdir(), "journey-e2e-"));
      try {
        copyTemplateFixture(repoRoot, projectDir);
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
            "--no-verify",
          ],
          {
            cwd: projectDir,
            stdio: "pipe",
            timeout: 300_000,
            env: npmEnv,
          },
        );
        runNpmIn(projectDir, ["run", "build"], 120_000);
        const greeting = runNodeIn(projectDir, join(projectDir, "dist/index.js"), ["Oslo"]);
        expect(greeting.trim()).toBe("Hello, Oslo!");
        runNpmIn(projectDir, ["run", "check"], 600_000);
      } finally {
        rmSync(projectDir, { recursive: true, force: true });
      }
    },
    900_000,
  );
});