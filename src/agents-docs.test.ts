import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const agentsMd = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
const architectureMd = readFileSync(new URL("../docs/architecture.md", import.meta.url), "utf8");

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

  it("describes layout and setup scenarios in architecture.md", () => {
    expect(architectureMd).toMatch(/`src\//);
    expect(architectureMd).toMatch(/scripts\/setup-lib\.mjs/);
    expect(architectureMd).toMatch(/\.test\.ts/);
    for (const scenario of ["plugin", "mcp", "npm-package", "cli"]) {
      expect(architectureMd).toContain(scenario);
    }
  });
});
