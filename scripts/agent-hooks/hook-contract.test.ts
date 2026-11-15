import { describe, expect, it } from "vitest";
import { parseHookArgv, parseHookInputJson } from "./hook-contract.js";

describe("parseHookInputJson", () => {
  it("accepts an empty object from whitespace stdin", () => {
    expect(parseHookInputJson("  ")).toEqual({});
  });

  it("rejects malformed JSON", () => {
    expect(() => parseHookInputJson("{")).toThrow(/valid JSON/);
  });

  it("accepts paths and fastCheckStrike", () => {
    expect(
      parseHookInputJson(`{"paths":["src/a.ts","AGENTS.md"],"fastCheckStrike":1}`),
    ).toEqual({ paths: ["src/a.ts", "AGENTS.md"], fastCheckStrike: 1 });
  });

  it("rejects invalid paths", () => {
    expect(() => parseHookInputJson(`{"paths":"AGENTS.md"}`)).toThrow(/paths/);
  });

  it("rejects negative strike", () => {
    expect(() => parseHookInputJson(`{"fastCheckStrike":-1}`)).toThrow(/fastCheckStrike/);
  });
});

describe("parseHookArgv", () => {
  it("parses --paths and --fast-check-strike", () => {
    expect(parseHookArgv(["--paths", "a.ts,b.ts", "--fast-check-strike", "2"])).toEqual({
      paths: ["a.ts", "b.ts"],
      fastCheckStrike: 2,
    });
  });

  it("throws when flag values are missing", () => {
    expect(() => parseHookArgv(["--paths"])).toThrow(/Missing value/);
  });
});
