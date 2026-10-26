import { runNpm } from "./run-npm.mjs";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { copyTemplateFixture } from "./copy-template-fixture.mjs";
import {
  applySetup,
  assertKnownScenario,
  parseArgs,
  packageName,
  profiles,
  resolveSetupOptions
} from "./setup-lib.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function readPackageField(packageJsonPath: string, field: string): unknown {
  const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid package.json");
  return Reflect.get(parsed, field);
}

function readPackageName(packageJsonPath: string): string {
  const name = readPackageField(packageJsonPath, "name");
  if (typeof name !== "string") throw new Error("Invalid package name");
  return name;
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

describe("setup integration", () => {
  const scenarioMarkers: Record<string, string> = {
    plugin: "createPlugin",
    mcp: "@modelcontextprotocol/sdk",
    "npm-package": "slugify",
    cli: "parseGreetingArgs"
  };

  for (const scenario of Object.keys(profiles)) {
    it(`configures the ${scenario} scenario and passes check`, async () => {
      const tempDir = mkdtempSync(join(tmpdir(), `setup-${scenario}-`));
      try {
        copyTemplateFixture(repoRoot, tempDir);
        const selected = await resolveSetupOptions(
          { yes: true, scenario, name: `demo-${scenario}`, description: "Integration test" },
          undefined
        );
        const needsInstall = scenario !== "plugin";
        applySetup(selected, { runInstall: needsInstall, baseDir: tempDir });
        if (!needsInstall) {
          symlinkSync(join(repoRoot, "node_modules"), join(tempDir, "node_modules"), "junction");
        }
        const indexSource = readFileSync(join(tempDir, "src/index.ts"), "utf8");
        expect(indexSource).toContain(scenarioMarkers[scenario]);
        expect(readPackageName(join(tempDir, "package.json"))).toBe(`demo-${scenario}`);
        runNpm(["run", "check"], {
          cwd: tempDir,
          stdio: "pipe",
          timeout: 300_000,
          env: { ...process.env, NPM_CONFIG_FUND: "false", NPM_CONFIG_AUDIT: "false" }
        });
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }, 360_000);
  }
});
