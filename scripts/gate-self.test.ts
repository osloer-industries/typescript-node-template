import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const oxlintConfig = join(repoRoot, ".oxlintrc.json");
const oxlintExecutable = join(repoRoot, "node_modules", ".bin", "oxlint");

function runOxlintOnFile(relativeFilePath: string, cwd: string): void {
  execFileSync(oxlintExecutable, ["-c", oxlintConfig, relativeFilePath], {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
  });
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
      let failed = false;
      try {
        runOxlintOnFile(fileName, tempDir);
      } catch {
        failed = true;
      }
      expect(failed, `expected oxlint to fail for ${fileName}`).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
