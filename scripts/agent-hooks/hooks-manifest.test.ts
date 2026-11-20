import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseHooksManifestJson,
  validateHooksManifestOnDisk,
} from "./hooks-manifest.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const stopScriptPath = "scripts/agent-hooks/pre-stop-fast-check.ts";
const blockScriptPath = "scripts/agent-hooks/block-guardrail-edits.ts";
const nonEmptyPathPattern = /must be a non-empty script path/;

describe("parseHooksManifestJson", () => {
  it("rejects unknown fields and missing keys", () => {
    expect(() => parseHooksManifestJson(`{"preEdit":"scripts/agent-hooks/a.ts"}`)).toThrow(
      /missing required field "stop"/,
    );
    expect(() =>
      parseHooksManifestJson(
        `{"preEdit":"${blockScriptPath}","stop":"${stopScriptPath}","extra":true}`,
      ),
    ).toThrow(/unknown field "extra"/);
  });

  it("requires scripts under scripts/agent-hooks/", () => {
    expect(() =>
      parseHooksManifestJson(`{"preEdit":"src/evil.ts","stop":"${stopScriptPath}"}`),
    ).toThrow(/must point under scripts\/agent-hooks/);
  });

  it("rejects non-string, empty, or non-.ts script paths", () => {
    expect(() =>
      parseHooksManifestJson(`{"preEdit":42,"stop":"${stopScriptPath}"}`),
    ).toThrow(nonEmptyPathPattern);
    expect(() => parseHooksManifestJson(`{"preEdit":"   ","stop":"${stopScriptPath}"}`)).toThrow(
      nonEmptyPathPattern,
    );
    expect(() =>
      parseHooksManifestJson(
        `{"preEdit":"${blockScriptPath}.mjs","stop":"${stopScriptPath}"}`,
      ),
    ).toThrow(/must reference a TypeScript script/);
  });

  it("rejects empty, malformed, or non-object JSON", () => {
    expect(() => parseHooksManifestJson("")).toThrow(/must not be empty/);
    expect(() => parseHooksManifestJson("{")).toThrow(/must be valid JSON/);
    expect(() => parseHooksManifestJson("null")).toThrow(/must be a JSON object/);
  });
});

describe("committed hooks.json", () => {
  it("maps neutral events to existing guard scripts", () => {
    const path = join(repoRoot, "scripts/agent-hooks/hooks.json");
    const manifest = parseHooksManifestJson(readFileSync(path, "utf8"));
    expect(manifest).toEqual({
      preEdit: blockScriptPath,
      stop: stopScriptPath,
    });
    validateHooksManifestOnDisk(repoRoot, manifest);
  });
});

describe("validateHooksManifestOnDisk", () => {
  it("rejects manifests that reference missing scripts", () => {
    expect(() =>
      validateHooksManifestOnDisk(repoRoot, {
        preEdit: "scripts/agent-hooks/does-not-exist.ts",
        stop: stopScriptPath,
      }),
    ).toThrow(/preEdit.*script not found/);
  });
});