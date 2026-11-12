import { test as fcVitestTest } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";

describe("@fast-check/vitest bridge", () => {
  it("exposes the Vitest property-test entrypoint for MCP and future property gates", () => {
    expect(typeof fcVitestTest).toBe("function");
    expect(typeof fcVitestTest.prop).toBe("function");
  });
});
