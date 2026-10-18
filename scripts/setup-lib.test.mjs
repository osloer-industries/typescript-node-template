import { describe, expect, it } from "vitest";
import { assertNodeEngine, packageName, parseArgs, shouldVerifyAfterSetup } from "./setup-lib.mjs";

describe("parseArgs", () => {
  it("parses flags and paired options", () => {
    expect(parseArgs(["--yes", "--scenario", "cli", "--name", "@acme/tool"])).toEqual({
      yes: true,
      scenario: "cli",
      name: "@acme/tool",
    });
  });

  it("parses verify flags", () => {
    expect(parseArgs(["--verify", "--no-verify"])).toEqual({ verify: true, noVerify: true });
  });

  it("rejects missing option values", () => {
    expect(() => parseArgs(["--name"])).toThrow("Missing value for --name");
  });
});

describe("packageName", () => {
  it("accepts scoped and unscoped names", () => {
    expect(packageName("example")).toBe("example");
    expect(packageName("@acme/example-cli")).toBe("@acme/example-cli");
  });

  it("rejects invalid names", () => {
    expect(() => packageName("Not Valid")).toThrow("Invalid npm package name");
  });
});

describe("shouldVerifyAfterSetup", () => {
  it("runs after unattended setup", () => {
    expect(shouldVerifyAfterSetup({ yes: true })).toBe(true);
  });

  it("honors explicit verify and no-verify", () => {
    expect(shouldVerifyAfterSetup({ verify: true })).toBe(true);
    expect(shouldVerifyAfterSetup({ yes: true, noVerify: true })).toBe(false);
  });
});

describe("assertNodeEngine", () => {
  it("allows Node 24 when engines require it", () => {
    expect(() => assertNodeEngine("24.22.0", ">=24 <25")).not.toThrow();
  });

  it("rejects the wrong major version", () => {
    expect(() => assertNodeEngine("22.14.0", ">=24 <25")).toThrow("Node.js 24+ is required");
  });

  it("rejects majors at or above the exclusive upper bound", () => {
    expect(() => assertNodeEngine("25.0.0", ">=24 <25")).toThrow("below 25");
  });

  it("ignores empty or unrecognized engine ranges", () => {
    expect(() => assertNodeEngine("20.0.0", undefined)).not.toThrow();
    expect(() => assertNodeEngine("20.0.0", "node")).not.toThrow();
  });
});
