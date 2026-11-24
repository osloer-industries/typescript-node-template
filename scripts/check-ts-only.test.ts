import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { gitCommitPaths, gitExecutableForTests, initGitRepo } from "./test-git-fixture.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const checkTsOnlyRelativePath = "scripts/check-ts-only.ts";
const shrinkOnlyRelativePath = "scripts/shrink-only-ratchet.ts";
const allowlistRelativePath = "quality/js-allowlist.json";
const nodeArgs = [checkTsOnlyRelativePath];
const utf8 = "utf8";
const gitExecutable = gitExecutableForTests("TS_ONLY_GIT_PATH");
const newMjsPath = "scripts/new.mjs";
const newTsPath = "scripts/new.ts";
const sampleMjsPath = "scripts/a.mjs";
const scriptsBMjs = "scripts/b.mjs";
const seedMjsPath = "scripts/seed.mjs";
const emptyMjsExport = "export {};\n";
const shrinkOnlyOkPattern = /shrink-only OK/;
const staleAllowlistPattern = /Stale allowlist entries \(path missing on disk\)/;

function execCheckTsOnlyFromTemp(
  cwd: string,
  args: readonly string[] = nodeArgs,
): { failed: boolean; output: string } {
  try {
    const output = execFileSync(process.execPath, args, { cwd, encoding: utf8, stdio: "pipe" });
    return { failed: false, output };
  } catch (error) {
    let output = "";
    if (error instanceof Error) {
      output = error.message;
      const stderr = Reflect.get(error, "stderr");
      if (typeof stderr === "string") output += stderr;
    }
    return { failed: true, output };
  }
}

async function loadModule() {
  return import("./check-ts-only.js");
}

function copyGateScripts(tempDir: string): void {
  mkdirSync(join(tempDir, "scripts"), { recursive: true });
  mkdirSync(join(tempDir, "quality"), { recursive: true });
  for (const relative of [
    checkTsOnlyRelativePath,
    shrinkOnlyRelativePath,
    "scripts/list-untyped-js-on-disk.mjs",
  ]) {
    cpSync(join(repoRoot, relative), join(tempDir, relative));
  }
}

function initGateFixture(
  prefix: string,
  allowlistPaths: readonly string[],
  extraTracked: { path: string; content: string }[] = [],
): string {
  const tempDir = mkdtempSync(join(tmpdir(), prefix));
  copyGateScripts(tempDir);
  writeFileSync(
    join(tempDir, allowlistRelativePath),
    `${JSON.stringify({ version: 1, paths: [...allowlistPaths] }, null, 2)}\n`,
    utf8,
  );
  initGitRepo(tempDir, gitExecutable);
  const toCommit: string[] = [allowlistRelativePath, checkTsOnlyRelativePath, shrinkOnlyRelativePath];
  for (const file of extraTracked) {
    const absolute = join(tempDir, file.path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, file.content, utf8);
    toCommit.push(file.path);
  }
  gitCommitPaths(tempDir, "seed", toCommit, gitExecutable);
  return tempDir;
}

function seedOnlyExtra(): { path: string; content: string }[] {
  return [{ path: seedMjsPath, content: emptyMjsExport }];
}

