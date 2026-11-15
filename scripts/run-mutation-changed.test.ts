import { chmodSync } from "node:fs";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  findMutableSrcChanges,
  isMutableSrcFile,
  runMutationChangedCli,
} from "./run-mutation-changed.js";
import {
  gitCommitPaths,
  gitExecutableForTests,
  initGitRepo,
} from "./test-git-fixture.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const gitExecutable = gitExecutableForTests("MUTATION_GIT_PATH");

function copyMutationScripts(tempDir: string): string {
  const scriptsDir = join(tempDir, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  for (const fileName of ["run-mutation-changed.ts", "git-list-changed-paths.mjs"]) {
    cpSync(join(repoRoot, "scripts", fileName), join(scriptsDir, fileName));
  }
  return new URL(`file://${join(scriptsDir, "run-mutation-changed.ts")}`).href;
}

describe("isMutableSrcFile", () => {
  it("accepts production src files", () => {
    expect(isMutableSrcFile("src/index.ts")).toBe(true);
    expect(isMutableSrcFile("src/lib/foo.ts")).toBe(true);
  });

  it("rejects tests and non-src paths", () => {
    expect(isMutableSrcFile("src/index.test.ts")).toBe(false);
    expect(isMutableSrcFile("scripts/setup-lib.mjs")).toBe(false);
    expect(isMutableSrcFile("README.md")).toBe(false);
  });
});

describe("findMutableSrcChanges", () => {
  it("keeps only mutable src files", () => {
    expect(
      findMutableSrcChanges([
        "src/index.ts",
        "src/index.test.ts",
        "scripts/run-mutation-changed.ts",
        "package.json",
      ]),
    ).toEqual(["src/index.ts"]);
  });
});

describe("runMutationChangedCli", () => {
  it("throws when the base ref is missing", () => {
    expect(() => runMutationChangedCli(import.meta.url, [])).toThrow(/Missing base ref/);
  });

  it("skips when the diff has no mutable src paths", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mutation-skip-"));
    try {
      initGitRepo(tempDir, gitExecutable);
      writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
      const base = gitCommitPaths(tempDir, "base", ["README.md"], gitExecutable);
      writeFileSync(join(tempDir, "AGENTS.md"), "# agents\n", "utf8");
      const head = gitCommitPaths(tempDir, "docs only", ["AGENTS.md"], gitExecutable);
      const moduleUrl = copyMutationScripts(tempDir);
      let output = "";
      const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        output += String(chunk);
        return true;
      });
      runMutationChangedCli(moduleUrl, [base, head]);
      stdout.mockRestore();
      expect(output).toMatch(/No mutable src\/ changes/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("runs Stryker when mutable src paths changed", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mutation-run-"));
    try {
      initGitRepo(tempDir, gitExecutable);
      writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
      const base = gitCommitPaths(tempDir, "base", ["README.md"], gitExecutable);
      mkdirSync(join(tempDir, "src"), { recursive: true });
      writeFileSync(join(tempDir, "src/index.ts"), "export {};\n", "utf8");
      const head = gitCommitPaths(tempDir, "src", ["src/index.ts"], gitExecutable);
      const moduleUrl = copyMutationScripts(tempDir);
      mkdirSync(join(tempDir, "node_modules", ".bin"), { recursive: true });
      const strykerPath = join(tempDir, "node_modules", ".bin", "stryker");
      writeFileSync(strykerPath, "#!/bin/sh\necho \"$@\" > .stryker-invoked\nexit 0\n", "utf8");
      chmodSync(strykerPath, 0o755);
      let output = "";
      const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        output += String(chunk);
        return true;
      });
      runMutationChangedCli(moduleUrl, [base, head]);
      stdout.mockRestore();
      expect(output).toMatch(/Mutation targets \(1\): src\/index\.ts/);
      expect(readFileSync(join(tempDir, ".stryker-invoked"), "utf8")).toMatch(/src\/index\.ts/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
