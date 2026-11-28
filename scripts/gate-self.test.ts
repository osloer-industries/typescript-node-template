import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const oxlintConfig = join(repoRoot, ".oxlintrc.json");
const oxlintExecutable = join(repoRoot, "node_modules", ".bin", "oxlint");
const sonarjsConfig = join(repoRoot, "packages/eslint-sonarjs/eslint.config.mjs");
const depcruiseConfig = join(repoRoot, ".dependency-cruiser.cjs");
const depcruiseExecutable = join(repoRoot, "node_modules", ".bin", "depcruise");

type CommandResult = {
  status: number;
  output: string;
};

function execCommand(command: string, args: readonly string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  return {
    status: result.status ?? 1,
    output: `${stdout}${stderr}`,
  };
}

/** Oxlint prints `plugin(rule-id)`; ESLint uses `plugin/rule-id`. */
function outputContainsRuleId(output: string, ruleId: string): boolean {
  if (output.includes(ruleId)) {
    return true;
  }
  const slash = ruleId.indexOf("/");
  if (slash === -1) {
    return output.includes(`(${ruleId})`) || output.includes(ruleId);
  }
  const plugin = ruleId.slice(0, slash);
  const rule = ruleId.slice(slash + 1);
  return output.includes(`${plugin}(${rule})`);
}

function assertLintReportsRule(result: CommandResult, expectedRuleId: string): void {
  expect.hasAssertions();
  expect(result.status, `expected exit 1 (findings), got ${result.status}\n${result.output}`).toBe(1);
  expect(
    outputContainsRuleId(result.output, expectedRuleId),
    `expected rule ${expectedRuleId} in output:\n${result.output}`,
  ).toBe(true);
}

function runOxlintOnFile(filePath: string): CommandResult {
  return execCommand(oxlintExecutable, ["-c", oxlintConfig, filePath], repoRoot);
}

function resolveEslintBin(): string {
  const sonarPkgJson = join(repoRoot, "packages/eslint-sonarjs/package.json");
  const requireFromSonarPkg = createRequire(sonarPkgJson);
  const eslintPackageRoot = resolve(requireFromSonarPkg.resolve("eslint/package.json"), "..");
  return join(eslintPackageRoot, "bin", "eslint.js");
}

function runSonarjsOnFile(filePath: string): CommandResult {
  return execCommand(process.execPath, [resolveEslintBin(), "-c", sonarjsConfig, filePath], repoRoot);
}

