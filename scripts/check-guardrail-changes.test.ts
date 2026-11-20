import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  computeGuardrailChanged,
  findGuardrailChanges,
  formatGuardrailDetectMessage,
  GITHUB_OUTPUT_GUARDRAIL_CHANGED,
  isGuardrailPath,
  listChangedPaths,
  runGuardrailDetectCli,
  writeGithubStepOutput,
} from "./check-guardrail-changes.js";
import {
  gitCommitPaths,
  gitExecutableForTests,
  initGitRepo,
} from "./test-git-fixture.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const gitExecutable = gitExecutableForTests("GUARDRAIL_GIT_PATH");
const srcIndexPath = "src/index.ts";
const agentsMdPath = "AGENTS.md";
const guardrailCheckRelativePath = "scripts/check-guardrail-changes.ts";
const githubOutputFixtureFile = "github-output.txt";

function initTwoCommitRepo(tempDir: string): { base: string; head: string } {
  initGitRepo(tempDir, gitExecutable);
  writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
  const base = gitCommitPaths(tempDir, "base", ["README.md"], gitExecutable);
  writeFileSync(join(tempDir, agentsMdPath), "# agents\n", "utf8");
  const head = gitCommitPaths(tempDir, "guardrail", [agentsMdPath], gitExecutable);
  return { base, head };
}

function initSrcOnlyDiffRepo(tempDir: string): { base: string; head: string } {
  initGitRepo(tempDir, gitExecutable);
  writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
  const base = gitCommitPaths(tempDir, "base", ["README.md"], gitExecutable);
  mkdirSync(join(tempDir, "src"), { recursive: true });
  writeFileSync(join(tempDir, srcIndexPath), "export {};\n", "utf8");
  const head = gitCommitPaths(tempDir, "src only", [srcIndexPath], gitExecutable);
  return { base, head };
}

