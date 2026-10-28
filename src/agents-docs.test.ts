import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adrDirUrl = new URL("../docs/adr/", import.meta.url);
const adrDir = fileURLToPath(adrDirUrl);
const adrIndexMd = readFileSync(new URL("README.md", adrDirUrl), "utf8");

function listAdrMarkdownFilenames(): string[] {
  return readdirSync(adrDir)
    .filter((name) => /^\d{4}-.+\.md$/u.test(name))
    .toSorted((a, b) => a.localeCompare(b));
}

const agentsMd = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
const architectureMd = readFileSync(new URL("../docs/architecture.md", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
const sonarPackageJson = readFileSync(
  new URL("../packages/eslint-sonarjs/package.json", import.meta.url),
  "utf8",
);
const toolingAdrMd = readFileSync(
  new URL("../docs/adr/0009-tooling-and-quality-gate-stack.md", import.meta.url),
  "utf8",
);

function readDevDependencyNames(packageJsonText: string): string[] {
  const parsed: unknown = JSON.parse(packageJsonText);
  if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid package.json");
  const devDependencies = Reflect.get(parsed, "devDependencies");
  if (typeof devDependencies !== "object" || devDependencies === null) {
    throw new Error("Missing devDependencies");
  }
  return Object.keys(devDependencies).toSorted((a, b) => a.localeCompare(b));
}

function expectToolingAdrSection(toolingAdr: string, marker: string): void {
  expect(toolingAdr, `missing tooling ADR section marker ${marker}`).toContain(
    `<!-- devDependency: ${marker} -->`,
  );
}

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

  it("lists every ADR file in docs/adr/README.md", () => {
    for (const filename of listAdrMarkdownFilenames()) {
      expect(adrIndexMd, `missing index entry for ${filename}`).toContain(filename);
    }
  });

  it("documents every root devDependency in ADR 0009", () => {
    const names = readDevDependencyNames(packageJson);
    expect.assertions(names.length);
    for (const name of names) {
      expectToolingAdrSection(toolingAdrMd, name);
    }
  });

  it("documents every eslint-sonarjs devDependency in ADR 0009", () => {
    const names = readDevDependencyNames(sonarPackageJson);
    expect.assertions(names.length);
    for (const name of names) {
      expectToolingAdrSection(toolingAdrMd, `packages/eslint-sonarjs/${name}`);
    }
  });

  it("points AGENTS.md verification tools at ADR 0009", () => {
    expect(agentsMd).toMatch(/0009-tooling-and-quality-gate-stack\.md/);
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
