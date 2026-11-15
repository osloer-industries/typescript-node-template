import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { copyTemplateFixture } from "./copy-template-fixture.mjs";
import {
  applySetup,
  assertKnownScenario,
  configureHarnessDevDependencies,
  harnessDevDependencyKeys,
  parseArgs,
  packageName,
  pickHarnessDevDependencies,
  profiles,
  resolveSetupOptions,
} from "./setup-lib.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function readPackageField(packageJsonPath: string, field: string): unknown {
  const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid package.json");
  return Reflect.get(parsed, field);
}

describe("parseArgs", () => {
  it("accepts scenario flags", () => {
    expect(parseArgs(["--scenario", "cli", "--name", "demo-cli", "--yes"])).toEqual({
      yes: true,
      scenario: "cli",
      name: "demo-cli"
    });
  });

  it("throws when a flag value is missing", () => {
    expect(() => parseArgs(["--scenario"])).toThrow("Missing value for --scenario");
  });
});

describe("packageName", () => {
  it("accepts scoped names", () => {
    expect(packageName("@acme/demo")).toBe("@acme/demo");
  });

  it("rejects invalid names", () => {
    expect(() => packageName("Bad Name")).toThrow("Invalid npm package name");
  });
});

describe("assertKnownScenario", () => {
  it("returns known scenarios", () => {
    expect(assertKnownScenario("mcp")).toBe("mcp");
  });

  it("throws for unknown scenarios", () => {
    expect(() => assertKnownScenario("unknown")).toThrow("Unknown scenario: unknown");
  });
});

describe("resolveSetupOptions", () => {
  it("resolves unattended options", async () => {
    const selected = await resolveSetupOptions(
      { yes: true, scenario: "plugin", name: "demo-plugin", description: "Demo" },
      undefined
    );
    expect(selected.scenario).toBe("plugin");
    expect(selected.name).toBe("demo-plugin");
    expect(selected.description).toBe("Demo");
  });

  it("uses the profile description when omitted", async () => {
    const selected = await resolveSetupOptions(
      { yes: true, scenario: "plugin", name: "demo-plugin" },
      undefined
    );
    expect(selected.description).toBe(profiles.plugin.description);
  });

  it("prompts for missing fields", async () => {
    const reader = {
      question: vi
        .fn<(prompt: string) => Promise<string>>()
        .mockResolvedValueOnce("plugin")
        .mockResolvedValueOnce("demo-plugin")
        .mockResolvedValueOnce("")
    };
    const selected = await resolveSetupOptions({}, reader);
    expect(selected.scenario).toBe("plugin");
    expect(selected.name).toBe("demo-plugin");
    expect(selected.description).toBe(profiles.plugin.description);
  });
});

describe("configureHarnessDevDependencies", () => {
  it("prunes MCP-only deps for in-repo non-mcp setup", () => {
    const pkg = {
      devDependencies: {
        "@fast-check/vitest": "0.5.0",
        "fast-check": "4.10.2",
        vitest: "5.0.2",
      },
    };
    configureHarnessDevDependencies(pkg, "npm-package", repoRoot);
    expect(pkg.devDependencies).not.toHaveProperty("@fast-check/vitest");
    expect(pkg.devDependencies?.["fast-check"]).toBe("4.10.2");
    expect(pkg.devDependencies?.vitest).toBe("5.0.2");
  });

  it("drops @fast-check/vitest for in-repo mcp setup", () => {
    const pkg = {
      devDependencies: {
        "@fast-check/vitest": "0.5.0",
        "fast-check": "4.10.2",
      },
    };
    configureHarnessDevDependencies(pkg, "mcp", repoRoot);
    expect(pkg.devDependencies).not.toHaveProperty("@fast-check/vitest");
    expect(pkg.devDependencies?.["fast-check"]).toBe("4.10.2");
  });
});

describe("pickHarnessDevDependencies", () => {
  it("omits MCP-only tooling for non-mcp scenarios", () => {
    const template = { knip: "6.45.1", "fast-check": "4.10.2", vitest: "5.0.2" };
    const picked = pickHarnessDevDependencies("plugin", template);
    expect(picked).toMatchObject({ knip: "6.45.1", vitest: "5.0.2" });
    expect(picked).not.toHaveProperty("fast-check");
  });

  it("retains MCP harness deps for the mcp scenario", () => {
    const template = { knip: "6.45.1", "fast-check": "4.10.2", vitest: "5.0.2" };
    const picked = pickHarnessDevDependencies("mcp", template);
    expect(picked["fast-check"]).toBe("4.10.2");
  });

  it("lists the shared harness keys", () => {
    expect(harnessDevDependencyKeys).toContain("knip");
    expect(harnessDevDependencyKeys).not.toContain("fast-check");
  });
});

