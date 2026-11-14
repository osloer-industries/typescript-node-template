import { spawnSync } from "node:child_process";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  approvedLoginsFromReviews,
  computeGuardrailCheckResult,
  fetchApprovedReviewLogins,
  findGuardrailChanges,
  hasGuardrailApproval,
  HARNESS_CHANGE_LABEL,
  isGuardrailPath,
  listChangedPaths,
  parseCommaSeparatedList,
  resolveApprovedReviewLoginsFromEnv,
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
    expect(isGuardrailPath("vitest.config.ts")).toBe(true);
    expect(isGuardrailPath("tsconfig.json")).toBe(true);
    expect(isGuardrailPath("tsconfig.build.json")).toBe(true);
    expect(isGuardrailPath("packages/eslint-sonarjs/eslint.config.mjs")).toBe(true);
    expect(isGuardrailPath("scripts/check-guardrail-changes.ts")).toBe(true);
    expect(isGuardrailPath("scripts/gate-self.test.ts")).toBe(true);
    expect(isGuardrailPath("scripts/agent-hooks/block-guardrail-edits.ts")).toBe(true);
    expect(isGuardrailPath("scripts/count-suppressions.ts")).toBe(true);
    expect(isGuardrailPath("src/index.ts")).toBe(false);
    expect(isGuardrailPath("config/tsconfig.extra.json")).toBe(false);
  });
});

describe("hasGuardrailApproval", () => {
  it("accepts the harness-change label", () => {
    expect(hasGuardrailApproval({ labels: [HARNESS_CHANGE_LABEL], approvedByLogins: [] })).toBe(true);
  });

  it("accepts an approving CODEOWNER login", () => {
    expect(hasGuardrailApproval({ labels: [], approvedByLogins: ["tn819"] })).toBe(true);
  });

  it("rejects unrelated labels and logins", () => {
    expect(hasGuardrailApproval({ labels: ["dependencies"], approvedByLogins: ["dependabot[bot]"] })).toBe(
      false,
    );
  });
});

describe("approvedLoginsFromReviews", () => {
  it("uses the latest review state per user", () => {
    const logins = approvedLoginsFromReviews([
      { user: { login: "tn819" }, state: "APPROVED", submitted_at: "2026-01-01T00:00:00Z" },
      { user: { login: "tn819" }, state: "CHANGES_REQUESTED", submitted_at: "2026-01-02T00:00:00Z" },
      { user: { login: "other" }, state: "APPROVED", submitted_at: "2026-01-02T00:00:00Z" },
    ]);
    expect(logins).toEqual(["other"]);
  });
});

describe("computeGuardrailCheckResult", () => {
  it("fails when guardrail paths change without approval", () => {
    const result = computeGuardrailCheckResult(["AGENTS.md"], { labels: [], approvedByLogins: [] });
    expect(result.outcome).toBe("fail");
    expect(result.message).toMatch(/AGENTS\.md/);
  });

  it("passes when only non-guardrail paths change", () => {
    const result = computeGuardrailCheckResult(["src/index.ts"], { labels: [], approvedByLogins: [] });
    expect(result.outcome).toBe("pass");
  });
});

describe("parseCommaSeparatedList", () => {
  it("splits trimmed label names", () => {
    expect(parseCommaSeparatedList("dependencies, harness-change ,ci")).toEqual([
      "dependencies",
      "harness-change",
      "ci",
    ]);
  });
});

describe("findGuardrailChanges", () => {
  it("filters guardrail paths from a diff list", () => {
    const changed = ["src/index.ts", "AGENTS.md", "README.md", ".github/dependabot.yml"];
    expect(findGuardrailChanges(changed)).toEqual(["AGENTS.md", ".github/dependabot.yml"]);
  });
});

