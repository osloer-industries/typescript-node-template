import type { ExecFileSyncOptions } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunCiNpmWorkspaceOptions } from "./ci-npm-workspace.ts";

vi.mock("./ci-npm-workspace.ts", () => ({
  runCiNpmWorkspace: vi.fn<(options?: RunCiNpmWorkspaceOptions) => void>(),
}));

vi.mock("./run-npm.ts", () => ({
  runNpm: vi.fn<(args: readonly string[], options?: ExecFileSyncOptions) => void>(),
}));

const { runCiNpmWorkspace } = await import("./ci-npm-workspace.js");
const { runNpm } = await import("./run-npm.js");
const { runSonarCoverage } = await import("./run-sonar-coverage.js");

describe("runSonarCoverage", () => {
  afterEach(() => {
    vi.mocked(runCiNpmWorkspace).mockReset();
    vi.mocked(runNpm).mockReset();
  });

  it("installs nested eslint-sonarjs then runs test:coverage", () => {
    runSonarCoverage({ runInstall: runNpm });
    expect(runCiNpmWorkspace).toHaveBeenCalledWith({
      runInstall: runNpm,
      skipRootCi: true,
      installEslintSonarjs: true,
    });
    expect(runNpm).toHaveBeenCalledWith(["run", "test:coverage"], { stdio: "inherit" });
  });
});