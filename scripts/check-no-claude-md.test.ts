import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const gitExecutable = process.env.NO_CLAUDE_GIT_PATH ?? "git";
const nodeArgs = ["scripts/check-no-claude-md.ts"];

async function loadModule() {
  return import("./check-no-claude-md.js");
}

function initGitRepo(directory: string): void {
  execFileSync(gitExecutable, ["init"], { cwd: directory, stdio: "pipe" });
  execFileSync(gitExecutable, ["config", "user.email", "agent@example.com"], {
    cwd: directory,
    stdio: "pipe",
  });
  execFileSync(gitExecutable, ["config", "user.name", "Agent"], { cwd: directory, stdio: "pipe" });
}

function createNoClaudeFixture(prefix: string): string {
  const tempDir = mkdtempSync(join(tmpdir(), prefix));
  mkdirScriptsAndCopyCheck(tempDir);
  initGitRepo(tempDir);
  execFileSync(gitExecutable, ["add", "."], { cwd: tempDir, stdio: "pipe" });
  execFileSync(gitExecutable, ["commit", "-m", "init"], { cwd: tempDir, stdio: "pipe" });
  return tempDir;
}

function mkdirScriptsAndCopyCheck(tempDir: string): void {
  mkdirSync(join(tempDir, "scripts"), { recursive: true });
  cpSync(
    join(repoRoot, "scripts/check-no-claude-md.ts"),
    join(tempDir, "scripts/check-no-claude-md.ts"),
  );
}

describe("findForbiddenTrackedInstructionFiles", () => {
  it("detects root CLAUDE.md and .claude/CLAUDE.md", async () => {
    const { findForbiddenTrackedInstructionFiles } = await loadModule();
    expect(findForbiddenTrackedInstructionFiles(["README.md"])).toEqual([]);
    expect(findForbiddenTrackedInstructionFiles(["CLAUDE.md", "AGENTS.md"])).toEqual(["CLAUDE.md"]);
    expect(findForbiddenTrackedInstructionFiles([".claude/CLAUDE.md"])).toEqual([".claude/CLAUDE.md"]);
    expect(findForbiddenTrackedInstructionFiles(["", "  CLAUDE.md  "])).toEqual(["CLAUDE.md"]);
    expect(
      findForbiddenTrackedInstructionFiles(["CLAUDE.md", ".claude/CLAUDE.md", "AGENTS.md"]),
    ).toEqual(["CLAUDE.md", ".claude/CLAUDE.md"]);
  });
});

