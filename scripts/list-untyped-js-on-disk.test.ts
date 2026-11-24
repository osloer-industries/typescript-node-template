import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listJsPathsOnDisk } from "./list-untyped-js-on-disk.mjs";

const emptyMjsExport = "export {};\n";
const toolMjsPath = "scripts/tool.mjs";

describe("listJsPathsOnDisk", () => {
  it("lists untyped JS paths and skips node_modules", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "list-js-on-disk-"));
    try {
      mkdirSync(join(rootDir, "src"), { recursive: true });
      mkdirSync(join(rootDir, "scripts"), { recursive: true });
      mkdirSync(join(rootDir, "node_modules", "pkg"), { recursive: true });
      writeFileSync(join(rootDir, "src", "index.ts"), emptyMjsExport, "utf8");
      writeFileSync(join(rootDir, "scripts", "tool.mjs"), emptyMjsExport, "utf8");
      writeFileSync(join(rootDir, "node_modules", "pkg", "hidden.mjs"), emptyMjsExport, "utf8");
      const paths = listJsPathsOnDisk(rootDir).toSorted((a, b) => a.localeCompare(b));
      expect(paths).toEqual([toolMjsPath]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});