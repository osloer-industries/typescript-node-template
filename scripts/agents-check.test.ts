import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const AGENTS_CHECK_SCRIPT = "scripts/agents-check.ts";
const AGENTS_CHECK_OK_MESSAGE = /Agent guidance, skills, and npm scripts OK/;
const NPM_SCRIPT_KIND = "npm-script";
const PACKAGE_JSON_RELATIVE = "package.json";
const MINIMAL_PACKAGE_JSON = '{"scripts":{}}\n';
const nodeArgs = [AGENTS_CHECK_SCRIPT];

const CLEAN_FIXTURE_AGENTS = [
  "# Clean fixture",
  "",
  "Run `npm run lint` and edit `src/index.ts`.",
  "",
  "See [src/index.ts](src/index.ts).",
].join("\n");

const BROKEN_FIXTURE_AGENTS = [
  "# Broken fixture",
  "",
  "Missing file `missing/broken.ts` and script `npm run does-not-exist`.",
  "",
  "```sh",
  "node scripts/missing-runner.ts",
  "npm run does-not-exist",
  "```",
].join("\n");

const FIXTURE_PACKAGE_JSON = {
  clean: {
    name: "agents-check-clean-fixture",
    type: "module",
    private: true,
    scripts: { lint: "echo lint" },
  },
  broken: {
    name: "agents-check-broken-fixture",
    type: "module",
    private: true,
    scripts: { lint: "echo lint" },
  },
} as const;

const CLEAN_FIXTURE_SRC = [
  "export function agentsCheckFixture(): boolean {",
  "  return true;",
  "}",
  "",
].join("\n");

