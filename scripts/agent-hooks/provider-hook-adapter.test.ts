import { describe, expect, it } from "vitest";
import {
  adaptProviderHookPayload,
  extractProviderEditPaths,
  resolveWorkspaceRoot,
  toRepoRelativePath,
} from "./provider-hook-adapter.js";

const workspace = "/agent/repos/typescript-node-template";

describe("toRepoRelativePath", () => {
  it("strips the workspace root from absolute paths", () => {
    expect(toRepoRelativePath(workspace, `${workspace}/AGENTS.md`)).toBe("AGENTS.md");
  });
});

describe("extractProviderEditPaths", () => {
  it("reads Claude PreToolUse tool_input.file_path", () => {
    const paths = extractProviderEditPaths(
      {
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: { file_path: `${workspace}/src/index.ts` },
      },
      workspace,
    );
    expect(paths).toEqual(["src/index.ts"]);
  });
});

describe("adaptProviderHookPayload", () => {
  it("derives fastCheckStrike from stop_hook_active", () => {
    const input = adaptProviderHookPayload(
      { hook_event_name: "Stop", stop_hook_active: true },
      { workspaceRoot: workspace, forStop: true },
    );
    expect(input.fastCheckStrike).toBe(1);
  });

  it("derives paths and strike for Cursor payloads", () => {
    const input = adaptProviderHookPayload(
      {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: { file_path: `${workspace}/AGENTS.md` },
        workspace_roots: [workspace],
      },
      { workspaceRoot: workspace, forStop: false },
    );
    expect(input.paths).toContain("AGENTS.md");
  });

  it("prefers explicit neutral paths", () => {
    const input = adaptProviderHookPayload(
      { paths: ["README.md"], tool_input: { file_path: `${workspace}/AGENTS.md` } },
      { workspaceRoot: workspace, forStop: false },
    );
    expect(input.paths).toEqual(["README.md"]);
  });
});

describe("resolveWorkspaceRoot", () => {
  it("uses workspace_roots when present", () => {
    expect(resolveWorkspaceRoot({ workspace_roots: [workspace] }, "/tmp")).toBe(workspace);
  });
});
