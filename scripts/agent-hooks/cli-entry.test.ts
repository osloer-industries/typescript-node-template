import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  isDirectExecution,
  repoRootFromAgentHook,
  runAgentHookMain,
} from "./cli-entry.js";

describe("repoRootFromAgentHook", () => {
  it("resolves the repository root from an agent-hook module URL", () => {
    const root = repoRootFromAgentHook(import.meta.url);
    expect(root.endsWith("typescript-node-template")).toBe(true);
  });
});

describe("isDirectExecution", () => {
  it("is true only when argv points at this module", () => {
    expect(isDirectExecution(import.meta.url, undefined)).toBe(false);
    expect(isDirectExecution(import.meta.url, "/other/path.ts")).toBe(false);
  });
});

describe("runAgentHookMain", () => {
  it("invokes the runner when executed directly", async () => {
    const runner = vi.fn<(argv: readonly string[]) => Promise<number>>().mockResolvedValue(0);
    const chdir = vi.spyOn(process, "chdir").mockImplementation(() => undefined);
    const priorExitCode = process.exitCode;
    await runAgentHookMain(import.meta.url, fileURLToPath(import.meta.url), runner);
    expect(runner).toHaveBeenCalled();
    expect(chdir).toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
    chdir.mockRestore();
    process.exitCode = priorExitCode;
  });

  it("skips the runner when imported", async () => {
    const runner = vi.fn<(argv: readonly string[]) => Promise<number>>();
    await runAgentHookMain(import.meta.url, "/not-this-module.ts", runner);
    expect(runner).not.toHaveBeenCalled();
  });
});
