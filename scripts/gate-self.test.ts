import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const oxlintConfig = join(repoRoot, ".oxlintrc.json");
const oxlintExecutable = join(repoRoot, "node_modules", ".bin", "oxlint");
const sonarjsConfig = join(repoRoot, "packages/eslint-sonarjs/eslint.config.mjs");

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
