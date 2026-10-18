import { describe, expect, it } from "vitest";
import { npmExecutablePath } from "./run-npm.mjs";

describe("npmExecutablePath", () => {
  it("returns a concrete npm path without PATH lookup", () => {
    const resolved = npmExecutablePath();
    expect(resolved).not.toBe("npm");
    expect(resolved.includes("npm")).toBe(true);
  });

  it("prefers npm_execpath when npm launched the process", () => {
    if (typeof process.env.npm_execpath !== "string" || process.env.npm_execpath.length === 0) return;
    expect(npmExecutablePath()).toBe(process.env.npm_execpath);
  });
});
