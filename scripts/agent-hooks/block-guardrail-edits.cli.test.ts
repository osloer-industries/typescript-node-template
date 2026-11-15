import { afterEach, describe, expect, it, vi } from "vitest";
import { HOOK_EXIT_BLOCK, HOOK_EXIT_OK } from "./hook-contract.js";
import { runBlockGuardrailEditsCli } from "./block-guardrail-edits.js";

describe("runBlockGuardrailEditsCli", () => {
  const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

  afterEach(() => {
    if (ttyDescriptor) {
      Object.defineProperty(process.stdin, "isTTY", ttyDescriptor);
    }
  });

  it("returns ok when no paths are supplied", async () => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
    const code = await runBlockGuardrailEditsCli([]);
    expect(code).toBe(HOOK_EXIT_OK);
  });

  it("writes ok output for safe paths", async () => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
    let output = "";
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });
    const code = await runBlockGuardrailEditsCli(["--paths", "src/index.ts"]);
    stdout.mockRestore();
    expect(code).toBe(HOOK_EXIT_OK);
    expect(output).toMatch(/No guardrail path edits/);
  });

  it("writes block output for guardrail paths", async () => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
    let output = "";
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });
    const code = await runBlockGuardrailEditsCli(["--paths", "AGENTS.md"]);
    stderr.mockRestore();
    expect(code).toBe(HOOK_EXIT_BLOCK);
    expect(output).toMatch(/Blocked agent edit/);
  });
});
