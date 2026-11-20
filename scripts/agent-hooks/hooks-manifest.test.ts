import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseHooksManifestJson,
  validateHooksManifestOnDisk,
} from "./hooks-manifest.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("parseHooksManifestJson", () => {
  it("rejects unknown fields and missing keys", () => {
    expect(() => parseHooksManifestJson(`{"preEdit":"scripts/agent-hooks/a.ts"}`)).toThrow(
      /missing required field "stop"/,
    );
    expect(() =>
      parseHooksManifestJson(
        `{"preEdit":"scripts/agent-hooks/block-guardrail-edits.ts","stop":"scripts/agent-hooks/pre-stop-fast-check.ts","extra":true}`,
      ),
    ).toThrow(/unknown field "extra"/);
  });

  it("requires scripts under scripts/agent-hooks/", () => {
    expect(() =>
      parseHooksManifestJson(
        `{"preEdit":"src/evil.ts","stop":"scripts/agent-hooks/pre-stop-fast-check.ts"}`,
      ),
    ).toThrow(/must point under scripts\/agent-hooks/);
  });
});

describe("committed hooks.json", () => {
  it("maps neutral events to existing guard scripts", () => {
    const path = join(repoRoot, "scripts/agent-hooks/hooks.json");
    const manifest = parseHooksManifestJson(readFileSync(path, "utf8"));
    expect(manifest).toEqual({
      preEdit: "scripts/agent-hooks/block-guardrail-edits.ts",
      stop: "scripts/agent-hooks/pre-stop-fast-check.ts",
    });
    validateHooksManifestOnDisk(repoRoot, manifest);
  });
});