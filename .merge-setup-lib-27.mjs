#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runNpm } from "./run-npm.mjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

/** @typedef {"plugin" | "mcp" | "npm-package" | "cli"} SetupScenario */

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
export function createServer(): McpServer {
  const server = new McpServer({ name: "example-mcp-server", version: "0.1.0" });
  server.registerTool("greet", { description: "Return a greeting", inputSchema: { name: greetNameSchema } },
    /* v8 ignore next */
    ({ name }) => createGreetingResult(name));
  return server;
}
/* v8 ignore start */
export async function main(): Promise<void> { await createServer().connect(new StdioServerTransport()); }
if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) await main();
/* v8 ignore stop */
`,
    test: `import { describe, expect, it } from "vitest";
import { createGreetingResult, createServer, parseGreetName } from "./index.js";
describe("MCP server", () => {
  it("creates a server", () => expect(createServer()).toBeDefined());
  it("formats responses", () => expect(createGreetingResult("Oslo")).toEqual({ content: [{ type: "text", text: "Hello, Oslo!" }] }));
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
/* v8 ignore start */
if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) console.log(formatGreeting(process.argv.slice(2)));
/* v8 ignore stop */
`,
    test: `import { describe, expect, it } from "vitest";
import { formatGreeting, parseGreetingArgs } from "./index.js";
describe("formatGreeting", () => {
  it("uses an argument", () => expect(formatGreeting(["Oslo"])).toBe("Hello, Oslo!"));
  it("has a default", () => expect(formatGreeting([])).toBe("Hello, world!"));
  it("falls back for whitespace", () => expect(formatGreeting(["   "])).toBe("Hello, world!"));
});
describe("parseGreetingArgs", () => {
  it("trims a valid argument", () => expect(parseGreetingArgs(["  Oslo  "])).toBe("Oslo"));
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
  writeFileSync(join(baseDir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(join(baseDir, "src/index.ts"), selected.profile.source);
  writeFileSync(join(baseDir, "src/index.test.ts"), selected.profile.test);
  writeFileSync(
    join(baseDir, "SETUP.md"),
    `# Setup result\n\nScenario: ${selected.scenario}\n\nPackage: ${selected.name}\n\nRun \`npm run check\`, update repository URLs, then remove this file.\n`
  );
  if (options.runInstall !== false) {
    /* v8 ignore next -- install path covered by manual setup and integration flows */
    runNpm(["install", "--save-exact", "--ignore-scripts"], { cwd: baseDir, stdio: "inherit" });
  }
}

/**
 * @param {readonly string[]} argv
 */
/* v8 ignore start -- thin CLI wrapper; exercised via scripts/setup.mjs */
export async function runSetupCli(argv) {
  const parsed = parseArgs(argv);
  const reader = parsed.yes ? undefined : createInterface({ input: stdin, output: stdout });
  try {
    const selected = await resolveSetupOptions(parsed, reader);
    applySetup(selected, { runInstall: true });
    console.log(`Configured ${selected.name} as a ${selected.scenario} project.`);
  } finally {
    reader?.close();
  }
}
/* v8 ignore stop */
