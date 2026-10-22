import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @typedef {{
 *   serverPath: string,
 *   expectedTools: readonly string[],
 *   protocolVersion?: string,
 *   clientInfo?: { name: string, version: string },
 *   toolCall?: { name: string, arguments?: Record<string, unknown> },
 *   nodeExecutable?: string,
 *   cwd?: string,
 *   requestTimeoutMs?: number,
 * }} McpStdioSmokeOptions
 */

/**
 * @param {readonly string[]} expected
 * @param {readonly string[]} actual
 */
export function findMissingTools(expected, actual) {
  const names = new Set(actual);
  return expected.filter((name) => !names.has(name));
}

/**
 * @param {readonly string[]} expected
 * @param {readonly string[]} actual
 */
export function toolsListMatches(expected, actual) {
  if (actual.length !== expected.length) return false;
  const missing = findMissingTools(expected, actual);
  return missing.length === 0;
}

/**
 * @param {unknown} result
 */
export function toolNamesFromListResult(result) {
  if (typeof result !== "object" || result === null) return [];
  const tools = Reflect.get(result, "tools");
  if (!Array.isArray(tools)) return [];
  return tools.flatMap((tool) => {
    if (typeof tool !== "object" || tool === null) return [];
    const name = Reflect.get(tool, "name");
    return typeof name === "string" ? [name] : [];
  });
}

/**
 * @param {unknown} result
 */
export function isToolCallError(result) {
  if (typeof result !== "object" || result === null) return false;
  return Reflect.get(result, "isError") === true;
}

/**
 * @param {string} line
 * @param {Map<number, { resolve: (value: unknown) => void, reject: (error: Error) => void, timeout: NodeJS.Timeout }>} pending
 * @param {(message: string) => never} fail
 */
function handleStdoutLine(line, pending, fail) {
  if (!line) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    fail("The server returned an invalid MCP message.");
    return;
  }
  if (typeof message !== "object" || message === null) return;
  const id = Reflect.get(message, "id");
  if (typeof id !== "number") return;
  const waiting = pending.get(id);
  if (!waiting) return;
  clearTimeout(waiting.timeout);
  pending.delete(id);
  const error = Reflect.get(message, "error");
  if (error) {
    const errorMessage =
      typeof error === "object" && error !== null && typeof Reflect.get(error, "message") === "string"
        ? Reflect.get(error, "message")
        : "unknown error";
    waiting.reject(new Error(`MCP request failed: ${errorMessage}`));
  } else {
    waiting.resolve(Reflect.get(message, "result"));
  }
}

/**
 * @param {import("node:child_process").ChildProcessWithoutNullStreams} server
 * @param {number} requestTimeoutMs
 */
function createStdioClient(server, requestTimeoutMs) {
  let nextId = 1;
  let buffer = "";
  /** @type {Map<number, { resolve: (value: unknown) => void, reject: (error: Error) => void, timeout: NodeJS.Timeout }>} */
  const pending = new Map();
  let stderr = "";

  /** @param {string} method
   *  @param {Record<string, unknown> | undefined} [params]
   */
  function notify(method) {
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
  }

  /** @param {string} method
   *  @param {Record<string, unknown> | undefined} params
   */
  function request(method, params) {
    const id = nextId++;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    server.stdin.write(`${payload}\n`);
    return new Promise((resolveRequest, rejectRequest) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        rejectRequest(new Error(`Timed out waiting for ${method}.`));
      }, requestTimeoutMs);
      pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timeout });
    });
  }

  /** @param {string} message */
  function fail(message) {
    for (const waiting of pending.values()) {
      clearTimeout(waiting.timeout);
      waiting.reject(new Error(message));
    }
    pending.clear();
    server.kill();
    throw new Error(message);
  }

  /** @param {number} exitCode */
  function finish(exitCode) {
    server.kill();
    return exitCode;
  }

  server.stdout.setEncoding("utf8");
  server.stdout.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      handleStdoutLine(buffer.slice(0, newline).trim(), pending, fail);
      buffer = buffer.slice(newline + 1);
    }
  });

  server.stderr.setEncoding("utf8");
  server.stderr.on("data", (chunk) => { stderr += chunk; });
  server.on("error", (error) => fail(`Could not start the MCP server: ${error.message}`));
  server.on("exit", (code) => {
    if (code !== null && pending.size > 0) {
      fail(`The MCP server exited unexpectedly.${stderr ? " Check its local configuration." : ""}`);
    }
  });

  return { request, notify, fail, finish };
}

/**
 * @param {ReturnType<typeof createStdioClient>} client
 * @param {McpStdioSmokeOptions} options
 */
async function runSmokeSteps(client, options) {
  const {
    expectedTools,
    protocolVersion = "2025-03-26",
    clientInfo = { name: "mcp-stdio-smoke", version: "1.0.0" },
    toolCall,
  } = options;

  await client.request("initialize", {
    protocolVersion,
    capabilities: {},
    clientInfo,
  });
  client.notify("notifications/initialized");

  const toolNames = toolNamesFromListResult(await client.request("tools/list", {}));
  if (!toolsListMatches(expectedTools, toolNames)) {
    const missing = findMissingTools(expectedTools, toolNames);
    throw new Error(
      missing.length > 0
        ? `Missing MCP tools: ${missing.join(", ")}.`
        : "The MCP tool list does not match the expected interface.",
    );
  }

  if (toolCall) {
    const callResult = await client.request("tools/call", {
      name: toolCall.name,
      arguments: toolCall.arguments ?? {},
    });
    if (isToolCallError(callResult)) {
      throw new Error(`Credential-free tool call ${toolCall.name} returned an error.`);
    }
  }
}

/**
 * @param {McpStdioSmokeOptions} options
 */
export async function runMcpStdioSmoke(options) {
  const {
    serverPath,
    nodeExecutable = process.execPath,
    cwd,
    requestTimeoutMs = 10_000,
  } = options;

  if (!existsSync(serverPath)) {
    throw new Error(`Missing MCP server entrypoint: ${serverPath}. Run npm run build first.`);
  }

  const server = spawn(nodeExecutable, [serverPath], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const client = createStdioClient(server, requestTimeoutMs);

  try {
    await runSmokeSteps(client, options);
    // Notification must not use request(); send after initialize in runSmokeSteps fix
    return client.finish(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    client.fail(message);
    return client.finish(1);
  }
}

/** Default MCP tools exercised by generated `scripts/test-mcp.mjs`. */
export const defaultProjectMcpSmoke = {
  expectedTools: ["greet"],
  toolCall: { name: "greet", arguments: { name: "smoke" } },
};

/**
 * @typedef {{ runSmoke?: typeof runMcpStdioSmoke }} ProjectMcpSmokeEntryDeps
 */

/**
 * Run the stdio smoke test for a generated MCP project (`dist/index.js` under `scriptDir/..`).
 *
 * @param {string} scriptDir Absolute path to the project's `scripts/` directory.
 * @param {ProjectMcpSmokeEntryDeps} [deps]
 * @returns {Promise<number>} Process exit code (0 success, 1 failure).
 */
export async function runProjectMcpSmokeEntry(scriptDir, deps = {}) {
  const runSmoke = deps.runSmoke ?? runMcpStdioSmoke;
  const root = resolve(scriptDir, "..");
  const exitCode = await runSmoke({
    serverPath: resolve(root, "dist/index.js"),
    expectedTools: defaultProjectMcpSmoke.expectedTools,
    toolCall: defaultProjectMcpSmoke.toolCall,
  });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    return exitCode;
  }
  console.log("MCP stdio smoke test passed.");
  return exitCode;
}
