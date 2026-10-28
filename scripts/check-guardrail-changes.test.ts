import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findGuardrailChanges,
  isGuardrailPath,
  listChangedPaths,
  runGuardrailCheckCli,
} from "./check-guardrail-changes.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const gitExecutable = process.env.GUARDRAIL_GIT_PATH ?? "/usr/bin/git";

describe("isGuardrailPath", () => {
  it("matches harness files and workflow directories", () => {
    expect(isGuardrailPath(".github/workflows/ci.yml")).toBe(true);
    expect(isGuardrailPath("AGENTS.md")).toBe(true);
    expect(isGuardrailPath("scripts/check-guardrail-changes.ts")).toBe(true);
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
  it("lists files changed between two refs in this repository", () => {
    const head = execFileSync(gitExecutable, ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    const base = execFileSync(gitExecutable, ["rev-parse", `${head}^`], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    const changed = listChangedPaths(base, head, repoRoot);
    expect(Array.isArray(changed)).toBe(true);
  });
});

describe("runGuardrailCheckCli", () => {
  it("throws when the base ref is missing", () => {
    expect(() => runGuardrailCheckCli(import.meta.url, [])).toThrow(/Missing base ref/);
  });
});

describe("check-guardrail-changes CLI", () => {
  it("runs with GUARDRAIL_BASE_REF from the environment", () => {
    const head = execFileSync(gitExecutable, ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    const base = execFileSync(gitExecutable, ["rev-parse", `${head}^`], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    const output = execFileSync(process.execPath, ["scripts/check-guardrail-changes.ts"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, GUARDRAIL_BASE_REF: base, GUARDRAIL_HEAD_REF: head },
    });
    expect(output.length).toBeGreaterThan(0);
  });
});
