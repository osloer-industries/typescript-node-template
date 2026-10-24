import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  checkHttpLink,
  checkMarkdownFileLinks,
  isHttpLink,
  isSkippableLink,
  resolveRepositoryLink,
} from "./index.mjs";
import {
  checkRepositoryMarkdownFiles,
  collectMarkdownFiles,
  isCheckRepoCliEntry,
  runCheckRepoCli,
} from "./check-repo.mjs";

vi.mock("link-check", () => ({
  default: vi.fn((_url, _options, callback) => {
    callback(undefined, { status: "alive", statusCode: 200 });
  }),
}));

describe("resolveRepositoryLink", () => {
  it("accepts existing relative targets", () => {
    const dir = mkdtempSync(join(tmpdir(), "mlc-"));
    try {
      writeFileSync(join(dir, "target.md"), "# Target\n");
      const readme = join(dir, "README.md");
      writeFileSync(readme, "[x](./target.md)\n");
      expect(resolveRepositoryLink(readme, "./target.md")).toEqual({ ok: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports missing relative targets", () => {
    const dir = mkdtempSync(join(tmpdir(), "mlc-missing-"));
    try {
      const readme = join(dir, "README.md");
      writeFileSync(readme, "[x](./missing.md)\n");
      const result = resolveRepositoryLink(readme, "./missing.md");
      expect(result.ok).toBe(false);
      expect(result.resolved).toContain("missing.md");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts fragment-only links", () => {
    const readme = join(tmpdir(), "README.md");
    expect(resolveRepositoryLink(readme, "#section")).toEqual({ ok: true });
  });
});

describe("checkMarkdownFileLinks", () => {
  it("validates relative links in a markdown file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mlc-check-"));
    try {
      mkdirSync(join(dir, "docs"), { recursive: true });
      writeFileSync(join(dir, "docs", "guide.md"), "# Guide\n");
      const readme = join(dir, "README.md");
      const markdown = "[Guide](docs/guide.md)\n";
      writeFileSync(readme, markdown);
      await expect(checkMarkdownFileLinks(markdown, readme)).resolves.toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects broken relative links", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mlc-broken-"));
    try {
      const readme = join(dir, "README.md");
      const markdown = "[Missing](docs/missing.md)\n";
      writeFileSync(readme, markdown);
      await expect(checkMarkdownFileLinks(markdown, readme)).rejects.toThrow(/missing target docs\/missing.md/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("checks http links via link-check", async () => {
    const readme = join(mkdtempSync(join(tmpdir(), "mlc-http-")), "README.md");
    await expect(checkMarkdownFileLinks("[Example](https://example.com)\n", readme)).resolves.toBeUndefined();
  });
});

describe("link helpers", () => {
  it("detects http(s) links", () => {
    expect(isHttpLink("https://example.com")).toBe(true);
    expect(isHttpLink("docs/a.md")).toBe(false);
  });

  it("skips anchors and mailto links", () => {
    expect(isSkippableLink("#section")).toBe(true);
    expect(isSkippableLink("mailto:team@example.com")).toBe(true);
    expect(isSkippableLink("docs/a.md")).toBe(false);
  });

  it("rejects dead http links", async () => {
    const linkCheck = (await import("link-check")).default;
    vi.mocked(linkCheck).mockImplementationOnce((_url, _options, callback) => {
      callback(undefined, { status: "dead", statusCode: 404 });
    });
    await expect(checkHttpLink("https://example.com/missing", {})).rejects.toThrow(/404/);
  });
});

describe("checkRepositoryMarkdownFiles", () => {
  it("collects markdown files and validates them", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mlc-repo-"));
    try {
      writeFileSync(join(dir, "README.md"), "# Root\n");
      mkdirSync(join(dir, "docs"), { recursive: true });
      writeFileSync(join(dir, "docs", "guide.md"), "[Root](../README.md)\n");
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      writeFileSync(join(dir, "node_modules", "ignored.md"), "[x](./nope.md)\n");
      const files = [];
      collectMarkdownFiles(dir, files);
      expect(files).toHaveLength(2);
      const failures = await checkRepositoryMarkdownFiles(dir);
      expect(failures).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs repository cli with config", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mlc-cli-"));
    try {
      writeFileSync(join(dir, "README.md"), "# Root\n");
      const configPath = join(dir, "link-check.json");
      writeFileSync(configPath, "{}");
      await expect(runCheckRepoCli(["node", "check-repo.mjs", "--config", configPath], dir)).resolves.toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects check-repo cli entry", () => {
    const cliAbs = join(mkdtempSync(join(tmpdir(), "mlc-cli-entry-")), "check-repo.mjs");
    const cliUrl = `file://${cliAbs}`;
    expect(isCheckRepoCliEntry(cliUrl, cliAbs)).toBe(true);
    expect(isCheckRepoCliEntry(cliUrl, "/other.mjs")).toBe(false);
  });

  it("returns formatted failures", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mlc-repo-fail-"));
    try {
      writeFileSync(join(dir, "README.md"), "[Missing](./nope.md)\n");
      const failures = await checkRepositoryMarkdownFiles(dir);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatch(/README.md: missing target/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
