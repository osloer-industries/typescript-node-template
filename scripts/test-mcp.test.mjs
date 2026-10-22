import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import * as smoke from "./mcp-stdio-smoke.mjs";

const testMcpPath = join(dirname(fileURLToPath(import.meta.url)), "test-mcp.mjs");

describe("scripts/test-mcp.mjs", () => {
  it.skipIf(!existsSync(testMcpPath))("delegates to runProjectMcpSmokeEntry", async () => {
    const entrySpy = vi.spyOn(smoke, "runProjectMcpSmokeEntry").mockResolvedValue(0);
    const { runTestMcp } = await import("./test-mcp.mjs");
    await runTestMcp("/tmp/demo/scripts");
    expect(entrySpy).toHaveBeenCalledWith("/tmp/demo/scripts");
    entrySpy.mockRestore();
  });

  it.skipIf(!existsSync(testMcpPath))("uses the shared project smoke entry helper", () => {
    const source = readFileSync(testMcpPath, "utf8");
    expect(source).toContain("runProjectMcpSmokeEntry");
    expect(source).toContain("runTestMcp");
  });
});
