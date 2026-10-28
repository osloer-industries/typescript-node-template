import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { generatedTestMcpScript, writeMcpSmokeScripts } from "./setup-lib.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));

/**
 * @returns {{ testMcpPath: string, cleanup: () => void }}
 */
function resolveGeneratedTestMcpPath() {
  const adjacent = join(scriptDir, "test-mcp.mjs");
  if (existsSync(adjacent)) {
    return { testMcpPath: adjacent, cleanup: () => {} };
  }
  const tempDir = mkdtempSync(join(tmpdir(), "test-mcp-probe-"));
  writeMcpSmokeScripts(tempDir);
  return {
    testMcpPath: join(tempDir, "scripts", "test-mcp.mjs"),
    cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
  };
}

describe("scripts/test-mcp.mjs", () => {
  it("matches the setup-lib generated entry template", () => {
    expect(generatedTestMcpScript).toContain("runGeneratedTestMcpCli");
    expect(generatedTestMcpScript).not.toMatch(/\bif\s*\(/);
  });

  it("materializes the same template on disk for MCP projects", () => {
    const { testMcpPath, cleanup } = resolveGeneratedTestMcpPath();
    try {
      const source = readFileSync(testMcpPath, "utf8");
      expect(source).toBe(generatedTestMcpScript);
      expect(source).toContain("runGeneratedTestMcpCli");
    } finally {
      cleanup();
    }
  });

  it("loads without running the smoke test", async () => {
    const { testMcpPath, cleanup } = resolveGeneratedTestMcpPath();
    try {
      const moduleUrl = `${pathToFileURL(testMcpPath).href}?vitest=${Date.now()}`;
      await expect(import(moduleUrl)).resolves.toBeDefined();
    } finally {
      cleanup();
    }
  });
});
