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
    expect(agentsMd).toMatch(/## Enforced escape-hatch rules/i);
  });

  it("links architecture.md from AGENTS.md", () => {
    expect(agentsMd).toMatch(/docs\/architecture\.md/);
  });

  it("documents ADRs in AGENTS.md", () => {
    expect(agentsMd).toMatch(/docs\/adr\//);
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
    expect(check).toContain("lint:suppressions");
    expect(check).toContain("lint:sonarjs");
    expect(check).toContain("lint:dup");
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
