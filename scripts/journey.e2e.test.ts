import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { copyTemplateFixture } from "./copy-template-fixture.ts";
import { npmExecutablePath } from "./run-npm.ts";
import { gitCommitPaths, gitExecutableForTests, initGitRepo } from "./test-git-fixture.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const setupEntry = join(repoRoot, "scripts/setup.mjs");
const journeyGitExecutable = gitExecutableForTests("JOURNEY_E2E_GIT_PATH");

const npmEnv = {
  ...process.env,
  NPM_CONFIG_FUND: "false",
  NPM_CONFIG_AUDIT: "false",
};

const NPM_CI_TIMEOUT_MS = 300_000;
const SETUP_TIMEOUT_MS = 600_000;
const JOURNEY_TEST_TIMEOUT_MS = 1_200_000;

function runNpmIn(cwd: string, args: readonly string[], timeoutMs: number): void {
  execFileSync(npmExecutablePath(), args, {
    cwd,
    stdio: "pipe",
    timeout: timeoutMs,
    env: npmEnv,
  });
}

function runBuiltCli(projectDir: string, greetingName: string): string {
  return execFileSync(process.execPath, [join(projectDir, "dist/index.js"), greetingName], {
    cwd: projectDir,
    encoding: "utf8",
    timeout: 60_000,
    env: npmEnv,
  });
}

function runSetupCli(projectDir: string): void {
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
      timeout: SETUP_TIMEOUT_MS,
      env: npmEnv,
    },
  );
}

function installFixtureDependencies(projectDir: string): void {
  runNpmIn(projectDir, ["ci", "--ignore-scripts"], NPM_CI_TIMEOUT_MS);
  runNpmIn(projectDir, ["ci", "--ignore-scripts", "--prefix", "packages/eslint-sonarjs"], NPM_CI_TIMEOUT_MS);
}

function prepareFixtureProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "journey-e2e-"));
  copyTemplateFixture(repoRoot, projectDir);
  initGitRepo(projectDir, journeyGitExecutable);
  gitCommitPaths(projectDir, "fixture", ["."], journeyGitExecutable);
  installFixtureDependencies(projectDir);
  return projectDir;
}

describe("template main journey (e2e)", () => {
  it(
    "scaffolds via setup CLI with verification, then runs the built CLI",
  () => {
    const projectDir = prepareFixtureProject();
    try {
      runSetupCli(projectDir);
      expect(runBuiltCli(projectDir, "Oslo").trim()).toBe("Hello, Oslo!");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  },
  JOURNEY_TEST_TIMEOUT_MS,
  );
});