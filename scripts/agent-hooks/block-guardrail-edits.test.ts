import { describe, expect, it } from "vitest";
import { HOOK_EXIT_BLOCK, HOOK_EXIT_OK } from "./hook-contract.js";
import { evaluateBlockGuardrailEdits } from "./block-guardrail-edits.js";

describe("evaluateBlockGuardrailEdits", () => {
  it("allows non-guardrail paths", () => {
    const result = evaluateBlockGuardrailEdits(["src/index.ts", "README.md"]);
    expect(result.exitCode).toBe(HOOK_EXIT_OK);
  });

  it("blocks guardrail paths", () => {
    const result = evaluateBlockGuardrailEdits(["src/index.ts", "AGENTS.md", ".github/workflows/ci.yml"]);
    expect(result.exitCode).toBe(HOOK_EXIT_BLOCK);
    expect(result.message).toMatch(/AGENTS\.md/);
    expect(result.message).toMatch(/\.github\/workflows\/ci\.yml/);
  });
});
