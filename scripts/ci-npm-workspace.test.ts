import type { ExecFileSyncOptions } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./run-npm.ts", () => ({
  runNpm: vi.fn<(args: readonly string[], options?: ExecFileSyncOptions) => void>(),
}));

const { runNpm } = await import("./run-npm.js");
const { runCiNpmWorkspace } = await import("./ci-npm-workspace.js");
const inheritStdio = { stdio: "inherit" } as const;
const rootCiArgs = ["ci", "--ignore-scripts"] as const;
const eslintSonarjsPrefixArgs = ["ci", "--ignore-scripts", "--prefix", "packages/eslint-sonarjs"] as const;

describe("runCiNpmWorkspace", () => {
  afterEach(() => {
    vi.mocked(runNpm).mockReset();
  });

  it("runs root npm ci by default", () => {
    runCiNpmWorkspace({ runInstall: runNpm });
    expect(runNpm).toHaveBeenCalledTimes(1);
    expect(runNpm).toHaveBeenCalledWith(rootCiArgs, inheritStdio);
  });

  it("installs nested eslint-sonarjs when requested", () => {
    runCiNpmWorkspace({ runInstall: runNpm, installEslintSonarjs: true });
    expect(runNpm).toHaveBeenCalledTimes(2);
    expect(runNpm).toHaveBeenNthCalledWith(2, eslintSonarjsPrefixArgs, inheritStdio);
  });

  it("skips root npm ci when skipRootCi is set", () => {
    runCiNpmWorkspace({ runInstall: runNpm, skipRootCi: true, installEslintSonarjs: true });
    expect(runNpm).toHaveBeenCalledTimes(1);
    expect(runNpm).toHaveBeenCalledWith(eslintSonarjsPrefixArgs, inheritStdio);
  });
});