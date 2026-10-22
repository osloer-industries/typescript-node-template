import { describe, expect, it, vi } from "vitest";
import { isSetupEntry, runSetupEntry } from "./setup.mjs";

describe("setup entry", () => {
  it("detects direct execution", () => {
    expect(isSetupEntry("file:///tmp/scripts/setup.mjs", "/tmp/scripts/setup.mjs")).toBe(true);
    expect(isSetupEntry("file:///tmp/scripts/setup.mjs", "/other/setup.mjs")).toBe(false);
  });

  it("runs setup only for direct execution", async () => {
    const runCli = vi.fn().mockResolvedValue(undefined);
    await runSetupEntry("file:///tmp/scripts/setup.mjs", "/other/setup.mjs", ["--yes"], runCli);
    expect(runCli).not.toHaveBeenCalled();
    await runSetupEntry("file:///tmp/scripts/setup.mjs", "/tmp/scripts/setup.mjs", ["--yes"], runCli);
    expect(runCli).toHaveBeenCalledWith(["--yes"]);
  });
});
