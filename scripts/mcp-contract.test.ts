import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import * as fc from "fast-check";
import { pathToFileURL } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { copyTemplateFixture } from "./copy-template-fixture.mjs";
import { applySetup, resolveSetupOptions } from "./setup-lib.mjs";
import { runNpm } from "./run-npm.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

type GreetingResult = { content: Array<{ type: "text"; text: string }> };

type ConnectableMcpServer = {
  connect(transport: unknown): Promise<void>;
  close(): Promise<void>;
};

type McpScaffold = {
  readonly tempDir: string;
  readonly createServer: () => ConnectableMcpServer;
  readonly parseGreetName: (input: unknown) => string;
  readonly handleGreetTool: (input: { name: string }) => GreetingResult;
  readonly createGreetingResult: (name: string) => GreetingResult;
};

function readFunctionExport(moduleValue: object, exportName: string): (...args: unknown[]) => unknown {
  const exported = Reflect.get(moduleValue, exportName);
  if (typeof exported !== "function") {
    throw new Error(`Missing ${exportName} export`);
  }
  return exported;
}

function expectGreetingResult(value: unknown): GreetingResult {
  if (typeof value !== "object" || value === null) {
    throw new Error("Expected greeting result object");
  }
  const contentValue = Reflect.get(value, "content");
  if (!Array.isArray(contentValue)) throw new Error("Expected greeting content array");
  const content: GreetingResult["content"] = [];
  for (const entry of contentValue) {
    if (typeof entry !== "object" || entry === null) throw new Error("Invalid greeting content entry");
    const type = Reflect.get(entry, "type");
    const text = Reflect.get(entry, "text");
    if (type !== "text" || typeof text !== "string") throw new Error("Invalid greeting text entry");
    content.push({ type: "text", text });
  }
  return { content };
}

function expectConnectableServer(value: unknown): ConnectableMcpServer {
  if (typeof value !== "object" || value === null) throw new Error("Invalid MCP server");
  const connect = Reflect.get(value, "connect");
  const close = Reflect.get(value, "close");
  if (typeof connect !== "function" || typeof close !== "function") {
    throw new Error("MCP server is missing connect/close");
  }
  return {
    connect: async (transport: unknown) => {
      await Reflect.apply(connect, value, [transport]);
    },
    close: async () => {
      await Reflect.apply(close, value, []);
    },
  };
}

async function scaffoldMcpProject(prefix: string): Promise<McpScaffold> {
  const tempDir = mkdtempSync(join(tmpdir(), prefix));
  copyTemplateFixture(repoRoot, tempDir);
  const selected = await resolveSetupOptions(
    { yes: true, scenario: "mcp", name: "demo-mcp-contract", description: "Contract test" },
    undefined,
  );
  applySetup(selected, { runInstall: true, baseDir: tempDir });
  runNpm(["run", "build"], {
    cwd: tempDir,
    stdio: "pipe",
    timeout: 120_000,
    env: { ...process.env, NPM_CONFIG_FUND: "false", NPM_CONFIG_AUDIT: "false" },
  });
  const moduleUrl = pathToFileURL(join(tempDir, "dist/index.js")).href;
  const imported: unknown = await import(moduleUrl);
  if (typeof imported !== "object" || imported === null) throw new Error("Invalid MCP module");
  const createServer = readFunctionExport(imported, "createServer");
  const parseGreetName = readFunctionExport(imported, "parseGreetName");
  const handleGreetTool = readFunctionExport(imported, "handleGreetTool");
  const createGreetingResult = readFunctionExport(imported, "createGreetingResult");
  return {
    tempDir,
    createServer: () => expectConnectableServer(createServer()),
    parseGreetName: (input: unknown) => {
      const result: unknown = parseGreetName(input);
      if (typeof result !== "string") throw new Error("parseGreetName did not return a string");
      return result;
    },
    handleGreetTool: (input: { name: string }) => expectGreetingResult(handleGreetTool(input)),
    createGreetingResult: (name: string) => expectGreetingResult(createGreetingResult(name)),
  };
}

async function withLinkedMcpClient(
  scaffold: McpScaffold,
  run: (client: Client) => Promise<void>,
): Promise<void> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = scaffold.createServer();
  await server.connect(serverTransport);
  const client = new Client({ name: "contract-test", version: "0.0.0" });
  await client.connect(clientTransport);
  try {
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

describe("MCP setup profile contract", () => {
  let scaffold: McpScaffold;

  beforeAll(async () => {
    scaffold = await scaffoldMcpProject("mcp-contract-shared-");
  }, 360_000);

  afterAll(() => {
    rmSync(scaffold.tempDir, { recursive: true, force: true });
  });

  it("calls greet over an in-memory MCP transport", async () => {
    await withLinkedMcpClient(scaffold, async (client) => {
      const result = await client.callTool({ name: "greet", arguments: { name: "Contract" } });
      const content = Array.isArray(result.content) ? result.content : [];
      expect(content[0]).toEqual({ type: "text", text: "Hello, Contract!" });
    });
  });

  it("snapshots greet inputSchema from listTools", async () => {
    await withLinkedMcpClient(scaffold, async (client) => {
      const listed = await client.listTools();
      const greet = listed.tools.find((tool) => tool.name === "greet");
      expect(greet?.inputSchema).toMatchSnapshot();
    });
  });

  it("returns isError for blank greet name input", async () => {
    await withLinkedMcpClient(scaffold, async (client) => {
      const result = await client.callTool({ name: "greet", arguments: { name: "   " } });
      expect(result.isError).toBe(true);
    });
  });

  it("declares safety annotations on the greet tool", async () => {
    await withLinkedMcpClient(scaffold, async (client) => {
      const listed = await client.listTools();
      const greet = listed.tools.find((tool) => tool.name === "greet");
      expect(greet?.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      });
    });
  });

  it("property-tests parseGreetName and handleGreetTool over the handler", () => {
    fc.assert(
      fc.property(fc.string().filter((value) => value.trim().length >= 1), (value) => {
        const trimmed = value.trim();
        expect(scaffold.parseGreetName(value)).toBe(trimmed);
        expect(scaffold.handleGreetTool({ name: trimmed })).toEqual(scaffold.createGreetingResult(trimmed));
      }),
      { numRuns: 25 },
    );
  });
});
