import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { copyTemplateFixture } from "./copy-template-fixture.mjs";
import { applySetup, resolveSetupOptions } from "./setup-lib.mjs";
import { runNpm } from "./run-npm.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const contractRunnerSource = `import { createServer } from "./dist/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = createServer();
await server.connect(serverTransport);

const client = new Client({ name: "contract-test", version: "0.0.0" });
await client.connect(clientTransport);

const result = await client.callTool({ name: "greet", arguments: { name: "Contract" } });
const first = result.content?.[0];
if (first?.type !== "text" || first.text !== "Hello, Contract!") {
  process.stderr.write(JSON.stringify(result));
  process.exit(1);
}

await client.close();
await server.close();
process.stdout.write("ok\\n");
`;

describe("MCP setup profile contract", () => {
  it("calls greet over an in-memory MCP transport", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mcp-contract-"));
    try {
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

      writeFileSync(join(tempDir, "mcp-contract-runner.mjs"), contractRunnerSource, "utf8");
      const output = execFileSync(process.execPath, [join(tempDir, "mcp-contract-runner.mjs")], {
        cwd: tempDir,
        encoding: "utf8",
        timeout: 60_000,
      });
      expect(output.trim()).toBe("ok");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 360_000);
});
