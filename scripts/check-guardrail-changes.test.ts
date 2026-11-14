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
const gitPipe = { stdio: "pipe" } as const;
const commitMessageBase = "base";
const srcIndexPath = "src/index.ts";
const agentsMdPath = "AGENTS.md";
const guardrailCheckRelativePath = "scripts/check-guardrail-changes.ts";

function initGitRepo(tempDir: string): void {
  execFileSync(gitExecutable, ["init"], { cwd: tempDir, ...gitPipe });
  execFileSync(gitExecutable, ["config", "user.email", "test@example.com"], { cwd: tempDir, ...gitPipe });
  execFileSync(gitExecutable, ["config", "user.name", "test"], { cwd: tempDir, ...gitPipe });
}

function gitCommitPaths(tempDir: string, message: string, relativePaths: readonly string[]): string {
  for (const relativePath of relativePaths) {
    execFileSync(gitExecutable, ["add", relativePath], { cwd: tempDir, ...gitPipe });
  }
  execFileSync(gitExecutable, ["commit", "-m", message], { cwd: tempDir, ...gitPipe });
  return execFileSync(gitExecutable, ["rev-parse", "HEAD"], {
    cwd: tempDir,
    encoding: "utf8",
  }).trim();
}

function initTwoCommitRepo(tempDir: string): { base: string; head: string } {
  initGitRepo(tempDir);
  writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
  const base = gitCommitPaths(tempDir, commitMessageBase, ["README.md"]);
  writeFileSync(join(tempDir, agentsMdPath), "# agents\n", "utf8");
  const head = gitCommitPaths(tempDir, "guardrail", [agentsMdPath]);
  return { base, head };
}

function initSrcOnlyDiffRepo(tempDir: string): { base: string; head: string } {
  initGitRepo(tempDir);
  writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
  const base = gitCommitPaths(tempDir, commitMessageBase, ["README.md"]);
  mkdirSync(join(tempDir, "src"), { recursive: true });
  writeFileSync(join(tempDir, srcIndexPath), "export {};\n", "utf8");
  const head = gitCommitPaths(tempDir, "src only", [srcIndexPath]);
  return { base, head };
}

describe("isGuardrailPath", () => {
  it("matches harness files and workflow directories", () => {
    const guardrailPaths = [
      ".github/workflows/ci.yml",
      agentsMdPath,
      "CODEOWNERS",
      "lefthook.yml",
      "packages/eslint-sonarjs/eslint.config.mjs",
      guardrailCheckRelativePath,
      "scripts/agent-hooks/block-guardrail-edits.ts",
      "scripts/count-suppressions.ts",
    ] as const;
    for (const path of guardrailPaths) {
      expect(isGuardrailPath(path)).toBe(true);
    }
    expect(isGuardrailPath(srcIndexPath)).toBe(false);
  });
});

describe("findGuardrailChanges", () => {
  it("filters guardrail paths from a diff list", () => {
    const changed = [srcIndexPath, agentsMdPath, "README.md", ".github/dependabot.yml"];
    expect(findGuardrailChanges(changed)).toEqual([agentsMdPath, ".github/dependabot.yml"]);
  });
});

describe("listChangedPaths", () => {
  it("lists files changed between two refs in a git repository", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "guardrail-git-"));
    try {
      const { base, head } = initTwoCommitRepo(tempDir);
      const changed = listChangedPaths(base, head, tempDir);
      expect(changed).toContain(agentsMdPath);
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
      const moduleUrl = new URL(`file://${join(tempDir, guardrailCheckRelativePath)}`).href;
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
      const output = execFileSync(process.execPath, [guardrailCheckRelativePath], {
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
  cpSync(join(repoRoot, guardrailCheckRelativePath), join(scriptsDir, "check-guardrail-changes.ts"));
}
