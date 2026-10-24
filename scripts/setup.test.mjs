import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { isSetupEntry, runSetupEntry } from "./setup.mjs";

describe("setup entry", () => {
  it("detects direct execution", () => {
    const setupAbs = join(mkdtempSync(join(tmpdir(), "setup-entry-")), "scripts", "setup.mjs");
    const setupUrl = pathToFileURL(setupAbs).href;
    expect(isSetupEntry(setupUrl, setupAbs)).toBe(true);
    expect(isSetupEntry(setupUrl, "/other/setup.mjs")).toBe(false);
  });

  it("runs setup only for direct execution", async () => {
    const setupAbs = join(mkdtempSync(join(tmpdir(), "setup-entry-run-")), "scripts", "setup.mjs");
    const setupUrl = pathToFileURL(setupAbs).href;
    const runCli = vi.fn().mockResolvedValue(undefined);
    await runSetupEntry(setupUrl, "/other/setup.mjs", ["--yes"], runCli);
    expect(runCli).not.toHaveBeenCalled();
    await runSetupEntry(setupUrl, setupAbs, ["--yes"], runCli);
    expect(runCli).toHaveBeenCalledWith(["--yes"]);
  });
});