describe("loadJsAllowlist", () => {
  it("rejects invalid JSON shapes", async () => {
    const { loadJsAllowlist } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "js-allowlist-bad-"));
    const allowlistPath = join(tempDir, "allowlist.json");
    try {
      writeFileSync(allowlistPath, "null\n", utf8);
      expect(() => loadJsAllowlist(allowlistPath)).toThrow(/Invalid JS allowlist JSON/);
      writeFileSync(allowlistPath, '{"version":2,"paths":[]}\n', utf8);
      expect(() => loadJsAllowlist(allowlistPath)).toThrow(/Invalid JS allowlist/);
      writeFileSync(allowlistPath, '{"version":1,"paths":["a.mjs","a.mjs"]}\n', utf8);
      expect(() => loadJsAllowlist(allowlistPath)).toThrow(/duplicate/);
      writeFileSync(allowlistPath, '{"version":1,"paths":["  "]}\n', utf8);
      expect(() => loadJsAllowlist(allowlistPath)).toThrow(/Invalid JS allowlist path entry/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("writeJsAllowlist", () => {
  it("persists sorted normalized paths", async () => {
    const { loadJsAllowlist, writeJsAllowlist } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "js-allowlist-write-"));
    const allowlistPath = join(tempDir, "allowlist.json");
    try {
      writeJsAllowlist(allowlistPath, [scriptsBMjs, sampleMjsPath]);
      expect(loadJsAllowlist(allowlistPath).paths).toEqual([sampleMjsPath, scriptsBMjs]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("resolveJsPathsForGate", () => {
  it("falls back to disk listing when the tree is not a git repository", async () => {
    const { resolveJsPathsForGate } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "ts-only-no-git-"));
    try {
      mkdirSync(join(tempDir, "scripts"), { recursive: true });
      writeFileSync(join(tempDir, "scripts", "only.mjs"), emptyMjsExport, utf8);
      expect(resolveJsPathsForGate(tempDir)).toEqual(["scripts/only.mjs"]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rethrows unexpected git failures", async () => {
    const { resolveJsPathsForGate } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "ts-only-git-err-"));
    initGitRepo(tempDir, gitExecutable);
    const previous = process.env.TS_ONLY_GIT_PATH;
    process.env.TS_ONLY_GIT_PATH = "/definitely-missing-git-binary";
    try {
      expect(() => resolveJsPathsForGate(tempDir)).toThrow(/ENOENT|not found/i);
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(process.env, "TS_ONLY_GIT_PATH");
      } else {
        process.env.TS_ONLY_GIT_PATH = previous;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runCheckTsOnlyCli", () => {
  it("writes a shrunk allowlist in write mode", async () => {
    const { runCheckTsOnlyCli } = await loadModule();
    const paths = [sampleMjsPath, scriptsBMjs];
    const tempDir = initGateFixture("ts-only-cli-write-", paths, [
      { path: sampleMjsPath, content: emptyMjsExport },
      { path: scriptsBMjs, content: emptyMjsExport },
    ]);
    try {
      execFileSync(gitExecutable, ["rm", scriptsBMjs], { cwd: tempDir, stdio: "pipe" });
      execFileSync(gitExecutable, ["commit", "-m", "drop b"], { cwd: tempDir, stdio: "pipe" });
      const moduleUrl = new URL(`file://${join(tempDir, checkTsOnlyRelativePath)}`).href;
      let output = "";
      const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        output += String(chunk);
        return true;
      });
      runCheckTsOnlyCli(moduleUrl, ["--write-allowlist"]);
      stdout.mockRestore();
      expect(output).toMatch(/Wrote JS allowlist/);
      const parsed: unknown = JSON.parse(readFileSync(join(tempDir, allowlistRelativePath), utf8));
      const allowPaths =
        typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "paths") : undefined;
      expect(allowPaths).toEqual([sampleMjsPath]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("passes when tracked JS matches the allowlist", async () => {
    const { runCheckTsOnlyCli } = await loadModule();
    const paths = [sampleMjsPath];
    const tempDir = initGateFixture("ts-only-cli-ok-", paths, [
      { path: sampleMjsPath, content: emptyMjsExport },
    ]);
    try {
      const moduleUrl = new URL(`file://${join(tempDir, checkTsOnlyRelativePath)}`).href;
      let output = "";
      const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        output += String(chunk);
        return true;
      });
      runCheckTsOnlyCli(moduleUrl, []);
      stdout.mockRestore();
      expect(output).toMatch(shrinkOnlyOkPattern);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("check-ts-only gate canary", () => {
  it("treats a matching tree as a failed canary when expecting violations", async () => {
    const { listGitTrackedJsPaths, loadJsAllowlist, assertTsOnlyGate } = await loadModule();
    const paths = [sampleMjsPath];
    const tempDir = initGateFixture("ts-only-canary-", paths, [
      { path: sampleMjsPath, content: emptyMjsExport },
    ]);
    try {
      expect(() => assertTsOnlyGate(tempDir)).not.toThrow();
      const tracked = listGitTrackedJsPaths(tempDir);
      const allowlist = loadJsAllowlist(join(tempDir, allowlistRelativePath));
      let harnessError = "";
      try {
        expect(tracked.length, "canary harness must fail when no unlisted JS exists").toBeGreaterThan(
          allowlist.paths.length,
        );
      } catch (error) {
        harnessError = String(error);
      }
      expect(harnessError).toContain("canary harness must fail");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails when scripts/new.mjs is tracked but not allowlisted", { timeout: 30_000 }, () => {
    const tempDir = initGateFixture("ts-only-new-mjs-", [seedMjsPath], seedOnlyExtra());
    try {
      writeFileSync(join(tempDir, newMjsPath), emptyMjsExport, utf8);
      execFileSync(gitExecutable, ["add", newMjsPath], { cwd: tempDir, stdio: "pipe" });
      execFileSync(gitExecutable, ["commit", "-m", "add mjs"], { cwd: tempDir, stdio: "pipe" });
      const { failed } = execCheckTsOnlyFromTemp(tempDir);
      expect(failed, "expected non-zero exit when scripts/new.mjs is tracked").toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("passes when scripts/new.ts is tracked (not gated)", { timeout: 30_000 }, () => {
    const tempDir = initGateFixture("ts-only-new-ts-", [seedMjsPath], seedOnlyExtra());
    try {
      writeFileSync(join(tempDir, newTsPath), "export const ok = 1;\n", utf8);
      execFileSync(gitExecutable, ["add", newTsPath], { cwd: tempDir, stdio: "pipe" });
      execFileSync(gitExecutable, ["commit", "-m", "add ts"], { cwd: tempDir, stdio: "pipe" });
      const { failed, output } = execCheckTsOnlyFromTemp(tempDir);
      expect(failed).toBe(false);
      expect(output).toMatch(shrinkOnlyOkPattern);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails on stale allowlist entries", { timeout: 30_000 }, () => {
    const tempDir = initGateFixture(
      "ts-only-stale-",
      [seedMjsPath, "scripts/ghost.mjs"],
      seedOnlyExtra(),
    );
    try {
      const { failed, output } = execCheckTsOnlyFromTemp(tempDir);
      expect(failed, "expected non-zero exit for stale allowlist entry").toBe(true);
      expect(output).toMatch(staleAllowlistPattern);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("check-ts-only CLI", () => {
  it("passes on the template repository", () => {
    const output = execFileSync(process.execPath, nodeArgs, {
      cwd: repoRoot,
      encoding: utf8,
    });
    expect(output).toMatch(shrinkOnlyOkPattern);
  });

  it("writes a shrunk allowlist after conversion", { timeout: 30_000 }, () => {
    const paths = [sampleMjsPath, scriptsBMjs];
    const tempDir = initGateFixture("ts-only-write-", paths, [
      { path: sampleMjsPath, content: emptyMjsExport },
      { path: scriptsBMjs, content: emptyMjsExport },
    ]);
    try {
      execFileSync(gitExecutable, ["rm", scriptsBMjs], { cwd: tempDir, stdio: "pipe" });
      execFileSync(gitExecutable, ["commit", "-m", "drop b"], { cwd: tempDir, stdio: "pipe" });
      execFileSync(process.execPath, [...nodeArgs, "--write-allowlist"], {
        cwd: tempDir,
        encoding: utf8,
      });
      const parsed: unknown = JSON.parse(readFileSync(join(tempDir, allowlistRelativePath), utf8));
      const allowPaths =
        typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "paths") : undefined;
      expect(allowPaths).toEqual([sampleMjsPath]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});