function writeTempOxlintSource(source: string, fileName: string): { filePath: string; cleanup: () => void } {
  const tempDir = mkdtempSync(join(tmpdir(), "gate-self-ox-"));
  const filePath = join(tempDir, fileName);
  writeFileSync(filePath, source, "utf8");
  return {
    filePath,
    cleanup: () => {
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

/** Oxlint `src/**` boundary overrides apply only to files under `src/`. */
function writeTempSrcOxlintSource(source: string, fileName: string): { filePath: string; cleanup: () => void } {
  const tempDir = mkdtempSync(join(repoRoot, "src", "gate-self-"));
  const filePath = join(tempDir, fileName);
  writeFileSync(filePath, source, "utf8");
  return {
    filePath,
    cleanup: () => {
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function runDepcruiseOnRoots(roots: readonly string[]): CommandResult {
  return execCommand(depcruiseExecutable, ["--config", depcruiseConfig, "--output-type", "err", ...roots], repoRoot);
}

function assertDepcruiseReportsRule(result: CommandResult, ruleName: string): void {
  expect.hasAssertions();
  expect(result.status, `expected exit non-zero, got ${result.status}\n${result.output}`).not.toBe(0);
  expect(
    result.output.includes(ruleName),
    `expected rule ${ruleName} in output:\n${result.output}`,
  ).toBe(true);
}

function writeTempDepcruiseProbe(
  files: Readonly<Record<string, string>>,
): { roots: string[]; cleanup: () => void } {
  const tempDir = mkdtempSync(join(repoRoot, "src", "gate-self-depcruise-"));
  for (const [fileName, source] of Object.entries(files)) {
    const filePath = join(tempDir, fileName);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, source, "utf8");
  }
  return {
    roots: [tempDir],
    cleanup: () => {
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function writeTempSonarjsSource(source: string, fileName: string): { filePath: string; cleanup: () => void } {
  const tempDir = mkdtempSync(join(repoRoot, "scripts", "gate-self-"));
  const filePath = join(tempDir, fileName);
  writeFileSync(filePath, source, "utf8");
  return {
    filePath,
    cleanup: () => {
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

describe("gate self-test harness", () => {
  it("treats exit 0 (no findings) as a failed canary expectation", () => {
    const { filePath, cleanup } = writeTempOxlintSource(
      "export function add(a: number, b: number): number {\n  return a + b;\n}\n",
      "clean.ts",
    );
    try {
      const result = runOxlintOnFile(filePath);
      expect(result.status).toBe(0);
      let harnessError = "";
      try {
        assertLintReportsRule(result, "typescript/no-explicit-any");
      } catch (error) {
        harnessError = String(error);
      }
      expect(harnessError, "canary harness must fail when lint reports no findings").toContain(
        "expected exit 1 (findings), got 0",
      );
    } finally {
      cleanup();
    }
  });
});

const consistentTypeAssertionsRule = "typescript/consistent-type-assertions";

describe("gate self-tests (oxlint escape hatches)", () => {
  it.each([
    ["explicit any", "export const value: any = 1;\n", "any.ts", "typescript/no-explicit-any"],
    [
      "ts-ignore",
      "// @ts-ignore\nexport const value: unknown = 1;\n",
      "ts-ignore.ts",
      "typescript/ban-ts-comment",
    ],
    [
      "non-null assertion",
      "declare const maybe: string | undefined;\nexport const forced = maybe!;\n",
      "non-null.ts",
      "typescript/no-non-null-assertion",
    ],
    [
      "blanket eslint-disable",
      "/* eslint-disable */\nexport const value: any = 1;\n",
      "eslint-disable.ts",
      "unicorn/no-abusive-eslint-disable",
    ],
    [
      "empty catch",
      "export function swallow(): void {\n  try {\n    throw new Error(\"fail\");\n  } catch {}\n}\n",
      "empty-catch.ts",
      "no-empty",
    ],
    [
      "upcast as",
      "export const widened = \"x\" as string;\n",
      "as-upcast.ts",
      consistentTypeAssertionsRule,
    ],
    [
      "double cast",
      "export const forced = (\"s\" as unknown) as number;\n",
      "as-double.ts",
      consistentTypeAssertionsRule,
    ],
    [
      "angle-bracket assertion",
      "declare const raw: unknown;\nexport const text = <string>raw;\n",
      "as-angle.ts",
      consistentTypeAssertionsRule,
    ],
    [
      "ts-expect-error with description",
      "// @ts-expect-error intentionally wrong for this canary\nexport const value: number = \"a\";\n",
      "ts-expect-error.ts",
      "typescript/ban-ts-comment",
    ],
    [
      "definite-assignment field",
      "export class Holder {\n  value!: number;\n}\n",
      "definite-field.ts",
      "osloer/no-definite-assignment",
    ],
    [
      "definite-assignment variable",
      "let later!: string;\nlater = \"a\";\nexport { later };\n",
      "definite-variable.ts",
      "osloer/no-definite-assignment",
    ],
  ] as const)("rejects %s with rule %s", (_label, source, fileName, ruleId) => {
    const { filePath, cleanup } = writeTempOxlintSource(source, fileName);
    try {
      expect.assertions(2);
      assertLintReportsRule(runOxlintOnFile(filePath), ruleId);
    } finally {
      cleanup();
    }
  });
});

describe("gate self-tests (allowed type constructs)", () => {
  it("allows as const and satisfies under the blanket assertion ban", () => {
    const { filePath, cleanup } = writeTempOxlintSource(
      'export const modes = ["a", "b"] as const;\nexport const config = { port: 1 } satisfies { port: number };\n',
      "allowed-constructs.ts",
    );
    try {
      const result = runOxlintOnFile(filePath);
      expect({ status: result.status, output: result.output }).toEqual({ status: 0, output: expect.any(String) });
    } finally {
      cleanup();
    }
  });
});

describe("gate self-tests (architecture boundaries)", () => {
  it("rejects src imports from scripts/", () => {
    const { filePath, cleanup } = writeTempSrcOxlintSource(
      'import "../scripts/run-npm.ts";\n',
      "uses-scripts.ts",
    );
    try {
      expect.assertions(2);
      assertLintReportsRule(runOxlintOnFile(filePath), "no-restricted-imports");
    } finally {
      cleanup();
    }
  });
});

describe("gate self-tests (dependency-cruiser graph)", () => {
  it("rejects src imports from scripts/", () => {
    const { roots, cleanup } = writeTempDepcruiseProbe({
      "leak.ts": 'import "../../scripts/run-npm.ts";\nexport const x = 1;\n',
    });
    try {
      expect.assertions(2);
      assertDepcruiseReportsRule(runDepcruiseOnRoots(roots), "src-not-scripts");
    } finally {
      cleanup();
    }
  });

  it("rejects type-only imports from scripts/", () => {
    const { roots, cleanup } = writeTempDepcruiseProbe({
      "type-leak.ts":
        'import type * as SetupLib from "../../scripts/setup-lib.mjs";\nexport type Ref = SetupLib;\n',
    });
    try {
      expect.assertions(2);
      assertDepcruiseReportsRule(runDepcruiseOnRoots(roots), "src-not-scripts");
    } finally {
      cleanup();
    }
  });

  it("rejects circular imports", () => {
    const { roots, cleanup } = writeTempDepcruiseProbe({
      "m/a.ts": 'import "./b.js";\nexport const a = 1;\n',
      "m/b.ts": 'import "./a.js";\nexport const b = 1;\n',
    });
    try {
      expect.assertions(2);
      assertDepcruiseReportsRule(runDepcruiseOnRoots(roots), "no-circular");
    } finally {
      cleanup();
    }
  });

  it("rejects production src imports from devDependencies", () => {
    const { roots, cleanup } = writeTempDepcruiseProbe({
      "dev-dep.ts": 'import { fc } from "fast-check";\nexport const sample = fc.constant(1);\n',
    });
    try {
      expect.assertions(2);
      assertDepcruiseReportsRule(runDepcruiseOnRoots(roots), "src-not-to-dev-dep");
    } finally {
      cleanup();
    }
  });

  it("rejects unresolvable imports", () => {
    const { roots, cleanup } = writeTempDepcruiseProbe({
      "missing.ts": 'import "pkg-that-does-not-exist-gate-self";\nexport const x = 1;\n',
    });
    try {
      expect.assertions(2);
      assertDepcruiseReportsRule(runDepcruiseOnRoots(roots), "not-to-unresolvable");
    } finally {
      cleanup();
    }
  });

  it("fails when cruising zero modules (empty scope)", () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "gate-self-depcruise-empty-"));
    try {
      const depcruiseOnly = runDepcruiseOnRoots([emptyDir]);
      expect(depcruiseOnly.status, "depcruise alone false-greens empty scope").toBe(0);

      const lintResult = execCommand(process.execPath, ["scripts/lint-deps.ts", emptyDir], repoRoot);
      expect(lintResult.status).toBe(1);
      expect(lintResult.output).toMatch(/0 modules/);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("reports orphan modules", () => {
    const { roots, cleanup } = writeTempDepcruiseProbe({
      "orphan.ts": "export const lonely = 1;\n",
    });
    try {
      const result = runDepcruiseOnRoots(roots);
      expect(result.output).toContain("no-orphans");
    } finally {
      cleanup();
    }
  });
});

function initMinimalGuardrailRepo(): { tempDir: string; base: string; head: string } {
  const git = process.env.GUARDRAIL_GIT_PATH ?? "/usr/bin/git";
  const tempDir = mkdtempSync(join(tmpdir(), "gate-self-guardrail-"));
  execFileSync(git, ["init"], { cwd: tempDir, stdio: "pipe" });
  execFileSync(git, ["config", "user.email", "gate-self@example.com"], { cwd: tempDir, stdio: "pipe" });
  execFileSync(git, ["config", "user.name", "gate-self"], { cwd: tempDir, stdio: "pipe" });
  writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
  execFileSync(git, ["add", "README.md"], { cwd: tempDir, stdio: "pipe" });
  execFileSync(git, ["commit", "-m", "base"], { cwd: tempDir, stdio: "pipe" });
  const base = execFileSync(git, ["rev-parse", "HEAD"], { cwd: tempDir, encoding: "utf8" }).trim();
  writeFileSync(join(tempDir, "AGENTS.md"), "# agents\n", "utf8");
  execFileSync(git, ["add", "AGENTS.md"], { cwd: tempDir, stdio: "pipe" });
  execFileSync(git, ["commit", "-m", "harness"], { cwd: tempDir, stdio: "pipe" });
  const head = execFileSync(git, ["rev-parse", "HEAD"], { cwd: tempDir, encoding: "utf8" }).trim();
  installGuardrailCheckScript(tempDir);
  return { tempDir, base, head };
}

function installGuardrailCheckScript(tempDir: string): void {
  const scriptsDir = join(tempDir, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  for (const fileName of ["check-guardrail-changes.ts", "git-list-changed-paths.ts"]) {
    writeFileSync(
      join(scriptsDir, fileName),
      readFileSync(join(repoRoot, "scripts", fileName), "utf8"),
      "utf8",
    );
  }
}

describe("gate self-tests (guardrail detect)", () => {
  it("exits 0 when guardrail paths change and reports harness-approval", { timeout: 30_000 }, () => {
    const { tempDir, base, head } = initMinimalGuardrailRepo();
    try {
      const result = spawnSync(process.execPath, ["scripts/check-guardrail-changes.ts"], {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          GUARDRAIL_BASE_REF: base,
          GUARDRAIL_HEAD_REF: head,
        },
      });
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status, `expected exit 0\n${output}`).toBe(0);
      expect(output).toMatch(/Guardrail paths changed/);
      expect(output).toMatch(/harness-approval/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("passes for non-guardrail diffs", { timeout: 30_000 }, () => {
    const git = process.env.GUARDRAIL_GIT_PATH ?? "/usr/bin/git";
    const tempDir = mkdtempSync(join(tmpdir(), "gate-self-guardrail-ok-"));
    try {
      execFileSync(git, ["init"], { cwd: tempDir, stdio: "pipe" });
      execFileSync(git, ["config", "user.email", "gate-self@example.com"], { cwd: tempDir, stdio: "pipe" });
      execFileSync(git, ["config", "user.name", "gate-self"], { cwd: tempDir, stdio: "pipe" });
      writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
      execFileSync(git, ["add", "README.md"], { cwd: tempDir, stdio: "pipe" });
      execFileSync(git, ["commit", "-m", "base"], { cwd: tempDir, stdio: "pipe" });
      const base = execFileSync(git, ["rev-parse", "HEAD"], { cwd: tempDir, encoding: "utf8" }).trim();
      mkdirSync(join(tempDir, "src"), { recursive: true });
      writeFileSync(join(tempDir, "src/index.ts"), "export {};\n", "utf8");
      execFileSync(git, ["add", "src/index.ts"], { cwd: tempDir, stdio: "pipe" });
      execFileSync(git, ["commit", "-m", "src"], { cwd: tempDir, stdio: "pipe" });
      const head = execFileSync(git, ["rev-parse", "HEAD"], { cwd: tempDir, encoding: "utf8" }).trim();
      installGuardrailCheckScript(tempDir);
      const result = spawnSync(process.execPath, ["scripts/check-guardrail-changes.ts"], {
        cwd: tempDir,
        encoding: "utf8",
        env: { ...process.env, GUARDRAIL_BASE_REF: base, GUARDRAIL_HEAD_REF: head },
      });
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status, `expected exit 0\n${output}`).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("gate self-tests (SonarJS shortcuts)", () => {
  it("rejects trivial expect(true) assertions", () => {
    const { filePath, cleanup } = writeTempSonarjsSource(
      `import { expect, it } from "vitest";\nit("bad", () => { expect(true).toBe(true); });\n`,
      "trivial.test.ts",
    );
    try {
      expect.assertions(2);
      assertLintReportsRule(runSonarjsOnFile(filePath), "sonarjs/no-trivial-assertions");
    } finally {
      cleanup();
    }
  });
});