describe("listGitTrackedPaths", () => {
  it("returns committed paths from git ls-files", async () => {
    const { listGitTrackedPaths } = await loadModule();
    const tempDir = createNoClaudeFixture("no-claude-list-");
    try {
      writeFileSync(join(tempDir, "notes.txt"), "draft\n", "utf8");
      expect(listGitTrackedPaths(tempDir)).not.toContain("notes.txt");
      execFileSync(gitExecutable, ["add", "notes.txt"], { cwd: tempDir, stdio: "pipe" });
      execFileSync(gitExecutable, ["commit", "-m", "notes"], { cwd: tempDir, stdio: "pipe" });
      expect(listGitTrackedPaths(tempDir)).toContain("notes.txt");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("findForbiddenInstructionFilesOnDisk", () => {
  it("detects forbidden paths present on disk", async () => {
    const { findForbiddenInstructionFilesOnDisk } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "no-claude-disk-"));
    try {
      expect(findForbiddenInstructionFilesOnDisk(tempDir)).toEqual([]);
      mkdirSync(join(tempDir, ".claude"), { recursive: true });
      writeFileSync(join(tempDir, ".claude/CLAUDE.md"), "import\n", "utf8");
      expect(findForbiddenInstructionFilesOnDisk(tempDir)).toEqual([".claude/CLAUDE.md"]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("resolveClaudeInstructionViolations", () => {
  it("falls back to on-disk paths when the tree is not a git repository", async () => {
    const { resolveClaudeInstructionViolations } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "no-claude-nogit-"));
    try {
      mkdirScriptsAndCopyCheck(tempDir);
      expect(resolveClaudeInstructionViolations(tempDir)).toEqual([]);
      writeFileSync(join(tempDir, "CLAUDE.md"), "@AGENTS.md\n", "utf8");
      expect(resolveClaudeInstructionViolations(tempDir)).toEqual(["CLAUDE.md"]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rethrows when git fails for a reason other than a missing repository", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "no-claude-git-fail-"));
    const fakeGit = join(tempDir, "fake-git.sh");
    const previousGit = process.env.NO_CLAUDE_GIT_PATH;
    try {
      writeFileSync(fakeGit, "#!/bin/sh\necho 'permission denied' >&2\nexit 1\n", "utf8");
      chmodSync(fakeGit, 0o755);
      process.env.NO_CLAUDE_GIT_PATH = fakeGit;
      const { resolveClaudeInstructionViolations } = await loadModule();
      expect(() => resolveClaudeInstructionViolations(tempDir)).toThrow(/permission denied/);
    } finally {
      if (previousGit === undefined) delete process.env.NO_CLAUDE_GIT_PATH;
      else process.env.NO_CLAUDE_GIT_PATH = previousGit;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("uses git ls-files when the directory is a repository", async () => {
    const { resolveClaudeInstructionViolations } = await loadModule();
    const tempDir = createNoClaudeFixture("no-claude-gitls-");
    try {
      writeFileSync(join(tempDir, "CLAUDE.md"), "@AGENTS.md\n", "utf8");
      expect(resolveClaudeInstructionViolations(tempDir)).toEqual([]);
      execFileSync(gitExecutable, ["add", "CLAUDE.md"], { cwd: tempDir, stdio: "pipe" });
      execFileSync(gitExecutable, ["commit", "-m", "track"], { cwd: tempDir, stdio: "pipe" });
      expect(resolveClaudeInstructionViolations(tempDir)).toEqual(["CLAUDE.md"]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runNoClaudeMdCheckCli", () => {
  it("writes success output for a clean tree", async () => {
    const { runNoClaudeMdCheckCli } = await loadModule();
    const tempDir = createNoClaudeFixture("no-claude-run-cli-");
    const moduleUrl = new URL(`file://${join(tempDir, "scripts/check-no-claude-md.ts")}`).href;
    let output = "";
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });
    try {
      runNoClaudeMdCheckCli(moduleUrl);
      expect(output).toMatch(/ADR 0002 OK/);
    } finally {
      stdout.mockRestore();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("isDirectExecution", () => {
  it("matches only the module argv entry", async () => {
    const { isDirectExecution } = await loadModule();
    const modulePath = join(repoRoot, "scripts/check-no-claude-md.ts");
    const moduleUrl = pathToFileURL(modulePath).href;
    expect(isDirectExecution(moduleUrl, modulePath)).toBe(true);
    expect(isDirectExecution(moduleUrl, undefined)).toBe(false);
    expect(isDirectExecution(moduleUrl, join(repoRoot, "scripts/other.ts"))).toBe(false);
  });
});

describe("runNoClaudeMdCliEntry", () => {
  it("returns 0 for a clean repository and 1 when CLAUDE.md is tracked", async () => {
    const { runNoClaudeMdCliEntry } = await loadModule();
    const cleanDir = createNoClaudeFixture("no-claude-entry-clean-");
    const moduleUrl = new URL(`file://${join(cleanDir, "scripts/check-no-claude-md.ts")}`).href;
    let stderr = "";
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr += String(chunk);
      return true;
    });
    try {
      expect(runNoClaudeMdCliEntry(moduleUrl)).toBe(0);
      writeFileSync(join(cleanDir, "CLAUDE.md"), "@AGENTS.md\n", "utf8");
      execFileSync(gitExecutable, ["add", "CLAUDE.md"], { cwd: cleanDir, stdio: "pipe" });
      execFileSync(gitExecutable, ["commit", "-m", "claude"], { cwd: cleanDir, stdio: "pipe" });
      stderr = "";
      expect(runNoClaudeMdCliEntry(moduleUrl)).toBe(1);
      expect(stderr).toMatch(/CLAUDE\.md/);
    } finally {
      stderrSpy.mockRestore();
      rmSync(cleanDir, { recursive: true, force: true });
    }
  });

});

describe("assertNoTrackedClaudeInstructionFiles", () => {
  it("passes when no forbidden paths are tracked", async () => {
    const { assertNoTrackedClaudeInstructionFiles } = await loadModule();
    const tempDir = createNoClaudeFixture("no-claude-clean-");
    try {
      expect(() => assertNoTrackedClaudeInstructionFiles(tempDir)).not.toThrow();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects tracked CLAUDE.md", async () => {
    const { assertNoTrackedClaudeInstructionFiles } = await loadModule();
    const tempDir = createNoClaudeFixture("no-claude-violation-");
    try {
      writeFileSync(join(tempDir, "CLAUDE.md"), "@AGENTS.md\n", "utf8");
      execFileSync(gitExecutable, ["add", "CLAUDE.md"], { cwd: tempDir, stdio: "pipe" });
      execFileSync(gitExecutable, ["commit", "-m", "add claude"], { cwd: tempDir, stdio: "pipe" });
      expect(() => assertNoTrackedClaudeInstructionFiles(tempDir)).toThrow(/CLAUDE\.md/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("no-claude-md gate canary", () => {
  it("treats a clean tree as a failed canary when expecting violations", async () => {
    const { findForbiddenTrackedInstructionFiles } = await loadModule();
    const tracked = ["AGENTS.md", "README.md"];
    const violations = findForbiddenTrackedInstructionFiles(tracked);
    expect(violations).toEqual([]);
    let harnessError = "";
    try {
      expect(violations, "canary harness must fail when no CLAUDE.md paths are tracked").not.toEqual([]);
    } catch (error) {
      harnessError = String(error);
    }
    expect(harnessError).toContain("canary harness must fail");
  });
});

describe("check-no-claude-md CLI", () => {
  it("passes on the template repository", () => {
    const output = execFileSync(process.execPath, nodeArgs, {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(output).toMatch(/ADR 0002 OK/);
  });

  it("fails with exit code 1 when CLAUDE.md is tracked", () => {
    const tempDir = createNoClaudeFixture("no-claude-cli-");
    try {
      writeFileSync(join(tempDir, "CLAUDE.md"), "@AGENTS.md\n", "utf8");
      execFileSync(gitExecutable, ["add", "CLAUDE.md"], { cwd: tempDir, stdio: "pipe" });
      execFileSync(gitExecutable, ["commit", "-m", "track claude"], { cwd: tempDir, stdio: "pipe" });
      let failed = false;
      let stderr = "";
      try {
        execFileSync(process.execPath, ["scripts/check-no-claude-md.ts"], {
          cwd: tempDir,
          encoding: "utf8",
        });
      } catch (error) {
        failed = true;
        if (error !== null && typeof error === "object" && "stderr" in error) {
          const captured = Reflect.get(error, "stderr");
          if (typeof captured === "string") stderr = captured;
        }
      }
      expect(failed, "expected non-zero exit when CLAUDE.md is tracked").toBe(true);
      expect(stderr).toMatch(/0002-agents-md-single-instruction-file/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
