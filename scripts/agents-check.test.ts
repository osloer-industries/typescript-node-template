import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const agentsCheckRelative = "scripts/agents-check.ts";
const nodeArgs = [agentsCheckRelative];
const pathReferenceKind = "path";
const npmScriptReferenceKind = "npm-script";
const fixturePackageJsonRelative = "package.json";
const fixtureAgentsMdRelative = "AGENTS.md";
const fixtureSrcIndexRelative = "src/index.ts";
const fileUtf8 = "utf8";
const modulePackageType = "module";

function writeAgentsCheckFixturePackage(root: string, packageName: string): void {
  writeFileSync(
    join(root, fixturePackageJsonRelative),
    `${JSON.stringify(
      {
        name: packageName,
        type: modulePackageType,
        private: true,
        scripts: { lint: "echo lint" },
      },
      null,
      2,
    )}\n`,
    fileUtf8,
  );
}

function hasPathReference(
  refs: Array<{ kind: string; token: string }>,
  token: string,
): boolean {
  return refs.some((entry) => entry.kind === pathReferenceKind && entry.token === token);
}

function execFailureOutput(error: unknown): string {
  if (error === null || typeof error !== "object") {
    return "";
  }
  const stdout = Reflect.get(error, "stdout");
  const stderr = Reflect.get(error, "stderr");
  let combined = "";
  if (typeof stdout === "string") {
    combined += stdout;
  }
  if (typeof stderr === "string") {
    combined += stderr;
  }
  return combined;
}

async function loadModule() {
  return import("./agents-check.js");
}

function writeCleanAgentsCheckFixture(root: string): void {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, fixtureAgentsMdRelative),
    [
      "# Clean fixture",
      "",
      `Run \`npm run lint\` and edit \`${fixtureSrcIndexRelative}\`.`,
      "",
      `See [${fixtureSrcIndexRelative}](${fixtureSrcIndexRelative}).`,
      "",
    ].join("\n"),
    fileUtf8,
  );
  writeAgentsCheckFixturePackage(root, "agents-check-clean-fixture");
  writeFileSync(
    join(root, fixtureSrcIndexRelative),
    "export function agentsCheckFixture(): boolean {\n  return true;\n}\n",
    fileUtf8,
  );
}

function writeBrokenAgentsCheckFixture(root: string): void {
  writeFileSync(
    join(root, fixtureAgentsMdRelative),
    [
      "# Broken fixture",
      "",
      "Missing file `missing/broken.ts` and script `npm run does-not-exist`.",
      "",
      "```sh",
      "node scripts/missing-runner.ts",
      "npm run does-not-exist",
      "```",
    ].join("\n"),
    fileUtf8,
  );
  writeAgentsCheckFixturePackage(root, "agents-check-broken-fixture");
}

