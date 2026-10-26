import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { copyTemplateFixture } from "./copy-template-fixture.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

describe("copyTemplateFixture", () => {
  it("copies template files and writes vitest config", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "copy-fixture-"));
    try {
      copyTemplateFixture(repoRoot, tempDir);
      expect(readFileSync(join(tempDir, "vitest.config.ts"), "utf8")).toContain("thresholds");
      expect(readFileSync(join(tempDir, "package.json"), "utf8")).toContain("typescript-node-template");
      expect(statSync(join(tempDir, "scripts/setup-lib.mjs")).isFile()).toBe(true);
      expect(statSync(join(tempDir, "src/index.ts")).isFile()).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
