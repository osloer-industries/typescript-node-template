import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const nodeArgs = ["scripts/count-suppressions.ts"];

async function loadModule() {
  return import("./count-suppressions.js");
}

describe("countSuppressionsInText", () => {
  it("counts disable and ts-comment patterns", async () => {
    const { countSuppressionsInText } = await loadModule();
    const sample = `
// eslint-disable-next-line no-console
// oxlint-disable-line complexity
// @ts-expect-error legacy
const x = 1;
`;
    expect(countSuppressionsInText(sample)).toBe(3);
  });

  it("returns zero for clean source", async () => {
    const { countSuppressionsInText } = await loadModule();
    expect(countSuppressionsInText("export const ok = 1;\n")).toBe(0);
  });
});

describe("assertShrinkOnly", () => {
  it("allows equal or lower counts", async () => {
    const { assertShrinkOnly } = await loadModule();
    expect(() => assertShrinkOnly(0, { version: 1, total: 0 })).not.toThrow();
    expect(() => assertShrinkOnly(0, { version: 1, total: 1 })).not.toThrow();
  });

  it("rejects increases", async () => {
    const { assertShrinkOnly } = await loadModule();
    expect(() => assertShrinkOnly(2, { version: 1, total: 1 })).toThrow(/exceeds baseline/);
  });
});

describe("countSuppressions", () => {
  it("ignores missing scan roots", async () => {
    const { countSuppressions } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "suppression-missing-root-"));
    try {
      mkdirSync(join(tempDir, "src"), { recursive: true });
      writeFileSync(join(tempDir, "src/clean.ts"), "export const ok = 1;\n", "utf8");
      expect(countSuppressions(tempDir)).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("walks src and scripts trees", async () => {
    const { countSuppressions } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "suppression-count-"));
    try {
      mkdirSync(join(tempDir, "src"), { recursive: true });
      writeFileSync(join(tempDir, "src/bad.ts"), "export const ok = 1;\n", "utf8");
      writeFileSync(join(tempDir, "src/hidden.ts"), "// @ts-ignore\nexport {};\n", "utf8");
      expect(countSuppressions(tempDir)).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("baseline IO", () => {
  it("loads and writes baseline files", async () => {
    const { loadBaseline, writeBaseline } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "suppression-baseline-"));
    const baselinePath = join(tempDir, "baseline.json");
    try {
      writeBaseline(baselinePath, 4);
      expect(loadBaseline(baselinePath)).toEqual({ version: 1, total: 4 });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects invalid baseline JSON", async () => {
    const { loadBaseline } = await loadModule();
    const tempDir = mkdtempSync(join(tmpdir(), "suppression-baseline-bad-"));
    const baselinePath = join(tempDir, "baseline.json");
    try {
      writeFileSync(baselinePath, '{"version":2,"total":1}\n', "utf8");
      expect(() => loadBaseline(baselinePath)).toThrow(/Invalid suppression baseline/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("count-suppressions CLI", () => {
  it("passes on the template baseline", () => {
    const output = execFileSync(process.execPath, nodeArgs, {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(output).toMatch(/shrink-only OK/);
  });

  it("fails when suppressions exceed the baseline", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "suppression-over-"));
    try {
      mkdirSync(join(tempDir, "scripts"), { recursive: true });
      mkdirSync(join(tempDir, "src"), { recursive: true });
      cpSync(join(repoRoot, "scripts/count-suppressions.ts"), join(tempDir, "scripts/count-suppressions.ts"));
      writeFileSync(
        join(tempDir, "scripts/suppression-baseline.json"),
        `${JSON.stringify({ version: 1, total: 0 })}\n`,
        "utf8",
      );
      writeFileSync(join(tempDir, "src/bad.ts"), "// @ts-ignore\nexport {};\n", "utf8");
      let failed = false;
      try {
        execFileSync(process.execPath, ["scripts/count-suppressions.ts"], {
          cwd: tempDir,
          encoding: "utf8",
        });
      } catch {
        failed = true;
      }
      expect(failed, "expected non-zero exit when baseline exceeded").toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes baseline in a fixture tree", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "suppression-cli-"));
    try {
      mkdirSync(join(tempDir, "scripts"), { recursive: true });
      mkdirSync(join(tempDir, "src"), { recursive: true });
      cpSync(join(repoRoot, "scripts/count-suppressions.ts"), join(tempDir, "scripts/count-suppressions.ts"));
      execFileSync(process.execPath, ["scripts/count-suppressions.ts", "--write-baseline"], {
        cwd: tempDir,
        encoding: "utf8",
      });
      const parsed: unknown = JSON.parse(
        readFileSync(join(tempDir, "scripts/suppression-baseline.json"), "utf8"),
      );
      const total =
        typeof parsed === "object" && parsed !== null
          ? Reflect.get(parsed, "total")
          : undefined;
      expect(total).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
