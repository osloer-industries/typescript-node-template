import { runNpm } from "./run-npm.mjs";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { copyTemplateFixture } from "./copy-template-fixture.mjs";
import { applySetup, profiles, resolveSetupOptions } from "./setup-lib.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function readPackageName(packageJsonPath: string): string {
  const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid package.json");
  const name = Reflect.get(parsed, "name");
  if (typeof name !== "string") throw new Error("Invalid package name");
  return name;
}

describe("setup integration", () => {
  const scenarioMarkers: Record<string, string> = {
    plugin: "createPlugin",
    mcp: "@modelcontextprotocol/sdk",
    "npm-package": "slugify",
    cli: "parseGreetingArgs",
  };

  for (const scenario of Object.keys(profiles)) {
    it(`configures the ${scenario} scenario and passes check`, async () => {
      const tempDir = mkdtempSync(join(tmpdir(), `setup-${scenario}-`));
      try {
        copyTemplateFixture(repoRoot, tempDir);
        const selected = await resolveSetupOptions(
          { yes: true, scenario, name: `demo-${scenario}`, description: "Integration test" },
          undefined,
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
          env: { ...process.env, NPM_CONFIG_FUND: "false", NPM_CONFIG_AUDIT: "false" },
        });
        if (scenario === "mcp") {
          runNpm(["run", "test:mcp"], {
            cwd: tempDir,
            stdio: "pipe",
            timeout: 120_000,
            env: { ...process.env, NPM_CONFIG_FUND: "false", NPM_CONFIG_AUDIT: "false" },
          });
        }
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }, 360_000);
  }
});
