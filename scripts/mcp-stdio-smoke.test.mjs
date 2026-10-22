import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  findMissingTools,
  isToolCallError,
  isScriptEntry,
  runGeneratedTestMcpCli,
  runMcpStdioSmoke,
  runProjectMcpSmokeEntry,
  toolNamesFromListResult,
  toolsListMatches,
} from "./mcp-stdio-smoke.mjs";

describe("findMissingTools", () => {
  it("returns names absent from the actual list", () => {
    expect(findMissingTools(["a", "b"], ["a"])).toEqual(["b"]);
    expect(findMissingTools(["greet"], ["greet"])).toEqual([]);
  });
});

describe("toolNamesFromListResult", () => {
  it("extracts tool names from tools/list results", () => {
    expect(toolNamesFromListResult({ tools: [{ name: "greet" }] })).toEqual(["greet"]);
    expect(toolNamesFromListResult({})).toEqual([]);
  });
});

describe("isToolCallError", () => {
  it("detects isError on tool call results", () => {
    expect(isToolCallError({ isError: true })).toBe(true);
    expect(isToolCallError({ content: [] })).toBe(false);
  });
});

describe("toolsListMatches", () => {
  it("requires exact tool sets", () => {
    expect(toolsListMatches(["greet"], ["greet"])).toBe(true);
    expect(toolsListMatches(["greet"], ["greet", "other"])).toBe(false);
    expect(toolsListMatches(["a", "b"], ["a"])).toBe(false);
  });
});

describe("isScriptEntry", () => {
  it("detects when a module is the node entrypoint", () => {
    const entry = "/tmp/project/scripts/test-mcp.mjs";
    const metaUrl = new URL(entry, "file:").href;
    expect(isScriptEntry(metaUrl, entry)).toBe(true);
    expect(isScriptEntry(metaUrl, "/other/script.mjs")).toBe(false);
  });
});

describe("runGeneratedTestMcpCli", () => {
  it("runs the project smoke entry when executed directly", async () => {
    const runSmoke = vi.fn().mockResolvedValue(0);
    const entry = "/tmp/project/scripts/test-mcp.mjs";
    const metaUrl = new URL(entry, "file:").href;
    await runGeneratedTestMcpCli(metaUrl, entry, "/tmp/project/scripts", { runSmoke });
    expect(runSmoke).toHaveBeenCalledOnce();
  });

  it("does nothing when imported as a module", async () => {
    const runSmoke = vi.fn().mockResolvedValue(0);
    await runGeneratedTestMcpCli("file:///a.mjs", "/b.mjs", "/tmp/project/scripts", { runSmoke });
    expect(runSmoke).not.toHaveBeenCalled();
  });
});

describe("runProjectMcpSmokeEntry", () => {
  it("logs success when the smoke test passes", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const runSmoke = vi.fn().mockResolvedValue(0);
    const exitCode = await runProjectMcpSmokeEntry("/tmp/project/scripts", { runSmoke });
    expect(exitCode).toBe(0);
    expect(process.exitCode).toBeUndefined();
    expect(log).toHaveBeenCalledWith("MCP stdio smoke test passed.");
    expect(runSmoke).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("sets process.exitCode when the smoke test fails", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const runSmoke = vi.fn().mockResolvedValue(1);
    const priorExitCode = process.exitCode;
    const exitCode = await runProjectMcpSmokeEntry("/tmp/project/scripts", { runSmoke });
    expect(exitCode).toBe(1);
    expect(process.exitCode).toBe(1);
    expect(log).not.toHaveBeenCalled();
    process.exitCode = priorExitCode;
    log.mockRestore();
  });
});

describe("runMcpStdioSmoke", () => {
  it("rejects when the server entrypoint is missing", async () => {
    await expect(
      runMcpStdioSmoke({ serverPath: "/tmp/does-not-exist-mcp.js", expectedTools: ["greet"] }),
    ).rejects.toThrow(/Missing MCP server entrypoint/);
  });

  it("reports missing tools", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mcp-smoke-missing-"));
    const serverPath = join(tempDir, "mock-mcp-server.mjs");
    writeFileSync(
      serverPath,
      `import { createInterface } from "node:readline";
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }) + "\\n");
  }
  if (message.method === "tools/list") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: [] } }) + "\\n");
  }
});
`,
    );
    try {
      await expect(
        runMcpStdioSmoke({ serverPath, expectedTools: ["greet"] }),
      ).rejects.toThrow(/Missing MCP tools/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects tool calls that return isError", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mcp-smoke-error-"));
    const serverPath = join(tempDir, "mock-mcp-server.mjs");
    writeFileSync(
      serverPath,
      `import { createInterface } from "node:readline";
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} }) + "\\n");
    return;
  }
  if (message.method === "tools/list") {
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      result: { tools: [{ name: "greet" }] },
    }) + "\\n");
    return;
  }
  if (message.method === "tools/call") {
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      result: { isError: true },
    }) + "\\n");
  }
});
`,
    );
    try {
      await expect(
        runMcpStdioSmoke({
          serverPath,
          expectedTools: ["greet"],
          toolCall: { name: "greet", arguments: {} },
        }),
      ).rejects.toThrow(/Credential-free tool call greet returned an error/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("surfaces JSON-RPC errors from the server", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mcp-smoke-rpc-error-"));
    const serverPath = join(tempDir, "mock-mcp-server.mjs");
    writeFileSync(
      serverPath,
      `import { createInterface } from "node:readline";
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      error: { message: "nope" },
    }) + "\\n");
  }
});
`,
    );
    try {
      await expect(
        runMcpStdioSmoke({ serverPath, expectedTools: ["greet"] }),
      ).rejects.toThrow(/MCP request failed: nope/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("completes initialize, tools/list, and an optional tool call", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mcp-smoke-"));
    const serverPath = join(tempDir, "mock-mcp-server.mjs");
    writeFileSync(
      serverPath,
      `import { createInterface } from "node:readline";
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "notifications/initialized") return;
  if (message.method === "initialize") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { capabilities: {} } }) + "\\n");
    return;
  }
  if (message.method === "tools/list") {
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      result: { tools: [{ name: "greet" }] },
    }) + "\\n");
    return;
  }
  if (message.method === "tools/call") {
    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      result: { content: [{ type: "text", text: "ok" }] },
    }) + "\\n");
  }
});
`,
    );
    try {
      const exitCode = await runMcpStdioSmoke({
        serverPath,
        expectedTools: ["greet"],
        toolCall: { name: "greet", arguments: { name: "smoke" } },
      });
      expect(exitCode).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
