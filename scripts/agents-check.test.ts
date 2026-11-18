import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixturesRoot = join(repoRoot, "scripts/__fixtures__/agents-check");
const nodeArgs = ["scripts/agents-check.ts"];

async function loadModule() {
  return import("./agents-check.js");
}

function copyFixtureTree(name: string, destination: string): void {
  cpSync(join(fixturesRoot, name), destination, { recursive: true });
}

function copyAgentsCheckScript(destinationRoot: string): void {
  const scriptsDir = join(destinationRoot, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  cpSync(join(repoRoot, "scripts/agents-check.ts"), join(scriptsDir, "agents-check.ts"));
}

describe("isPlaceholderToken", () => {
  it("skips globs, brackets, and parent-relative paths", async () => {
    const { isPlaceholderToken } = await loadModule();
    expect(isPlaceholderToken(".github/workflows/**")).toBe(true);
    expect(isPlaceholderToken(".agents/skills/<name>/SKILL.md")).toBe(true);
    expect(isPlaceholderToken("../docs/architecture.md")).toBe(true);
    expect(isPlaceholderToken("src/index.ts")).toBe(false);
  });
});

describe("isPathLikeBacktickToken", () => {
  it("matches paths with extensions or trailing slashes", async () => {
    const { isPathLikeBacktickToken } = await loadModule();
    expect(isPathLikeBacktickToken("src/")).toBe(true);
    expect(isPathLikeBacktickToken("scripts/foo.ts")).toBe(true);
    expect(isPathLikeBacktickToken("CLAUDE.md")).toBe(false);
    expect(isPathLikeBacktickToken("--paths a/b.ts")).toBe(false);
  });
});

describe("extractGuidanceReferences", () => {
  it("collects links, backticks, fenced npm run, and node commands", async () => {
    const { extractGuidanceReferences } = await loadModule();
    const text = [
      "See [doc](docs/readme.md) and `scripts/a.mjs`.",
      "",
      "```sh",
      "node scripts/run.ts",
      "npm run build",
      "```",
    ].join("\n");
    const refs = extractGuidanceReferences(text);
    expect(refs.some((entry) => entry.kind === "path" && entry.token === "docs/readme.md")).toBe(true);
    expect(refs.some((entry) => entry.kind === "path" && entry.token === "scripts/a.mjs")).toBe(true);
    expect(refs.some((entry) => entry.kind === "path" && entry.token === "scripts/run.ts")).toBe(true);
    expect(refs.some((entry) => entry.kind === "npm-script" && entry.token === "build")).toBe(true);
  });

  it("accepts CRLF line endings", async () => {
    const { extractGuidanceReferences } = await loadModule();
    const text = "Link [x](src/index.ts)\r\n";
    const refs = extractGuidanceReferences(text);
    expect(refs).toEqual([{ kind: "path", line: 1, token: "src/index.ts" }]);
  });
});

describe("path resolution", () => {
  it("accepts repo-relative and guidance-file-relative targets", async () => {
    const { pathExistsInRepo, candidatePathResolutions } = await loadModule();
    expect(candidatePathResolutions("docs/agent-guard-hooks.md", "../scripts/agents-check.ts")).toEqual([
      "../scripts/agents-check.ts",
      "scripts/agents-check.ts",
    ]);
    expect(
      pathExistsInRepo(repoRoot, ".github/pull_request_template.md", "../AGENTS.md"),
    ).toBe(true);
    expect(pathExistsInRepo(repoRoot, "AGENTS.md", "scripts/agents-check.ts")).toBe(true);
  });
});

describe("allowlist", () => {
  it("skips scenario-generated paths and npm scripts", async () => {
    const { isAllowlistedPath, isAllowlistedNpmScript, validateReference } = await loadModule();
    expect(isAllowlistedPath("SETUP.md")).toBe(true);
    expect(isAllowlistedPath("dist/index.js")).toBe(true);
    expect(isAllowlistedNpmScript("test:mcp")).toBe(true);
    expect(isAllowlistedNpmScript("prepublishOnly")).toBe(true);

    const allowed = validateReference(
      repoRoot,
      "AGENTS.md",
      { kind: "npm-script", line: 1, token: "test:mcp" },
      new Set(["lint"]),
    );
    expect(allowed).toBeNull();
  });
});

describe("collectGuidanceFindings", () => {
  it("returns no findings for the clean fixture", async () => {
    const { collectGuidanceFindings } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-clean-"));
    try {
      copyFixtureTree("clean", tempDir);
      expect(collectGuidanceFindings(tempDir)).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports broken paths and unknown npm scripts in the broken fixture", async () => {
    const { collectGuidanceFindings } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-broken-"));
    try {
      copyFixtureTree("broken", tempDir);
      const findings = collectGuidanceFindings(tempDir);
      expect(findings.some((entry) => entry.kind === "path" && entry.token.includes("missing"))).toBe(
        true,
      );
      expect(findings.some((entry) => entry.kind === "npm-script" && entry.token === "does-not-exist"))
        .toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("agents-check gate canary", () => {
  it("treats a clean fixture as a failed canary when expecting violations", async () => {
    const { collectGuidanceFindings } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-canary-"));
    try {
      copyFixtureTree("clean", tempDir);
      const findings = collectGuidanceFindings(tempDir);
      expect(findings).toEqual([]);
      let harnessError = "";
      try {
        expect(findings, "canary harness must fail when guidance has no broken references").not.toEqual(
          [],
        );
      } catch (error) {
        harnessError = String(error);
      }
      expect(harnessError).toContain("canary harness must fail");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("agents-check CLI", () => {
  it("passes on the template repository", () => {
    const output = execFileSync(process.execPath, nodeArgs, {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(output).toMatch(/Agent guidance paths and npm scripts OK/);
  });

  it("fails with broken path and unknown npm script findings", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-cli-broken-"));
    try {
      copyFixtureTree("broken", tempDir);
      copyAgentsCheckScript(tempDir);
      let failed = false;
      let combined = "";
      try {
        execFileSync(process.execPath, nodeArgs, { cwd: tempDir, encoding: "utf8" });
      } catch (error) {
        failed = true;
        if (error !== null && typeof error === "object") {
          const stdout = Reflect.get(error, "stdout");
          const stderr = Reflect.get(error, "stderr");
          if (typeof stdout === "string") combined += stdout;
          if (typeof stderr === "string") combined += stderr;
        }
      }
      expect(failed, "expected non-zero exit for broken fixture").toBe(true);
      expect(combined).toMatch(/broken path/);
      expect(combined).toMatch(/unknown npm script/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("passes for the clean planted fixture", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-cli-clean-"));
    try {
      copyFixtureTree("clean", tempDir);
      copyAgentsCheckScript(tempDir);
      const output = execFileSync(process.execPath, nodeArgs, {
        cwd: tempDir,
        encoding: "utf8",
      });
      expect(output).toMatch(/OK/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runAgentsCheckCliEntry", () => {
  it("returns 0 for clean trees and 1 when findings exist", async () => {
    const { runAgentsCheckCliEntry } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-entry-"));
    const modulePath = join(tempDir, "scripts/agents-check.ts");
    try {
      copyFixtureTree("clean", tempDir);
      copyAgentsCheckScript(tempDir);
      const moduleUrl = pathToFileURL(modulePath).href;
      expect(runAgentsCheckCliEntry(moduleUrl)).toBe(0);

      const agentsPath = join(tempDir, "AGENTS.md");
      const agentsText = readFileSync(agentsPath, "utf8");
      writeFileSync(agentsPath, agentsText + "\nBroken `nowhere/missing.ts`.\n", "utf8");
      let stderr = "";
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
        stderr += String(chunk);
        return true;
      });
      expect(runAgentsCheckCliEntry(moduleUrl)).toBe(1);
      stderrSpy.mockRestore();
      expect(stderr).toMatch(/broken path/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});