#!/usr/bin/env node

import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runNpm } from "./run-npm.mjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

/** @typedef {"plugin" | "mcp" | "npm-package" | "cli"} SetupScenario */

const setupLibDir = dirname(fileURLToPath(import.meta.url));

const generatedTestMcpScript = `import { runProjectMcpSmokeEntry } from "./mcp-stdio-smoke.mjs";

/** @param {string} [scriptDir] */
export async function runTestMcp(scriptDir = import.meta.dirname) {
  await runProjectMcpSmokeEntry(scriptDir);
}

const entry = process.argv[1] ?? "";
if (import.meta.url === new URL(entry, "file:").href) {
  await runTestMcp();
}
`;

/**
 * @param {string} baseDir
 */
export function writeMcpSmokeScripts(baseDir) {
  const scriptsDir = join(baseDir, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  const smokeSource = join(setupLibDir, "mcp-stdio-smoke.mjs");
  const smokeDest = join(scriptsDir, "mcp-stdio-smoke.mjs");
  if (resolve(smokeSource) !== resolve(smokeDest)) {
    cpSync(smokeSource, smokeDest);
  }
  writeFileSync(join(scriptsDir, "test-mcp.mjs"), generatedTestMcpScript);
}

export const profiles = {
  plugin: {
    description: "Provider-neutral plugin package",
    source: `export interface PluginContext { log(message: string): void; }
export interface Plugin { name: string; activate(context: PluginContext): void; }
export function createPlugin(name: string): Plugin {
  return { name, activate(context) { context.log(\`\${name} activated\`); } };
}
`,
    test: `import { describe, expect, it, vi } from "vitest";
import { createPlugin } from "./index.js";
describe("createPlugin", () => { it("activates", () => { const log = vi.fn<(message: string) => void>(); const plugin = createPlugin("example"); plugin.activate({ log }); expect(log).toHaveBeenCalledWith("example activated"); }); });
`
  },
  mcp: {
    description: "Model Context Protocol stdio server",
    dependencies: { "@modelcontextprotocol/sdk": "1.30.0", "zod": "4.4.3" },
    source: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
export const greetNameSchema = z.string().trim().min(1).default("world");
export function parseGreetName(input: unknown): string { return greetNameSchema.parse(input); }
export function createGreetingResult(name: string) { return { content: [{ type: "text" as const, text: \`Hello, \${name}!\` }] }; }
export function handleGreetTool(input: { name: string }) { return createGreetingResult(input.name); }
export function createServer(): McpServer {
  const server = new McpServer({ name: "example-mcp-server", version: "0.1.0" });
  server.registerTool("greet", { description: "Return a greeting", inputSchema: { name: greetNameSchema } }, handleGreetTool);
  return server;
}
export type StdioConnectable = { connect(transport: unknown): Promise<void> };
export async function connectStdio(server: StdioConnectable): Promise<void> { await server.connect(new StdioServerTransport()); }
export async function main(): Promise<void> { await connectStdio(createServer()); }
export function shouldRunMain(metaUrl: string, argvEntry: string): boolean {
  return metaUrl === new URL(argvEntry, "file:").href;
}
export async function runEntry(
  metaUrl: string,
  argvEntry: string,
  startMain: () => Promise<void> = main,
): Promise<void> {
  if (shouldRunMain(metaUrl, argvEntry)) await startMain();
}
await runEntry(import.meta.url, process.argv[1] ?? "");
`,
    test: `import { describe, expect, it, vi } from "vitest";
import { createGreetingResult, createServer, connectStdio, handleGreetTool, parseGreetName, runEntry, shouldRunMain } from "./index.js";
describe("MCP server", () => {
  it("creates a server", () => expect(createServer()).toBeDefined());
  it("formats responses", () => expect(createGreetingResult("Oslo")).toEqual({ content: [{ type: "text", text: "Hello, Oslo!" }] }));
  it("handles greet tool input", () => expect(handleGreetTool({ name: "Oslo" })).toEqual(createGreetingResult("Oslo")));
  it("connectStdio calls connect", async () => {
    const connect = vi.fn<(argument?: unknown) => Promise<void>>().mockResolvedValue(undefined);
    await connectStdio({ connect });
    expect(connect).toHaveBeenCalledOnce();
  });
  it("detects direct execution", () => {
    expect(shouldRunMain("file:///srv/app/dist/index.js", "/srv/app/dist/index.js")).toBe(true);
    expect(shouldRunMain("file:///srv/app/dist/index.js", "/other/index.js")).toBe(false);
  });
  it("runEntry skips main when not direct", async () => {
    const startMain = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    await runEntry("file:///a.js", "/b.js", startMain);
    expect(startMain).not.toHaveBeenCalled();
  });
  it("runEntry invokes main for a matching argv entry", async () => {
    const startMain = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    await runEntry("file:///srv/app/dist/index.js", "/srv/app/dist/index.js", startMain);
    expect(startMain).toHaveBeenCalledOnce();
  });
  it("defaults greet name", () => expect(parseGreetName(undefined)).toBe("world"));
  it("trims greet name", () => expect(parseGreetName("  Oslo  ")).toBe("Oslo"));
  it("rejects empty greet name", () => expect(() => parseGreetName("   ")).toThrow(/Too small: expected string to have >=1 characters/));
});
`
  },
  "npm-package": {
    description: "Publishable npm library",
    publishable: true,
    dependencies: { "zod": "4.4.3" },
    source: `import { z } from "zod";
const slugInputSchema = z.string();
export function slugify(value: string): string {
  const parsed = slugInputSchema.parse(value);
  return parsed.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
`,
    test: `import { describe, expect, it } from "vitest";
import { slugify } from "./index.js";
describe("slugify", () => {
  it("normalizes text", () => expect(slugify(" Hello, TypeScript! ")).toBe("hello-typescript"));
  it("returns empty for symbols only", () => expect(slugify("!!!")).toBe(""));
  it("handles unicode letters", () => expect(slugify("Cafe Ole")).toBe("cafe-ole"));
});
`
  },
  cli: {
    description: "Command-line application",
    publishable: true,
    bin: true,
    dependencies: { "zod": "4.4.3" },
    source: `#!/usr/bin/env node
import { z } from "zod";
const firstArgSchema = z.string().trim().min(1).optional();
export function parseGreetingArgs(args: readonly string[]): string {
  const first = args[0];
  if (first === undefined) return "world";
  const parsed = firstArgSchema.safeParse(first);
  if (!parsed.success || parsed.data === undefined) return "world";
  return parsed.data;
}
export function formatGreeting(args: readonly string[]): string { return \`Hello, \${parseGreetingArgs(args)}!\`; }
export function runCli(argv: readonly string[]): void { console.log(formatGreeting(argv)); }
export function shouldRunCli(metaUrl: string, argvEntry: string): boolean {
  return metaUrl === new URL(argvEntry, "file:").href;
}
export function runEntry(
  argv: readonly string[],
  metaUrl: string,
  argvEntry: string,
  startCli: (args: readonly string[]) => void = runCli,
): void {
  if (shouldRunCli(metaUrl, argvEntry)) startCli(argv);
}
runEntry(process.argv.slice(2), import.meta.url, process.argv[1] ?? "");
`,
    test: `import { describe, expect, it, vi } from "vitest";
import { formatGreeting, parseGreetingArgs, runCli, runEntry, shouldRunCli } from "./index.js";
describe("formatGreeting", () => {
  it("uses an argument", () => expect(formatGreeting(["Oslo"])).toBe("Hello, Oslo!"));
  it("has a default", () => expect(formatGreeting([])).toBe("Hello, world!"));
  it("falls back for whitespace", () => expect(formatGreeting(["   "])).toBe("Hello, world!"));
});
describe("parseGreetingArgs", () => {
  it("trims a valid argument", () => expect(parseGreetingArgs(["  Oslo  "])).toBe("Oslo"));
});
describe("runCli", () => {
  it("prints a greeting", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    runCli(["Oslo"]);
    expect(log).toHaveBeenCalledWith("Hello, Oslo!");
    log.mockRestore();
  });
});
describe("runEntry", () => {
  it("detects direct execution", () => {
    expect(shouldRunCli("file:///srv/app/dist/index.js", "/srv/app/dist/index.js")).toBe(true);
    expect(shouldRunCli("file:///srv/app/dist/index.js", "/other/index.js")).toBe(false);
  });
  it("skips cli when not direct", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    runEntry(["Oslo"], "file:///a.js", "/b.js");
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("runEntry invokes cli for a matching argv entry", () => {
    const startCli = vi.fn<(args: readonly string[]) => void>();
    runEntry(["Oslo"], "file:///srv/app/dist/index.js", "/srv/app/dist/index.js", startCli);
    expect(startCli).toHaveBeenCalledWith(["Oslo"]);
  });
});
`
  }
};

/**
 * @param {readonly string[]} args
 */
export function parseArgs(args) {
  const values = {};
  for (let i = 0; i < args.length; i += 1) {
    const argument = args[i];
    if (argument === "--yes") values.yes = true;
    else if (argument === "--verify") values.verify = true;
    else if (argument === "--no-verify") values.noVerify = true;
    else if (argument?.startsWith("--")) {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      values[argument.slice(2)] = value;
      i += 1;
    }
  }
  return values;
}

/**
 * @param {string} value
 */
export function packageName(value) {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value)) throw new Error(`Invalid npm package name: ${value}`);
  return value;
}

/** @param {{ noVerify?: boolean, verify?: boolean, yes?: boolean }} parsed */
export function shouldVerifyAfterSetup(parsed) {
  if (parsed.noVerify) return false;
  if (parsed.verify) return true;
  return Boolean(parsed.yes);
}

/**
 * @param {string} nodeVersion
 * @param {string | undefined} engines
 */
export function assertNodeEngine(nodeVersion, engines) {
  if (!engines) return;
  const major = Number(nodeVersion.split(".")[0]);
  const minMatch = />=\s*(\d+)/.exec(engines);
  const maxMatch = /<\s*(\d+)/.exec(engines);
  if (!minMatch && !maxMatch) return;
  const minMajor = minMatch ? Number(minMatch[1]) : undefined;
  const maxExclusive = maxMatch ? Number(maxMatch[1]) : undefined;
  if (minMajor !== undefined && major < minMajor) {
    throw new Error(
      `Node.js ${minMajor}+ is required (${engines}). Found ${nodeVersion}. Use .nvmrc or .node-version.`,
    );
  }
  if (maxExclusive !== undefined && major >= maxExclusive) {
    throw new Error(
      `Node.js must be below ${maxExclusive} (${engines}). Found ${nodeVersion}. Use .nvmrc or .node-version.`,
    );
  }
}

/**
 * @param {string | undefined} scenario
 */
export function assertKnownScenario(scenario) {
  if (typeof scenario !== "string" || !(scenario in profiles)) {
    throw new Error(`Unknown scenario: ${typeof scenario === "string" ? scenario : ""}`);
  }
  return scenario;
}

/**
 * @param {unknown} value
 */
function optionalString(value) {
  return typeof value === "string" ? value : undefined;
}

/**
 * @param {Record<string, string | boolean | undefined>} parsed
 * @param {{ question: (prompt: string) => Promise<string> } | undefined} reader
 */
export async function resolveSetupOptions(parsed, reader) {
  const scenario = assertKnownScenario(
    optionalString(parsed.scenario) ?? await reader?.question(`Scenario (${Object.keys(profiles).join(", ")}): `)
  );
  const rawName = optionalString(parsed.name) ?? await reader?.question("npm package name: ") ?? "";
  const name = packageName(rawName);
  const profile = profiles[scenario];
  const answer = optionalString(parsed.description) ?? await reader?.question(`Description [${profile.description}]: `);
  return { scenario, name, description: answer || profile.description, profile };
}

/**
 * @param {{ scenario: SetupScenario, name: string, description: string, profile: (typeof profiles)[SetupScenario] }} selected
 * @param {{ runInstall?: boolean, baseDir?: string }} [options]
 */
export function applySetup(selected, options = {}) {
  const baseDir = options.baseDir ?? ".";
  const pkg = JSON.parse(readFileSync(join(baseDir, "package.json"), "utf8"));
  pkg.name = selected.name;
  pkg.description = selected.description;
  pkg.private = !selected.profile.publishable;
  pkg.keywords = ["typescript", "nodejs", selected.scenario];
  if (selected.profile.publishable) pkg.scripts.prepublishOnly = "npm run check";
  else delete pkg.scripts.prepublishOnly;
  if (selected.profile.bin) pkg.bin = { [selected.name.replace(/^@[^/]+\//, "")]: "./dist/index.js" };
  else delete pkg.bin;
  if (selected.profile.dependencies) pkg.dependencies = selected.profile.dependencies;
  else delete pkg.dependencies;
  if (selected.scenario === "mcp") {
    pkg.scripts["test:mcp"] = "npm run build && node scripts/test-mcp.mjs";
  } else {
    delete pkg.scripts["test:mcp"];
  }
  writeFileSync(join(baseDir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(join(baseDir, "src/index.ts"), selected.profile.source);
  writeFileSync(join(baseDir, "src/index.test.ts"), selected.profile.test);
  writeFileSync(
    join(baseDir, "SETUP.md"),
    `# Setup result\n\nScenario: ${selected.scenario}\n\nPackage: ${selected.name}\n\nUpdate repository URLs in \`package.json\`, then remove this file.\n`
  );
  if (selected.scenario === "mcp") {
    writeMcpSmokeScripts(baseDir);
  }
  if (options.runInstall !== false) {
    runNpm(["install", "--save-exact", "--ignore-scripts"], { cwd: baseDir, stdio: "inherit" });
  }
}

/**
 * @param {readonly string[]} argv
 */
export async function runSetupCli(argv) {
  const parsed = parseArgs(argv);
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assertNodeEngine(process.versions.node, pkg.engines?.node);
  const reader = parsed.yes ? undefined : createInterface({ input: stdin, output: stdout });
  try {
    const selected = await resolveSetupOptions(parsed, reader);
    applySetup(selected, { runInstall: true });
    console.log(`Configured ${selected.name} as a ${selected.scenario} project.`);
    if (shouldVerifyAfterSetup(parsed)) {
      runNpm(["run", "check"], { stdio: "inherit" });
      if (selected.scenario === "mcp") {
        runNpm(["run", "test:mcp"], { stdio: "inherit" });
      }
      if (selected.profile.publishable) {
        runNpm(["pack", "--dry-run"], { stdio: "inherit" });
      }
    }
  } finally {
    reader?.close();
  }
}
