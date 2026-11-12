import { describe, expect, it } from "vitest";
import { HOOK_EXIT_BLOCK, HOOK_EXIT_OK, HOOK_EXIT_WARN } from "./hook-contract.js";
import { evaluatePreStopFastCheck } from "./pre-stop-fast-check.js";

describe("evaluatePreStopFastCheck", () => {
  it("returns ok when check:fast succeeds", () => {
    const result = evaluatePreStopFastCheck(
      0,
      () => {
        /* success */
      },
      "/tmp",
    );
    expect(result.exitCode).toBe(HOOK_EXIT_OK);
  });

  it("warns on first failure (strike 0)", () => {
    const result = evaluatePreStopFastCheck(
      0,
      () => {
        throw new Error("lint failed");
      },
      "/tmp",
    );
    expect(result.exitCode).toBe(HOOK_EXIT_WARN);
    expect(result.message).toMatch(/strike 1/);
  });

  it("blocks on second failure (strike 1+)", () => {
    const result = evaluatePreStopFastCheck(
      1,
      () => {
        throw new Error("lint failed");
      },
      "/tmp",
    );
    expect(result.exitCode).toBe(HOOK_EXIT_BLOCK);
    expect(result.message).toMatch(/strike 2/);
  });
});