function cpGuardrailScript(tempDir: string): void {
  const scriptsDir = join(tempDir, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  for (const fileName of ["check-guardrail-changes.ts", "git-list-changed-paths.mjs"]) {
    cpSync(join(repoRoot, "scripts", fileName), join(scriptsDir, fileName));
  }
}

describe("isGuardrailPath", () => {
  it("matches harness files and workflow directories", () => {
    expect(isGuardrailPath(".github/workflows/ci.yml")).toBe(true);
    expect(isGuardrailPath("AGENTS.md")).toBe(true);
    expect(isGuardrailPath(".gitignore")).toBe(true);
    expect(isGuardrailPath("CODEOWNERS")).toBe(true);
    expect(isGuardrailPath("lefthook.yml")).toBe(true);
    expect(isGuardrailPath("vitest.config.ts")).toBe(true);
    expect(isGuardrailPath("tsconfig.json")).toBe(true);
    expect(isGuardrailPath("tsconfig.build.json")).toBe(true);
    expect(isGuardrailPath("packages/eslint-sonarjs/eslint.config.mjs")).toBe(true);
    expect(isGuardrailPath("scripts/check-guardrail-changes.ts")).toBe(true);
    expect(isGuardrailPath("scripts/agents-check.ts")).toBe(true);
    expect(isGuardrailPath("scripts/check-fleet-adoption-doc.ts")).toBe(true);
    expect(isGuardrailPath("docs/fleet-adoption.md")).toBe(true);
    expect(isGuardrailPath("scripts/gate-self.test.ts")).toBe(true);
    expect(isGuardrailPath("scripts/agent-hooks/block-guardrail-edits.ts")).toBe(true);
    expect(isGuardrailPath("scripts/count-suppressions.ts")).toBe(true);
    expect(isGuardrailPath(".agents/skills/release/SKILL.md")).toBe(true);
    expect(isGuardrailPath(".agents/skills/release/extra.txt")).toBe(true);
    expect(isGuardrailPath(srcIndexPath)).toBe(false);
    expect(isGuardrailPath("config/tsconfig.extra.json")).toBe(false);
  });
});

describe("computeGuardrailChanged", () => {
  it("is true when guardrail paths change", () => {
    expect(computeGuardrailChanged(["AGENTS.md", srcIndexPath])).toBe(true);
  });

  it("is false when only non-guardrail paths change", () => {
    expect(computeGuardrailChanged([srcIndexPath, "README.md"])).toBe(false);
  });
});

describe("formatGuardrailDetectMessage", () => {
  it("mentions harness-approval when guardrail paths change", () => {
    const message = formatGuardrailDetectMessage(["AGENTS.md"]);
    expect(message).toMatch(/AGENTS\.md/);
    expect(message).toMatch(/harness-approval/);
  });

  it("reports no changes for non-guardrail diffs", () => {
    expect(formatGuardrailDetectMessage([srcIndexPath])).toMatch(/No guardrail path changes/);
  });
});

describe("findGuardrailChanges", () => {
  it("filters guardrail paths from a diff list", () => {
    const changed = [srcIndexPath, agentsMdPath, "README.md", ".github/dependabot.yml"];
    expect(findGuardrailChanges(changed)).toEqual([agentsMdPath, ".github/dependabot.yml"]);
  });
});

describe("listChangedPaths", () => {
  it("lists files changed between two refs in a git repository", { timeout: 30_000 }, () => {
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

describe("writeGithubStepOutput", () => {
  it("appends name=value when GITHUB_OUTPUT is set", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "guardrail-output-"));
    const outputFile = join(tempDir, githubOutputFixtureFile);
    const previous = process.env.GITHUB_OUTPUT;
    process.env.GITHUB_OUTPUT = outputFile;
    try {
      writeGithubStepOutput(GITHUB_OUTPUT_GUARDRAIL_CHANGED, "true");
      const text = readFileSync(outputFile, "utf8");
      expect(text).toBe("guardrail_changed=true\n");
    } finally {
      if (previous === undefined) {
        delete process.env.GITHUB_OUTPUT;
      } else {
        process.env.GITHUB_OUTPUT = previous;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("is a no-op when GITHUB_OUTPUT is unset", () => {
    const previous = process.env.GITHUB_OUTPUT;
    delete process.env.GITHUB_OUTPUT;
    try {
      expect(() => writeGithubStepOutput("guardrail_changed", "false")).not.toThrow();
    } finally {
      if (previous === undefined) {
        delete process.env.GITHUB_OUTPUT;
      } else {
        process.env.GITHUB_OUTPUT = previous;
      }
    }
  });
});

describe("runGuardrailDetectCli", () => {
  it("throws when the base ref is missing", () => {
    expect(() => runGuardrailDetectCli(import.meta.url, [])).toThrow(/Missing base ref/);
  });

  it("returns 0 and writes guardrail_changed=false for non-guardrail diffs", { timeout: 30_000 }, () => {
    const tempDir = mkdtempSync(join(tmpdir(), "guardrail-detect-ok-"));
    const outputFile = join(tempDir, githubOutputFixtureFile);
    writeFileSync(outputFile, "", "utf8");
    const previousOutput = process.env.GITHUB_OUTPUT;
    process.env.GITHUB_OUTPUT = outputFile;
    try {
      const { base, head } = initSrcOnlyDiffRepo(tempDir);
      cpGuardrailScript(tempDir);
      const moduleUrl = new URL(`file://${join(tempDir, guardrailCheckRelativePath)}`).href;
      let text = "";
      const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        text += String(chunk);
        return true;
      });
      const exitCode = runGuardrailDetectCli(moduleUrl, [base, head]);
      stdout.mockRestore();
      expect(exitCode).toBe(0);
      expect(text).toMatch(/No guardrail path changes detected/);
      expect(readFileSync(outputFile, "utf8")).toBe("guardrail_changed=false\n");
    } finally {
      if (previousOutput === undefined) {
        delete process.env.GITHUB_OUTPUT;
      } else {
        process.env.GITHUB_OUTPUT = previousOutput;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns 0 and writes guardrail_changed=true for harness diffs without failing", { timeout: 30_000 }, () => {
    const tempDir = mkdtempSync(join(tmpdir(), "guardrail-detect-harness-"));
    const outputFile = join(tempDir, githubOutputFixtureFile);
    appendFileSync(outputFile, "", "utf8");
    const previousOutput = process.env.GITHUB_OUTPUT;
    process.env.GITHUB_OUTPUT = outputFile;
    try {
      const { base, head } = initTwoCommitRepo(tempDir);
      cpGuardrailScript(tempDir);
      const moduleUrl = new URL(`file://${join(tempDir, guardrailCheckRelativePath)}`).href;
      const exitCode = runGuardrailDetectCli(moduleUrl, [base, head]);
      expect(exitCode).toBe(0);
      expect(readFileSync(outputFile, "utf8")).toBe("guardrail_changed=true\n");
    } finally {
      if (previousOutput === undefined) {
        delete process.env.GITHUB_OUTPUT;
      } else {
        process.env.GITHUB_OUTPUT = previousOutput;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("check-guardrail-changes CLI", () => {
  it("exits 1 when the base ref env is missing", () => {
    const result = spawnSync(process.execPath, [guardrailCheckRelativePath], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, GUARDRAIL_BASE_REF: "" },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/Missing base ref/);
  });

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