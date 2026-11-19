import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SKILLS_INDEX_BEGIN, SKILLS_INDEX_END, runAgentsIndexCli } from "./agents-check.js";
import { runAgentsIndexWrapper } from "./agents-index.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const wrapperArgs = ["scripts/agents-index.ts"];
const directArgs = ["scripts/agents-check.ts", "index"];

describe("agents-index entry", () => {
  it("exposes SKILLS_INDEX markers via agents-check exports", () => {
    const agentsMd = readFileSync(join(repoRoot, "AGENTS.md"), "utf8");
    expect(agentsMd).toContain(SKILLS_INDEX_BEGIN);
    expect(agentsMd).toContain(SKILLS_INDEX_END);
  });

  it("runs through agents-index.ts wrapper and agents-check index subcommand", () => {
    const wrapper = execFileSync(process.execPath, wrapperArgs, { cwd: repoRoot, encoding: "utf8" });
    const direct = execFileSync(process.execPath, directArgs, { cwd: repoRoot, encoding: "utf8" });
    expect(wrapper).toMatch(/Skills index/);
    expect(direct).toMatch(/Skills index/);
    expect(runAgentsIndexCli(new URL("./agents-check.ts", import.meta.url).href)).toBe(0);
    expect(runAgentsIndexWrapper(new URL("./agents-index.ts", import.meta.url).href)).toBe(0);
  });
});