import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertProviderWiring,
  BLOCK_GUARDRAIL_SCRIPT,
  PRE_STOP_SCRIPT,
  PROVIDER_WIRING_RELATIVE_PATHS,
  repoRootFromAgentHooksModule,
} from "./provider-wiring.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("provider wiring files", () => {
  it("lists Claude, Cursor, and Codex wiring paths", () => {
    expect(PROVIDER_WIRING_RELATIVE_PATHS).toEqual([
      ".claude/settings.json",
      ".cursor/hooks.json",
      ".codex/hooks.json",
    ]);
  });

  it("parses each wiring file and references both guard scripts", () => {
    const reports = assertProviderWiring(repoRoot);
    expect(reports).toHaveLength(3);
    for (const report of reports) {
      const joined = report.commands.join(" ");
      expect(joined).toContain(BLOCK_GUARDRAIL_SCRIPT);
      expect(joined).toContain(PRE_STOP_SCRIPT);
    }
  });

  it("resolves the repository root from the agent-hooks module URL", () => {
    expect(repoRootFromAgentHooksModule(import.meta.url)).toBe(repoRoot);
  });
});
