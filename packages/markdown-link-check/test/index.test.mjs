import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkMarkdownFileLinks, isHttpLink, resolveRepositoryLink } from "../index.mjs";

describe("resolveRepositoryLink", () => {
  it("accepts existing relative targets", () => {
    const dir = mkdtempSync(join(tmpdir(), "mlc-"));
    try {
      writeFileSync(join(dir, "target.md"), "# Target\n");
      const readme = join(dir, "README.md");
      writeFileSync(readme, "[x](./target.md)\n");
      assert.equal(resolveRepositoryLink(readme, "./target.md").ok, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("checkMarkdownFileLinks", () => {
  it("validates relative links in a markdown file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mlc-check-"));
    try {
      mkdirSync(join(dir, "docs"), { recursive: true });
      writeFileSync(join(dir, "docs", "guide.md"), "# Guide\n");
      const readme = join(dir, "README.md");
      writeFileSync(readme, "[Guide](docs/guide.md)\n");
      await checkMarkdownFileLinks(readFileSync(readme, "utf8"), readme);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("isHttpLink", () => {
  it("detects http(s) links", () => {
    assert.equal(isHttpLink("https://example.com"), true);
    assert.equal(isHttpLink("docs/a.md"), false);
  });
});
