import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import * as smoke from "./mcp-stdio-smoke.mjs";

const testMcpPath = join(dirname(fileURLToPath(import.meta.url)), "test-mcp.mjs");

describe("scripts/test-mcp.mjs", () => {
  it.skipIf(!existsSync(testMcpPath))("delegates runTestMcp to runProjectMcpSmokeEntry", async () => {
    const entrySpy = vi.spyOn(smoke, "runProjectMcpSmokeEntry").mockResolvedValue(0);
    const { runTestMcp } = await import("./test-mcp.mjs");
    await runTestMcp("/tmp/demo/scripts");
    expect(entrySpy).toHaveBeenCalledWith("/tmp/demo/scripts");
    entrySpy.mockRestore();
  });

  it.skipIf(!existsSync(testMcpPath))("detects direct execution for the CLI entry", async () => {
    const { isTestMcpDirectEntry, runTestMcpEntry } = await import("./test-mcp.mjs");
    const meta = "file:///srv/app/scripts/test-mcp.mjs";
    expect(isTestMcpDirectEntry(meta, "/srv/app/scripts/test-mcp.mjs")).toBe(true);
    expect(isTestMcpDirectEntry(meta, "/other/test-mcp.mjs")).toBe(false);
    const startTestMcp = vi.fn().mockResolvedValue(undefined);
    await runTestMcpEntry(meta, "/other/test-mcp.mjs", startTestMcp);
    expect(startTestMcp).not.toHaveBeenCalled();
    await runTestMcpEntry(meta, "/srv/app/scripts/test-mcp.mjs", startTestMcp);
    expect(startTestMcp).toHaveBeenCalledOnce();
  });

  it.skipIf(!existsSync(testMcpPath))("uses the shared project smoke entry helper", () => {
    const source = readFileSync(testMcpPath, "utf8");
    expect(source).toContain("runProjectMcpSmokeEntry");
    expect(source).toContain("runTestMcpEntry");
  });
});