function copyAgentsCheckScript(destinationRoot: string): void {
  const scriptsDir = join(destinationRoot, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  for (const fileName of ["agents-check.ts", "agents-check-patterns.mjs"]) {
    cpSync(join(repoRoot, "scripts", fileName), join(scriptsDir, fileName));
  }
}

describe("isPlaceholderToken", () => {
  it("skips globs, brackets, and parent-relative paths", async () => {
    const { isPlaceholderToken } = await loadModule();
    expect(isPlaceholderToken(".github/workflows/**")).toBe(true);
    expect(isPlaceholderToken(".agents/skills/<name>/SKILL.md")).toBe(true);
    expect(isPlaceholderToken("../docs/architecture.md")).toBe(true);
    expect(isPlaceholderToken(fixtureSrcIndexRelative)).toBe(false);
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
    expect(hasPathReference(refs, "docs/readme.md")).toBe(true);
    expect(hasPathReference(refs, "scripts/a.mjs")).toBe(true);
    expect(hasPathReference(refs, "scripts/run.ts")).toBe(true);
    expect(
      refs.some((entry) => entry.kind === npmScriptReferenceKind && entry.token === "build"),
    ).toBe(true);
  });

  it("accepts CRLF line endings", async () => {
    const { extractGuidanceReferences } = await loadModule();
    const text = `Link [x](${fixtureSrcIndexRelative})\r\n`;
    const refs = extractGuidanceReferences(text);
    expect(refs).toEqual([{ kind: "path", line: 1, token: fixtureSrcIndexRelative }]);
  });
});

describe("path resolution", () => {
  it("accepts repo-relative and guidance-file-relative targets", async () => {
    const { pathExistsInRepo, candidatePathResolutions } = await loadModule();
    expect(candidatePathResolutions("docs/agent-guard-hooks.md", `../${agentsCheckRelative}`)).toEqual([
      `../${agentsCheckRelative}`,
      agentsCheckRelative,
    ]);
    expect(
      pathExistsInRepo(repoRoot, ".github/pull_request_template.md", "../AGENTS.md"),
    ).toBe(true);
    expect(pathExistsInRepo(repoRoot, "AGENTS.md", agentsCheckRelative)).toBe(true);
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
      { kind: npmScriptReferenceKind, line: 1, token: "test:mcp" },
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
      writeCleanAgentsCheckFixture(tempDir);
      expect(collectGuidanceFindings(tempDir)).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports broken paths and unknown npm scripts in the broken fixture", async () => {
    const { collectGuidanceFindings } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-broken-"));
    try {
      writeBrokenAgentsCheckFixture(tempDir);
      const findings = collectGuidanceFindings(tempDir);
      expect(findings.some((entry) => entry.kind === "path" && entry.token.includes("missing"))).toBe(
        true,
      );
      expect(
        findings.some((entry) => entry.kind === npmScriptReferenceKind && entry.token === "does-not-exist"),
      )
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
      writeCleanAgentsCheckFixture(tempDir);
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
    expect(output).toMatch(/Agent guidance, skills, and npm scripts OK/);
  });

  it("fails with broken path and unknown npm script findings", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-cli-broken-"));
    try {
      writeBrokenAgentsCheckFixture(tempDir);
      copyAgentsCheckScript(tempDir);
      let failed = false;
      let combined = "";
      try {
        execFileSync(process.execPath, nodeArgs, { cwd: tempDir, encoding: "utf8" });
      } catch (error) {
        failed = true;
        combined = execFailureOutput(error);
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
      writeCleanAgentsCheckFixture(tempDir);
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

describe("discoverGuidanceFiles", () => {
  it("includes nested AGENTS.md and skips missing fixed files", async () => {
    const { discoverGuidanceFiles } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-discover-"));
    try {
      mkdirSync(join(tempDir, "packages", "nested"), { recursive: true });
      writeFileSync(join(tempDir, "packages/nested/AGENTS.md"), "# nested\n", "utf8");
      writeFileSync(join(tempDir, "package.json"), '{"scripts":{}}', "utf8");
      const files = discoverGuidanceFiles(tempDir);
      expect(files).toContain("packages/nested/AGENTS.md");
      expect(files).not.toContain("CONTRIBUTING.md");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("expandDotdirGuidanceGlob", () => {
  it("returns matches for skill globs and ignores invalid patterns", async () => {
    const { expandDotdirGuidanceGlob } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-glob-"));
    try {
      const skillPath = ".agents/skills/demo/SKILL.md";
      mkdirSync(join(tempDir, ".agents/skills/demo"), { recursive: true });
      writeFileSync(join(tempDir, skillPath), "# skill\n", "utf8");
      expect(expandDotdirGuidanceGlob(tempDir, ".agents/skills/**/SKILL.md")).toEqual([skillPath]);
      expect(expandDotdirGuidanceGlob(tempDir, "not-a-glob-pattern")).toEqual([]);
      expect(expandDotdirGuidanceGlob(tempDir, ".missing/**/SKILL.md")).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("formatFinding and CLI helpers", () => {
  it("formats npm script findings and direct execution detection", async () => {
    const { formatFinding, isDirectExecution } = await loadModule();
    expect(
      formatFinding({ file: "AGENTS.md", line: 2, kind: npmScriptReferenceKind, token: "lint" }),
    ).toBe(
      "AGENTS.md:2: unknown npm script: lint",
    );
    const modulePath = join(repoRoot, agentsCheckRelative);
    const moduleUrl = pathToFileURL(modulePath).href;
    expect(isDirectExecution(moduleUrl, modulePath)).toBe(true);
    expect(isDirectExecution(moduleUrl, undefined)).toBe(false);
  });

  it("prints non-agent-check errors from runAgentsCheckCliEntry", async () => {
    const { runAgentsCheckCliEntry } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-no-pkg-"));
    let stderr = "";
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr += String(chunk);
      return true;
    });
    try {
      copyAgentsCheckScript(tempDir);
      const moduleUrl = pathToFileURL(join(tempDir, agentsCheckRelative)).href;
      expect(runAgentsCheckCliEntry(moduleUrl)).toBe(1);
      expect(stderr).toMatch(/package\.json/);
    } finally {
      stderrSpy.mockRestore();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("reference validation edges", () => {
  it("skips external, anchor, and allowlisted tokens", async () => {
    const { extractGuidanceReferences, isAllowlistedPath } = await loadModule();
    const refs = extractGuidanceReferences(
      "Ignore [ext](https://example.com) [mail](mailto:a@b) [here](#x) `dist/out.js`",
    );
    expect(refs).toEqual([{ kind: "path", line: 1, token: "dist/out.js" }]);
    expect(isAllowlistedPath("dist/out.js")).toBe(true);
  });
});

describe("runAgentsCheckCliEntry", () => {
  it("returns 0 for clean trees and 1 when findings exist", async () => {
    const { runAgentsCheckCliEntry } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-entry-"));
    const modulePath = join(tempDir, agentsCheckRelative);
    try {
      writeCleanAgentsCheckFixture(tempDir);
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