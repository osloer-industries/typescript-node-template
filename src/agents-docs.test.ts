import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const agentsMd = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
const architectureMd = readFileSync(new URL("../docs/architecture.md", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

describe("agent documentation contract", () => {
  it("documents operational sections in AGENTS.md", () => {
    expect(agentsMd).toMatch(/## Repository map/i);
    expect(agentsMd).toMatch(/## Verification/i);
    expect(agentsMd).toMatch(/## Change recipes/i);
    expect(agentsMd).toMatch(/## Do not edit without reason/i);
  });

  it("links architecture.md from AGENTS.md", () => {
    expect(agentsMd).toMatch(/docs\/architecture\.md/);
  });

  it("links sonar-quality-gate.md from AGENTS.md", () => {
    expect(agentsMd).toMatch(/docs\/sonar-quality-gate\.md/);
  });

  it("does not reference Cursor-only bootstrap paths", () => {
    expect(agentsMd).not.toMatch(/cursor-agent-setup/);
    expect(agentsMd).not.toMatch(/\.cursor\//);
    expect(agentsMd).not.toMatch(/\.agents\/skills/);
  });

  it("includes SonarJS and duplication gates in npm run check", () => {
    const parsed: unknown = JSON.parse(packageJson);
    if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid package.json");
    const scripts = Reflect.get(parsed, "scripts");
    if (typeof scripts !== "object" || scripts === null) throw new Error("Missing scripts");
    const check = Reflect.get(scripts, "check");
    expect(typeof check).toBe("string");
    expect(check).toContain("lint:sonarjs");
    expect(check).toContain("lint:dup");
  });

  it("links MCP and dependency pattern docs from AGENTS.md", () => {
    expect(agentsMd).toMatch(/docs\/mcp-stdio-smoke-test\.md/);
    expect(agentsMd).toMatch(/docs\/mcp-account-data-agents\.md/);
    expect(agentsMd).toMatch(/docs\/playwright-ci-dependencies\.md/);
    expect(agentsMd).toMatch(/docs\/npm-overrides\.md/);
  });

  it("describes layout and setup scenarios in architecture.md", () => {
    expect(architectureMd).toMatch(/`src\//);
    expect(architectureMd).toMatch(/scripts\/setup-lib\.mjs/);
    expect(architectureMd).toMatch(/\.test\.ts/);
    for (const scenario of ["plugin", "mcp", "npm-package", "cli"]) {
      expect(architectureMd).toContain(scenario);
    }
  });
});
