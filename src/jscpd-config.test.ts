import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const jscpdConfigRaw = readFileSync(new URL("../.jscpd.json", import.meta.url), "utf8");

describe(".jscpd.json contract", () => {
  it("scopes jscpd to Markdown, YAML, and Bash (not TypeScript/JavaScript)", () => {
    const parsed: unknown = JSON.parse(jscpdConfigRaw);
    if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid .jscpd.json");
    const format = Reflect.get(parsed, "format");
    expect(format).toEqual(["markdown", "yaml", "bash"]);
    const path = Reflect.get(parsed, "path");
    expect(path).toEqual(
      expect.arrayContaining(["docs", ".github/workflows", "scripts", "AGENTS.md", "README.md"]),
    );
    expect(path).not.toContain("src");
    expect(path).not.toContain("packages/eslint-sonarjs");
    expect(Reflect.get(parsed, "threshold")).toBe(0);
    expect(Reflect.get(parsed, "mode")).toBe("strict");
    expect(Reflect.get(parsed, "minLines")).toBe(8);
    expect(Reflect.get(parsed, "minTokens")).toBe(70);
  });
});