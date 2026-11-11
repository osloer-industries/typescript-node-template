import { afterEach, describe, expect, it, vi } from "vitest";
import { HOOK_EXIT_OK, HOOK_EXIT_WARN } from "./hook-contract.js";
import { runPreStopFastCheckCli } from "./pre-stop-fast-check.js";

describe("runPreStopFastCheckCli", () => {
  const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

  afterEach(() => {
    if (ttyDescriptor) {
      Object.defineProperty(process.stdin, "isTTY", ttyDescriptor);
    }
  });

  it("prints success when the runner passes", async () => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
    let output = "";
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });
    const code = await runPreStopFastCheckCli(
      ["--fast-check-strike", "0"],
      () => {
        /* ok */
      },
      "/tmp",
    );
    stdout.mockRestore();
    expect(code).toBe(HOOK_EXIT_OK);
    expect(output).toMatch(/check:fast passed/);
  });

  it("prints warn output when the runner fails", async () => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
    let output = "";
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });
    const error = Object.assign(new Error("failed"), { stdout: "out", stderr: "err" });
    const code = await runPreStopFastCheckCli(
      ["--fast-check-strike", "0"],
      () => {
        throw error;
      },
      "/tmp",
    );
    stderr.mockRestore();
    expect(code).toBe(HOOK_EXIT_WARN);
    expect(output).toMatch(/out/);
    expect(output).toMatch(/err/);
  });
});
