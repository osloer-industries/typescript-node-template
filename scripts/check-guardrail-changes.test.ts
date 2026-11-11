import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  findGuardrailChanges,
  isGuardrailPath,
  listChangedPaths,
  runGuardrailCheckCli,
} from "./check-guardrail-changes.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const gitExecutable = process.env.GUARDRAIL_GIT_PATH ?? "/usr/bin/git";

function initGitRepo(tempDir: string): void {
  execFileSync(gitExecutable, ["init"], { cwd: tempDir, stdio: "pipe" });
  execFileSync(gitExecutable, ["config", "user.email", "test@example.com"], { cwd: tempDir, stdio: "pipe" });
  execFileSync(gitExecutable, ["config", "user.name", "test"], { cwd: tempDir, stdio: "pipe" });
}

function gitCommitPaths(tempDir: string, message: string, relativePaths: readonly string[]): string {
  for (const relativePath of relativePaths) {
    execFileSync(gitExecutable, ["add", relativePath], { cwd: tempDir, stdio: "pipe" });
  }
  execFileSync(gitExecutable, ["commit", "-m", message], { cwd: tempDir, stdio: "pipe" });
  return execFileSync(gitExecutable, ["rev-parse", "HEAD"], {
    cwd: tempDir,
    encoding: "utf8",
  }).trim();
}

function initTwoCommitRepo(tempDir: string): { base: string; head: string } {
  initGitRepo(tempDir);
  writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
  const base = gitCommitPaths(tempDir, "base", ["README.md"]);
  writeFileSync(join(tempDir, "AGENTS.md"), "# agents\n", "utf8");
  const head = gitCommitPaths(tempDir, "guardrail", ["AGENTS.md"]);
  return { base, head };
}

function initSrcOnlyDiffRepo(tempDir: string): { base: string; head: string } {
  initGitRepo(tempDir);
  writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
  const base = gitCommitPaths(tempDir, "base", ["README.md"]);
  mkdirSync(join(tempDir, "src"), { recursive: true });
  writeFileSync(join(tempDir, "src/index.ts"), "export {};\n", "utf8");
  const head = gitCommitPaths(tempDir, "src only", ["src/index.ts"]);
  return { base, head };
}

describe("isGuardrailPath", () => {
  it("matches harness files and workflow directories", () => {
    expect(isGuardrailPath(".github/workflows/ci.yml")).toBe(true);
    expect(isGuardrailPath("AGENTS.md")).toBe(true);
    expect(isGuardrailPath("CODEOWNERS")).toBe(true);
    expect(isGuardrailPath("lefthook.yml")).toBe(true);
    expect(isGuardrailPath("packages/eslint-sonarjs/eslint.config.mjs")).toBe(true);
    expect(isGuardrailPath("scripts/check-guardrail-changes.ts")).toBe(true);
    expect(isGuardrailPath("scripts/agent-hooks/block-guardrail-edits.ts")).toBe(true);
    expect(isGuardrailPath(".claude/settings.json")).toBe(true);
    expect(isGuardrailPath(".cursor/hooks.json")).toBe(true);
    expect(isGuardrailPath(".codex/hooks.json")).toBe(true);
    expect(isGuardrailPath("scripts/count-suppressions.ts")).toBe(true);
    expect(isGuardrailPath("src/index.ts")).toBe(false);
  });
});

describe("findGuardrailChanges", () => {
  it("filters guardrail paths from a diff list", () => {
    const changed = ["src/index.ts", "AGENTS.md", "README.md", ".github/dependabot.yml"];
    expect(findGuardrailChanges(changed)).toEqual(["AGENTS.md", ".github/dependabot.yml"]);
  });
});

describe("listChangedPaths", () => {
  it("lists files changed between two refs in a git repository", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "guardrail-git-"));
    try {
      const { base, head } = initTwoCommitRepo(tempDir);
      const changed = listChangedPaths(base, head, tempDir);
      expect(changed).toContain("AGENTS.md");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runGuardrailCheckCli", () => {
  it("throws when the base ref is missing", () => {
    expect(() => runGuardrailCheckCli(import.meta.url, [])).toThrow(/Missing base ref/);
  });

  it("prints a no-op message when the diff has no guardrail paths", { timeout: 30_000 }, () => {
    const tempDir = mkdtempSync(join(tmpdir(), "guardrail-no-harness-"));
    try {
      const { base, head } = initSrcOnlyDiffRepo(tempDir);
      cpGuardrailScript(tempDir);
      const moduleUrl = new URL(`file://${join(tempDir, "scripts/check-guardrail-changes.ts")}`).href;
      let output = "";
      const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        output += String(chunk);
        return true;
      });
      runGuardrailCheckCli(moduleUrl, [base, head]);
      stdout.mockRestore();
      expect(output).toMatch(/No guardrail path changes detected/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("check-guardrail-changes CLI", () => {
  it("reports guardrail path changes via GUARDRAIL_BASE_REF", { timeout: 30_000 }, () => {
    const tempDir = mkdtempSync(join(tmpdir(), "guardrail-cli-"));
    try {
      const { base, head } = initTwoCommitRepo(tempDir);
      cpGuardrailScript(tempDir);
      const output = execFileSync(process.execPath, ["scripts/check-guardrail-changes.ts"], {
        cwd: tempDir,
        encoding: "utf8",
        env: { ...process.env, GUARDRAIL_BASE_REF: base, GUARDRAIL_HEAD_REF: head },
      });
      expect(output).toMatch(/Guardrail paths changed/);
      expect(output).toMatch(/AGENTS\.md/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function cpGuardrailScript(tempDir: string): void {
  const scriptsDir = join(tempDir, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  cpSync(join(repoRoot, "scripts/check-guardrail-changes.ts"), join(scriptsDir, "check-guardrail-changes.ts"));
}
