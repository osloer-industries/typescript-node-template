import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FLEET_ADOPTION_DOC_PATH,
  evaluateFleetAdoptionDocSync,
  isWorkflowHarnessChange,
  listChangedPaths,
  runFleetAdoptionDocCheckCli,
} from "./check-fleet-adoption-doc.js";
import {
  gitCommitPaths,
  gitExecutableForTests,
  initGitRepo,
} from "./test-git-fixture.js";

const gitExecutable = gitExecutableForTests("FLEET_ADOPTION_GIT_PATH");
const ciWorkflowPath = ".github/workflows/ci.yml";
const fleetAdoptionCheckSource = "./check-fleet-adoption-doc.ts";
const gitListChangedSource = "./git-list-changed-paths.ts";
const fleetAdoptionCheckBasename = "scripts/check-fleet-adoption-doc.ts";

function copyFleetAdoptionHarnessInto(tempDir: string): void {
  cpSync(
    resolve(fileURLToPath(new URL(fleetAdoptionCheckSource, import.meta.url))),
    join(tempDir, fleetAdoptionCheckBasename),
  );
  cpSync(
    resolve(fileURLToPath(new URL(gitListChangedSource, import.meta.url))),
    join(tempDir, "scripts/git-list-changed-paths.ts"),
  );
}

describe("isWorkflowHarnessChange", () => {
  it("matches workflow and composite action paths", () => {
    expect(isWorkflowHarnessChange(ciWorkflowPath)).toBe(true);
    expect(isWorkflowHarnessChange(".github/actions/foo/action.yml")).toBe(true);
    expect(isWorkflowHarnessChange("docs/fleet-adoption.md")).toBe(false);
    expect(isWorkflowHarnessChange("src/index.ts")).toBe(false);
  });
});

describe("evaluateFleetAdoptionDocSync", () => {
  it("allows changes that do not touch workflows", () => {
    const result = evaluateFleetAdoptionDocSync(["src/index.ts", "README.md"]);
    expect(result.ok).toBe(true);
    expect(result.workflowChanges).toEqual([]);
  });

  it("requires fleet adoption doc when workflows change", () => {
    const result = evaluateFleetAdoptionDocSync([ciWorkflowPath]);
    expect(result.ok).toBe(false);
    expect(result.workflowChanges).toEqual([ciWorkflowPath]);
  });

  it("passes when workflow and fleet doc change together", () => {
    const result = evaluateFleetAdoptionDocSync([
      ".github/workflows/release.yml",
      FLEET_ADOPTION_DOC_PATH,
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("runFleetAdoptionDocCheckCli", () => {
  it("throws when the base ref is missing", () => {
    expect(() => runFleetAdoptionDocCheckCli(import.meta.url, [])).toThrow(/Missing base ref/);
  });

  it("exits non-zero when workflow changes omit fleet doc", { timeout: 30_000 }, () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fleet-doc-git-"));
    try {
      initGitRepo(tempDir, gitExecutable);
      writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
      const base = gitCommitPaths(tempDir, "base", ["README.md"], gitExecutable);
      mkdirSync(join(tempDir, ".github/workflows"), { recursive: true });
      writeFileSync(join(tempDir, ciWorkflowPath), "name: CI\n", "utf8");
      const head = gitCommitPaths(tempDir, "workflow", [ciWorkflowPath], gitExecutable);
      copyFleetAdoptionHarnessInto(tempDir);
      const moduleUrl = new URL(`file://${join(tempDir, fleetAdoptionCheckBasename)}`).href;
      const code = runFleetAdoptionDocCheckCli(moduleUrl, [base, head]);
      expect(code).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("exits zero when fleet doc updates with workflow edits", { timeout: 30_000 }, () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fleet-doc-ok-"));
    try {
      initGitRepo(tempDir, gitExecutable);
      writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
      const base = gitCommitPaths(tempDir, "base", ["README.md"], gitExecutable);
      mkdirSync(join(tempDir, ".github/workflows"), { recursive: true });
      mkdirSync(join(tempDir, "docs"), { recursive: true });
      writeFileSync(join(tempDir, ciWorkflowPath), "name: CI\n", "utf8");
      writeFileSync(join(tempDir, FLEET_ADOPTION_DOC_PATH), "# Fleet\n", "utf8");
      const head = gitCommitPaths(
        tempDir,
        "fleet",
        [ciWorkflowPath, FLEET_ADOPTION_DOC_PATH],
        gitExecutable,
      );
      copyFleetAdoptionHarnessInto(tempDir);
      const moduleUrl = new URL(`file://${join(tempDir, fleetAdoptionCheckBasename)}`).href;
      const code = runFleetAdoptionDocCheckCli(moduleUrl, [base, head]);
      expect(code).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("listChangedPaths", () => {
  it("lists files changed between two refs", { timeout: 30_000 }, () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fleet-list-"));
    try {
      initGitRepo(tempDir, gitExecutable);
      writeFileSync(join(tempDir, "README.md"), "# base\n", "utf8");
      const base = gitCommitPaths(tempDir, "base", ["README.md"], gitExecutable);
      mkdirSync(join(tempDir, "docs"), { recursive: true });
      writeFileSync(join(tempDir, FLEET_ADOPTION_DOC_PATH), "# Fleet\n", "utf8");
      const head = gitCommitPaths(tempDir, "doc", [FLEET_ADOPTION_DOC_PATH], gitExecutable);
      const changed = listChangedPaths(base, head, tempDir);
      expect(changed).toContain(FLEET_ADOPTION_DOC_PATH);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});