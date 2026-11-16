import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const jscpdConfigRaw = readFileSync(new URL("../.jscpd.json", import.meta.url), "utf8");
const lefthookYml = readFileSync(new URL("../lefthook.yml", import.meta.url), "utf8");

describe(".jscpd.json contract", () => {
  it("scopes jscpd to source, tests, docs, and workflows with Sonar-aligned threshold", () => {
    const parsed: unknown = JSON.parse(jscpdConfigRaw);
    if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid .jscpd.json");
    const format = Reflect.get(parsed, "format");
    expect(format).toEqual(["typescript", "javascript", "markdown", "yaml", "bash"]);
    const path = Reflect.get(parsed, "path");
    expect(path).toEqual(
      expect.arrayContaining([
        "src",
        "scripts",
        "packages",
        "docs",
        ".github/workflows",
        "AGENTS.md",
        "README.md",
      ]),
    );
    expect(Reflect.get(parsed, "threshold")).toBe(3);
    expect(Reflect.get(parsed, "mode")).toBe("strict");
    expect(Reflect.get(parsed, "minLines")).toBe(8);
    expect(Reflect.get(parsed, "minTokens")).toBe(70);
    const ignore = Reflect.get(parsed, "ignore");
    expect(ignore).toEqual(
      expect.arrayContaining([
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/package-lock.json",
      ]),
    );
  });

  it("runs lint:dup from lefthook when jscpd-scoped files are staged", () => {
    expect(lefthookYml).toContain("jscpd:");
    expect(lefthookYml).toContain("npm run lint:dup");
    expect(lefthookYml).toContain('glob: "*.{ts,tsx,mts,cts,js,mjs,cjs,md,yml,yaml}"');
  });
});