describe("listChangedPaths", () => {
  it("lists files changed between two refs in a git repository", { timeout: 30_000 }, () => {
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

describe("fetchApprovedReviewLogins", () => {
  it("throws when the GitHub API responds with an error", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 403, statusText: "Forbidden" }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(fetchApprovedReviewLogins("owner/repo", 1, "token")).rejects.toThrow(/403/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns approving logins from a valid review payload", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          { user: { login: "tn819" }, state: "APPROVED", submitted_at: "2026-01-01T00:00:00Z" },
          "not-a-review",
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(fetchApprovedReviewLogins("owner/repo", 42, "token")).resolves.toEqual(["tn819"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("throws when the payload is not an array", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ message: "nope" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(fetchApprovedReviewLogins("owner/repo", 1, "token")).rejects.toThrow(/array/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("resolveApprovedReviewLoginsFromEnv", () => {
  it("returns an override list when GUARDRAIL_APPROVED_BY is set", async () => {
    const previous = process.env.GUARDRAIL_APPROVED_BY;
    process.env.GUARDRAIL_APPROVED_BY = "tn819,other";
    try {
      await expect(resolveApprovedReviewLoginsFromEnv()).resolves.toEqual(["tn819", "other"]);
    } finally {
      if (previous === undefined) {
        delete process.env.GUARDRAIL_APPROVED_BY;
      } else {
        process.env.GUARDRAIL_APPROVED_BY = previous;
      }
    }
  });

  it("returns an empty list when GitHub env vars are missing", async () => {
    const keys = ["GUARDRAIL_APPROVED_BY", "GITHUB_REPOSITORY", "GUARDRAIL_PR_NUMBER", "GITHUB_TOKEN"] as const;
    const saved = new Map<string, string | undefined>();
    for (const key of keys) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
    try {
      await expect(resolveApprovedReviewLoginsFromEnv()).resolves.toEqual([]);
    } finally {
      for (const key of keys) {
        const value = saved.get(key);
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});

describe("runGuardrailCheckCli", () => {
  it("throws when the base ref is missing", async () => {
    await expect(runGuardrailCheckCli(import.meta.url, [])).rejects.toThrow(/Missing base ref/);
  });

  it("returns 0 when the diff has no guardrail paths", { timeout: 30_000 }, async () => {
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
      const exitCode = await runGuardrailCheckCli(moduleUrl, [base, head]);
      stdout.mockRestore();
      expect(exitCode).toBe(0);
      expect(output).toMatch(/No guardrail path changes detected/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns 0 when guardrail paths change with maintainer approval", { timeout: 30_000 }, async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "guardrail-approved-"));
    const previousApprovedBy = process.env.GUARDRAIL_APPROVED_BY;
    process.env.GUARDRAIL_APPROVED_BY = "tn819";
    try {
      const { base, head } = initTwoCommitRepo(tempDir);
      cpGuardrailScript(tempDir);
      const moduleUrl = new URL(`file://${join(tempDir, "scripts/check-guardrail-changes.ts")}`).href;
      const exitCode = await runGuardrailCheckCli(moduleUrl, [base, head]);
      expect(exitCode).toBe(0);
    } finally {
      if (previousApprovedBy === undefined) {
        delete process.env.GUARDRAIL_APPROVED_BY;
      } else {
        process.env.GUARDRAIL_APPROVED_BY = previousApprovedBy;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns 1 when guardrail paths change without approval", { timeout: 30_000 }, async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "guardrail-block-"));
    const previousApprovedBy = process.env.GUARDRAIL_APPROVED_BY;
    const previousLabels = process.env.GUARDRAIL_PR_LABELS;
    delete process.env.GUARDRAIL_APPROVED_BY;
    delete process.env.GUARDRAIL_PR_LABELS;
    try {
      const { base, head } = initTwoCommitRepo(tempDir);
      cpGuardrailScript(tempDir);
      const moduleUrl = new URL(`file://${join(tempDir, "scripts/check-guardrail-changes.ts")}`).href;
      let errorOutput = "";
      const stderr = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
        errorOutput += String(chunk);
        return true;
      });
      const exitCode = await runGuardrailCheckCli(moduleUrl, [base, head]);
      stderr.mockRestore();
      expect(exitCode).toBe(1);
      expect(errorOutput).toMatch(/Guardrail paths changed/);
      expect(errorOutput).toMatch(/harness-change/);
    } finally {
      if (previousApprovedBy === undefined) {
        delete process.env.GUARDRAIL_APPROVED_BY;
      } else {
        process.env.GUARDRAIL_APPROVED_BY = previousApprovedBy;
      }
      if (previousLabels === undefined) {
        delete process.env.GUARDRAIL_PR_LABELS;
      } else {
        process.env.GUARDRAIL_PR_LABELS = previousLabels;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("check-guardrail-changes CLI", () => {
  it("exits 1 for guardrail path changes without approval", { timeout: 30_000 }, () => {
    const tempDir = mkdtempSync(join(tmpdir(), "guardrail-cli-"));
    try {
      const { base, head } = initTwoCommitRepo(tempDir);
      cpGuardrailScript(tempDir);
      const result = spawnSync(process.execPath, ["scripts/check-guardrail-changes.ts"], {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          GUARDRAIL_BASE_REF: base,
          GUARDRAIL_HEAD_REF: head,
          GUARDRAIL_APPROVED_BY: "",
          GUARDRAIL_PR_LABELS: "",
        },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Guardrail paths changed/);
      expect(result.stderr).toMatch(/AGENTS\.md/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("exits 0 when the harness-change label is present", { timeout: 30_000 }, () => {
    const tempDir = mkdtempSync(join(tmpdir(), "guardrail-cli-label-"));
    try {
      const { base, head } = initTwoCommitRepo(tempDir);
      cpGuardrailScript(tempDir);
      const result = spawnSync(process.execPath, ["scripts/check-guardrail-changes.ts"], {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          GUARDRAIL_BASE_REF: base,
          GUARDRAIL_HEAD_REF: head,
          GUARDRAIL_PR_LABELS: HARNESS_CHANGE_LABEL,
        },
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/with maintainer approval/);
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