function readExecFailureOutput(error: unknown): string {
  if (error === null || typeof error !== "object") {
    return "";
  }
  let combined = "";
  const stdout = Reflect.get(error, "stdout");
  const stderr = Reflect.get(error, "stderr");
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

function writeAgentsCheckFixture(destination: string, variant: keyof typeof FIXTURE_PACKAGE_JSON): void {
  const agentsMd = variant === "clean" ? CLEAN_FIXTURE_AGENTS : BROKEN_FIXTURE_AGENTS;
  writeFileSync(join(destination, "AGENTS.md"), `${agentsMd}\n`, "utf8");
  writeFileSync(
    join(destination, PACKAGE_JSON_RELATIVE),
    `${JSON.stringify(FIXTURE_PACKAGE_JSON[variant], null, 2)}\n`,
    "utf8",
  );
  if (variant === "clean") {
    mkdirSync(join(destination, "src"), { recursive: true });
    writeFileSync(join(destination, "src", "index.ts"), CLEAN_FIXTURE_SRC, "utf8");
  }
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
    expect(refs.some((entry) => entry.kind === NPM_SCRIPT_KIND && entry.token === "build")).toBe(true);
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
    expect(candidatePathResolutions("docs/agent-guard-hooks.md", `../${AGENTS_CHECK_SCRIPT}`)).toEqual([
      `../${AGENTS_CHECK_SCRIPT}`,
      AGENTS_CHECK_SCRIPT,
    ]);
    expect(
      pathExistsInRepo(repoRoot, ".github/pull_request_template.md", "../AGENTS.md"),
    ).toBe(true);
    expect(pathExistsInRepo(repoRoot, "AGENTS.md", AGENTS_CHECK_SCRIPT)).toBe(true);
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
      { kind: NPM_SCRIPT_KIND, line: 1, token: "test:mcp" },
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
      writeAgentsCheckFixture(tempDir, "clean");
      expect(collectGuidanceFindings(tempDir)).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports broken paths and unknown npm scripts in the broken fixture", async () => {
    const { collectGuidanceFindings } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-broken-"));
    try {
      writeAgentsCheckFixture(tempDir, "broken");
      const findings = collectGuidanceFindings(tempDir);
      expect(findings.some((entry) => entry.kind === "path" && entry.token.includes("missing"))).toBe(
        true,
      );
      expect(findings.some((entry) => entry.kind === NPM_SCRIPT_KIND && entry.token === "does-not-exist"))
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
      writeAgentsCheckFixture(tempDir, "clean");
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
    expect(output).toMatch(AGENTS_CHECK_OK_MESSAGE);
  });

  it("fails with broken path and unknown npm script findings", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-cli-broken-"));
    try {
      writeAgentsCheckFixture(tempDir, "broken");
      copyAgentsCheckScript(tempDir);
      let failed = false;
      let combined = "";
      try {
        execFileSync(process.execPath, nodeArgs, { cwd: tempDir, encoding: "utf8" });
      } catch (error) {
        failed = true;
        combined = readExecFailureOutput(error);
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
      writeAgentsCheckFixture(tempDir, "clean");
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
      writeFileSync(join(tempDir, PACKAGE_JSON_RELATIVE), MINIMAL_PACKAGE_JSON, "utf8");
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
    expect(formatFinding({ file: "AGENTS.md", line: 2, kind: NPM_SCRIPT_KIND, token: "lint" })).toBe(
      "AGENTS.md:2: unknown npm script: lint",
    );
    const modulePath = join(repoRoot, AGENTS_CHECK_SCRIPT);
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
      const moduleUrl = pathToFileURL(join(tempDir, AGENTS_CHECK_SCRIPT)).href;
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

describe("runAgentsCheckCli", () => {
  it("writes success output when guidance and skills are clean", async () => {
    const { runAgentsCheckCli } = await loadModule();
    const moduleUrl = pathToFileURL(join(repoRoot, AGENTS_CHECK_SCRIPT)).href;
    let stdout = "";
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });
    try {
      runAgentsCheckCli(moduleUrl);
      expect(stdout).toMatch(AGENTS_CHECK_OK_MESSAGE);
    } finally {
      stdoutSpy.mockRestore();
    }
  });

  it("throws after emitting guidance and skill findings", async () => {
    const { runAgentsCheckCli } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-run-cli-"));
    try {
      writeAgentsCheckFixture(tempDir, "broken");
      copyAgentsCheckScript(tempDir);
      const skillDir = join(tempDir, ".agents/skills/wrong-name");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        "---\nname: not-dir\ndescription: mismatch\n---\n",
        "utf8",
      );
      const moduleUrl = pathToFileURL(join(tempDir, AGENTS_CHECK_SCRIPT)).href;
      let stderr = "";
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
        stderr += String(chunk);
        return true;
      });
      expect(() => runAgentsCheckCli(moduleUrl)).toThrow(/agents:check failed/);
      stderrSpy.mockRestore();
      expect(stderr).toMatch(/broken path/);
      expect(stderr).toMatch(/must match directory/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runAgentsIndexCli", () => {
  it("writes Updated when the skills index was stale", async () => {
    const { runAgentsIndexCli } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-index-run-cli-"));
    try {
      cpSync(join(repoRoot, ".agents"), join(tempDir, ".agents"), { recursive: true });
      writeFileSync(
        join(tempDir, "AGENTS.md"),
        ["# A", "<!-- agents:skills:begin -->", "| stale |", "<!-- agents:skills:end -->"].join("\n"),
        "utf8",
      );
      writeFileSync(join(tempDir, PACKAGE_JSON_RELATIVE), MINIMAL_PACKAGE_JSON, "utf8");
      copyAgentsCheckScript(tempDir);
      const moduleUrl = pathToFileURL(join(tempDir, AGENTS_CHECK_SCRIPT)).href;
      let stdout = "";
      const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        stdout += String(chunk);
        return true;
      });
      expect(runAgentsIndexCli(moduleUrl)).toBe(0);
      stdoutSpy.mockRestore();
      expect(stdout).toMatch(/Updated skills index/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runAgentsCheckCliEntry", () => {
  it("returns 0 for clean trees and 1 when findings exist", async () => {
    const { runAgentsCheckCliEntry } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "agents-check-entry-"));
    const modulePath = join(tempDir, AGENTS_CHECK_SCRIPT);
    try {
      writeAgentsCheckFixture(tempDir, "clean");
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
      expect(stderr).not.toMatch(/agents:check failed with/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});