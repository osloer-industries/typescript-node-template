import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTemplateFixture } from "./copy-template-fixture.mjs";
import * as runNpmModule from "./run-npm.mjs";
import { applySetup, profiles, runSetupCli } from "./setup-lib.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

describe("applySetup install", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs npm install when runInstall is enabled", () => {
    const runNpm = vi.spyOn(runNpmModule, "runNpm").mockImplementation(() => {});
    const tempDir = mkdtempSync(join(tmpdir(), "setup-install-"));
    try {
      copyTemplateFixture(repoRoot, tempDir);
      applySetup(
        {
          scenario: "plugin",
          name: "demo-plugin",
          description: "Demo",
          profile: profiles.plugin,
        },
        { runInstall: true, baseDir: tempDir },
      );
      expect(runNpm).toHaveBeenCalledWith(["install", "--save-exact", "--ignore-scripts"], {
        cwd: tempDir,
        stdio: "inherit",
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runSetupCli", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs verify and pack for publishable scenarios", async () => {
    const runNpm = vi.spyOn(runNpmModule, "runNpm").mockImplementation(() => {});
    const tempDir = mkdtempSync(join(tmpdir(), "setup-cli-verify-"));
    const previousCwd = process.cwd();
    try {
      copyTemplateFixture(repoRoot, tempDir);
      process.chdir(tempDir);
      await runSetupCli(["--yes", "--scenario", "cli", "--name", "@acme/demo-cli", "--verify"]);
      expect(runNpm).toHaveBeenCalledWith(["run", "check"], { stdio: "inherit" });
      expect(runNpm).toHaveBeenCalledWith(["pack", "--dry-run"], { stdio: "inherit" });
    } finally {
      process.chdir(previousCwd);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("configures a project without verify when not requested", async () => {
    const runNpm = vi.spyOn(runNpmModule, "runNpm").mockImplementation(() => {});
    const tempDir = mkdtempSync(join(tmpdir(), "setup-cli-"));
    const previousCwd = process.cwd();
    try {
      copyTemplateFixture(repoRoot, tempDir);
      process.chdir(tempDir);
      await runSetupCli(["--yes", "--scenario", "plugin", "--name", "demo-plugin", "--no-verify"]);
      expect(readFileSync(join(tempDir, "src/index.ts"), "utf8")).toContain("createPlugin");
      expect(runNpm).toHaveBeenCalledWith(["install", "--save-exact", "--ignore-scripts"], {
        cwd: ".",
        stdio: "inherit",
      });
      expect(runNpm).not.toHaveBeenCalledWith(["run", "check"], expect.anything());
    } finally {
      process.chdir(previousCwd);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
