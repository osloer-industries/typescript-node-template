import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const oxlintConfig = join(repoRoot, ".oxlintrc.json");
const oxlintExecutable = join(repoRoot, "node_modules", ".bin", "oxlint");
const sonarLint = join(repoRoot, "scripts/lint-sonarjs.mjs");

function runOxlintOnFile(relativeFilePath: string, cwd: string): void {
  execFileSync(oxlintExecutable, ["-c", oxlintConfig, relativeFilePath], {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
  });
}

function lintFailed(run: () => void): boolean {
  try {
    run();
    return false;
  } catch {
    return true;
  }
}

describe("gate self-tests (oxlint escape hatches)", () => {
  it("passes on strict TypeScript without shortcuts", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "gate-self-clean-"));
    try {
      writeFileSync(
        join(tempDir, "clean.ts"),
        "export function add(a: number, b: number): number {\n  return a + b;\n}\n",
        "utf8",
      );
      expect(() => runOxlintOnFile("clean.ts", tempDir)).not.toThrow();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.each([
    ["explicit any", "export const value: any = 1;\n", "any.ts"],
    ["ts-ignore", "// @ts-ignore\nexport const value: unknown = 1;\n", "ts-ignore.ts"],
    [
      "non-null assertion",
      "declare const maybe: string | undefined;\nexport const forced = maybe!;\n",
      "non-null.ts",
    ],
    [
      "blanket eslint-disable",
      "/* eslint-disable */\nexport const value: any = 1;\n",
      "eslint-disable.ts",
    ],
  ])("rejects %s", (_label, source, fileName) => {
    const tempDir = mkdtempSync(join(tmpdir(), "gate-self-"));
    try {
      writeFileSync(join(tempDir, fileName), source, "utf8");
      expect(lintFailed(() => runOxlintOnFile(fileName, tempDir)), `oxlint should fail for ${fileName}`).toBe(
        true,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("gate self-tests (SonarJS shortcuts)", () => {
  it("rejects trivial expect(true) assertions", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "gate-self-sonar-"));
    const fileName = "trivial.test.ts";
    try {
      writeFileSync(
        join(tempDir, fileName),
        `import { expect, it } from "vitest";\nit("bad", () => { expect(true).toBe(true); });\n`,
        "utf8",
      );
      const failed = lintFailed(() =>
        execFileSync(process.execPath, [sonarLint, fileName], {
          cwd: tempDir,
          stdio: "pipe",
          encoding: "utf8",
        }),
      );
      expect(failed, `SonarJS should fail for ${fileName}`).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