describe("applySetup metadata", () => {
  it("removes dependencies for the plugin scenario", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "setup-plugin-meta-"));
    try {
      copyTemplateFixture(repoRoot, tempDir);
      applySetup(
        {
          scenario: "plugin",
          name: "demo-plugin",
          description: "Demo",
          profile: profiles.plugin
        },
        { runInstall: false, baseDir: tempDir }
      );
      expect(readPackageField(join(tempDir, "package.json"), "private")).toBe(true);
      expect(readPackageField(join(tempDir, "package.json"), "dependencies")).toBeUndefined();
      const devDependencies = readPackageField(join(tempDir, "package.json"), "devDependencies");
      if (typeof devDependencies !== "object" || devDependencies === null) {
        throw new Error("Invalid devDependencies");
      }
      expect(Reflect.get(devDependencies, "knip")).toBeDefined();
      expect(Reflect.get(devDependencies, "fast-check")).toBeUndefined();
      expect(Reflect.get(devDependencies, "@fast-check/vitest")).toBeUndefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("drops devDependencies that duplicate production dependencies", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "setup-dedupe-deps-"));
    try {
      copyTemplateFixture(repoRoot, tempDir);
      applySetup(
        {
          scenario: "mcp",
          name: "demo-mcp",
          description: "Demo MCP",
          profile: profiles.mcp,
        },
        { runInstall: false, baseDir: tempDir },
      );
      const devDependencies = readPackageField(join(tempDir, "package.json"), "devDependencies");
      const dependencies = readPackageField(join(tempDir, "package.json"), "dependencies");
      if (typeof devDependencies !== "object" || devDependencies === null) {
        throw new Error("Invalid devDependencies");
      }
      if (typeof dependencies !== "object" || dependencies === null) {
        throw new Error("Invalid dependencies");
      }
      expect(Reflect.get(dependencies, "@modelcontextprotocol/sdk")).toBeDefined();
      expect(Reflect.get(devDependencies, "@modelcontextprotocol/sdk")).toBeUndefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("adds MCP smoke scripts for the mcp scenario", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "setup-mcp-scripts-"));
    try {
      copyTemplateFixture(repoRoot, tempDir);
      applySetup(
        {
          scenario: "mcp",
          name: "demo-mcp",
          description: "Demo MCP",
          profile: profiles.mcp
        },
        { runInstall: false, baseDir: tempDir }
      );
      const scripts = readPackageField(join(tempDir, "package.json"), "scripts");
      if (typeof scripts !== "object" || scripts === null) throw new Error("Invalid scripts");
      expect(Reflect.get(scripts, "test:mcp")).toMatch(/scripts\/test-mcp\.mjs/);
      expect(readFileSync(join(tempDir, "scripts/test-mcp.mjs"), "utf8")).toContain(
        "runGeneratedTestMcpCli"
      );
      expect(readFileSync(join(tempDir, "scripts/mcp-stdio-smoke.mjs"), "utf8")).toContain("runMcpStdioSmoke");
      expect(readFileSync(join(tempDir, "scripts/test-mcp.test.mjs"), "utf8")).toContain("runGeneratedTestMcpCli");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("configures publishable bin packages", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "setup-bin-"));
    try {
      copyTemplateFixture(repoRoot, tempDir);
      applySetup(
        {
          scenario: "cli",
          name: "@acme/demo-cli",
          description: "Demo CLI",
          profile: profiles.cli
        },
        { runInstall: false, baseDir: tempDir }
      );
      const packageJsonPath = join(tempDir, "package.json");
      expect(readPackageField(packageJsonPath, "private")).toBe(false);
      const bin = readPackageField(packageJsonPath, "bin");
      if (typeof bin !== "object" || bin === null) throw new Error("Invalid bin field");
      expect(Reflect.get(bin, "demo-cli")).toBe("./dist/index.js");
      const dependencies = readPackageField(packageJsonPath, "dependencies");
      if (typeof dependencies !== "object" || dependencies === null) throw new Error("Invalid dependencies");
      expect(Reflect.get(dependencies, "zod")).toBeDefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
