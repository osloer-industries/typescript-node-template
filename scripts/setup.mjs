#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const profiles = {
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
describe("createPlugin", () => { it("activates", () => { const log = vi.fn(); const plugin = createPlugin("example"); plugin.activate({ log }); expect(log).toHaveBeenCalledWith("example activated"); }); });
`
  },
  mcp: {
    description: "Model Context Protocol stdio server",
    dependencies: { "@modelcontextprotocol/sdk": "1.30.0", "zod": "4.4.3" },
    source: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
export function createGreetingResult(name: string) { return { content: [{ type: "text" as const, text: \`Hello, \${name}!\` }] }; }
export function createServer(): McpServer {
  const server = new McpServer({ name: "example-mcp-server", version: "0.1.0" });
  server.registerTool("greet", { description: "Return a greeting", inputSchema: { name: z.string().trim().min(1).default("world") } },
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
import { createGreetingResult, createServer } from "./index.js";
describe("MCP server", () => { it("creates a server", () => expect(createServer()).toBeDefined()); it("formats responses", () => expect(createGreetingResult("Oslo")).toEqual({ content: [{ type: "text", text: "Hello, Oslo!" }] })); });
`
  },
  "npm-package": {
    description: "Publishable npm library",
    publishable: true,
    source: `export function slugify(value: string): string { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
`,
    test: `import { describe, expect, it } from "vitest";
import { slugify } from "./index.js";
describe("slugify", () => { it("normalizes text", () => expect(slugify(" Hello, TypeScript! ")).toBe("hello-typescript")); });
`
  },
  cli: {
    description: "Command-line application",
    publishable: true,
    bin: true,
    source: `#!/usr/bin/env node
export function formatGreeting(args: readonly string[]): string { return \`Hello, \${args[0]?.trim() || "world"}!\`; }
/* v8 ignore start */
if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) console.log(formatGreeting(process.argv.slice(2)));
/* v8 ignore stop */
`,
    test: `import { describe, expect, it } from "vitest";
import { formatGreeting } from "./index.js";
describe("formatGreeting", () => { it("uses an argument", () => expect(formatGreeting(["Oslo"])).toBe("Hello, Oslo!")); it("has a default", () => expect(formatGreeting([])).toBe("Hello, world!")); });
`
  }
};

function parseArgs(args) {
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

function packageName(value) {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value)) throw new Error(`Invalid npm package name: ${value}`);
  return value;
}

async function options(args) {
  const parsed = parseArgs(args);
  const reader = parsed.yes ? undefined : createInterface({ input: stdin, output: stdout });
  try {
    const scenario = parsed.scenario ?? await reader?.question(`Scenario (${Object.keys(profiles).join(", ")}): `);
    if (!scenario || !(scenario in profiles)) throw new Error(`Unknown scenario: ${scenario ?? ""}`);
    const name = packageName(parsed.name ?? await reader?.question("npm package name: ") ?? "");
    const profile = profiles[scenario];
    const answer = parsed.description ?? await reader?.question(`Description [${profile.description}]: `);
    return { scenario, name, description: answer || profile.description, profile };
  } finally { reader?.close(); }
}

const selected = await options(process.argv.slice(2));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.name = selected.name;
pkg.description = selected.description;
pkg.private = !selected.profile.publishable;
pkg.keywords = ["typescript", "nodejs", selected.scenario];
if (selected.profile.publishable) pkg.scripts.prepublishOnly = "npm run check"; else delete pkg.scripts.prepublishOnly;
if (selected.profile.bin) pkg.bin = { [selected.name.replace(/^@[^/]+\//, "")]: "./dist/index.js" }; else delete pkg.bin;
if (selected.profile.dependencies) pkg.dependencies = selected.profile.dependencies; else delete pkg.dependencies;
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
writeFileSync("src/index.ts", selected.profile.source);
writeFileSync("src/index.test.ts", selected.profile.test);
writeFileSync("SETUP.md", `# Setup result\n\nScenario: ${selected.scenario}\n\nPackage: ${selected.name}\n\nRun \`npm run check\`, update repository URLs, then remove this file.\n`);
execFileSync("npm", ["install", "--save-exact"], { stdio: "inherit" });
console.log(`Configured ${selected.name} as a ${selected.scenario} project.`);
