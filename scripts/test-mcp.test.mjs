import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const testMcpPath = join(dirname(fileURLToPath(import.meta.url)), "test-mcp.mjs");

describe("scripts/test-mcp.mjs", () => {
  it.skipIf(!existsSync(testMcpPath))("delegates to runGeneratedTestMcpCli", () => {
    const source = readFileSync(testMcpPath, "utf8");
    expect(source).toContain("runGeneratedTestMcpCli");
    expect(source).not.toMatch(/\bif\s*\(/);
  });

  it.skipIf(!existsSync(testMcpPath))("loads without running the smoke test", async () => {
    const moduleUrl = `${pathToFileURL(testMcpPath).href}?vitest=${Date.now()}`;
    await expect(import(moduleUrl)).resolves.toBeDefined();
  });
});
