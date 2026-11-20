import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  collectGuidanceFindings,
  collectSkillFindings,
  extractSkillsIndexInner,
  formatSkillFinding,
  isValidSkillName,
  listSkillRecords,
  parseSkillFrontmatter,
  renderSkillsIndexInner,
  replaceSkillsIndexInner,
  runAgentsIndexCli,
  validateSkillFrontmatter,
  writeSkillsIndex,
} from "./agents-check.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const nodeArgs = ["scripts/agents-check.ts", "index"];
const verifyChangeSkill = "verify-change";
const skillsIndexBegin = "<!-- agents:skills:begin -->";
const skillsIndexEnd = "<!-- agents:skills:end -->";
const skillsTableHeader = "| Skill | Description | Path |";
const skillsTableSeparator = "| --- | --- | --- |";
const emptyScriptsPackageJson = '{"scripts":{}}';
const modulePackageJson = '{"type":"module","scripts":{}}';
const fileUtf8 = "utf8";
const fixturePackageJsonRelative = "package.json";

function agentsMdWithSkillsIndex(inner: string): string {
  return ["# A", skillsIndexBegin, inner, skillsIndexEnd].join("\n");
}

function copyHarnessScripts(targetRoot: string): void {
  const scriptsDir = join(targetRoot, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  for (const fileName of ["agents-check.ts", "agents-check-patterns.mjs"]) {
    cpSync(join(repoRoot, "scripts", fileName), join(scriptsDir, fileName));
  }
}

describe("skill frontmatter validation", () => {
  it("accepts a valid skill name", () => {
    expect(isValidSkillName(verifyChangeSkill, verifyChangeSkill)).toBe(true);
    expect(isValidSkillName("Bad-Name", "Bad-Name")).toBe(false);
    expect(isValidSkillName("bad--name", "bad--name")).toBe(false);
  });

  it("parses name and description from SKILL.md frontmatter", () => {
    const text = ["---", "name: demo", "description: Does demo things.", "---", "", "# Demo", ""].join("\n");
    const parsed = parseSkillFrontmatter(text);
    expect(parsed.name).toBe("demo");
    expect(parsed.description).toBe("Does demo things.");
  });

  it("parses CRLF frontmatter and validates missing name", () => {
    const text = "---\r\nname: demo\r\ndescription: ok\r\n---\r\n";
    expect(parseSkillFrontmatter(text).name).toBe("demo");
    const missingName = validateSkillFrontmatter(".agents/skills/x/SKILL.md", "x", "no frontmatter\n");
    expect(missingName[0]?.issue).toContain("missing name");
  });

  it("rejects descriptions longer than 1024 characters", () => {
    const long = "x".repeat(1025);
    const findings = validateSkillFrontmatter(
      ".agents/skills/long/SKILL.md",
      "long",
      `---\nname: long\ndescription: ${long}\n---\n`,
    );
    expect(findings.some((entry) => entry.issue.includes("exceeds 1024"))).toBe(true);
  });
});

describe("collectSkillFindings", () => {
  it("returns no findings for the template skills tree", () => {
    expect(collectSkillFindings(repoRoot)).toEqual([]);
  });

  it("reports a bad skill name", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-skill-bad-name-"));
    try {
      const skillDir = join(tempDir, ".agents/skills/wrong-name");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        "---\nname: not-dir\ndescription: x\n---\n",
        fileUtf8,
      );
      writeFileSync(
        join(tempDir, "AGENTS.md"),
        agentsMdWithSkillsIndex(renderSkillsIndexInner([])),
        fileUtf8,
      );
      const findings = collectSkillFindings(tempDir);
      expect(findings.some((entry) => entry.issue.includes("must match directory"))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports an empty description", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-skill-empty-desc-"));
    try {
      const skillDir = join(tempDir, ".agents/skills/empty-desc");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "---\nname: empty-desc\ndescription:\n---\n", fileUtf8);
      writeFileSync(join(tempDir, "AGENTS.md"), "# A\n", fileUtf8);
      const findings = collectSkillFindings(tempDir);
      expect(findings.some((entry) => entry.issue.includes("description must be non-empty"))).toBe(
        true,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports missing index markers when skills exist", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-skill-no-markers-"));
    try {
      cpSync(join(repoRoot, ".agents"), join(tempDir, ".agents"), { recursive: true });
      writeFileSync(join(tempDir, "AGENTS.md"), "# no markers\n", fileUtf8);
      const findings = collectSkillFindings(tempDir);
      expect(findings.some((entry) => entry.issue.includes("missing skills index markers"))).toBe(
        true,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports a stale skills index", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-skill-stale-index-"));
    try {
      cpSync(join(repoRoot, ".agents"), join(tempDir, ".agents"), { recursive: true });
      writeFileSync(
        join(tempDir, "AGENTS.md"),
        agentsMdWithSkillsIndex([skillsTableHeader, skillsTableSeparator].join("\n")),
        fileUtf8,
      );
      const findings = collectSkillFindings(tempDir);
      expect(findings.some((entry) => entry.issue.includes("stale skills index"))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports broken paths cited inside a skill", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-skill-broken-path-"));
    try {
      const skillDir = join(tempDir, ".agents/skills/broken-cite");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        "---\nname: broken-cite\ndescription: Broken cite demo.\n---\n\nSee `nowhere/missing.ts`.\n",
        fileUtf8,
      );
      writeFileSync(join(tempDir, fixturePackageJsonRelative), emptyScriptsPackageJson, fileUtf8);
      writeFileSync(join(tempDir, "AGENTS.md"), "# A\n", fileUtf8);
      const findings = collectGuidanceFindings(tempDir);
      expect(findings.some((entry) => entry.token === "nowhere/missing.ts")).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports when AGENTS.md is missing for skills validation", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-skill-no-agents-"));
    try {
      const skillDir = join(tempDir, ".agents/skills/lonely");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        "---\nname: lonely\ndescription: Solo skill.\n---\n",
        fileUtf8,
      );
      const findings = collectSkillFindings(tempDir);
      expect(findings.some((entry) => entry.issue.includes("missing AGENTS.md for skills index"))).toBe(
        true,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports a skill directory without SKILL.md", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-skill-no-skillmd-"));
    try {
      mkdirSync(join(tempDir, ".agents/skills/empty-dir"), { recursive: true });
      writeFileSync(
        join(tempDir, "AGENTS.md"),
        agentsMdWithSkillsIndex(renderSkillsIndexInner([])),
        fileUtf8,
      );
      const findings = collectSkillFindings(tempDir);
      expect(findings.some((entry) => entry.issue.includes("missing SKILL.md"))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports executable files under a skill directory", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-skill-exec-"));
    try {
      const skillDir = join(tempDir, ".agents/skills/with-bin");
      mkdirSync(skillDir, { recursive: true });
      const skillMd = join(skillDir, "SKILL.md");
      writeFileSync(
        skillMd,
        "---\nname: with-bin\ndescription: Demo skill.\n---\n",
        fileUtf8,
      );
      const scriptPath = join(skillDir, "run.sh");
      writeFileSync(scriptPath, "#!/bin/sh\n", fileUtf8);
      chmodSync(scriptPath, 0o755);
      writeFileSync(
        join(tempDir, "AGENTS.md"),
        agentsMdWithSkillsIndex(
          renderSkillsIndexInner([
            { name: "with-bin", description: "Demo skill.", skillPath: ".agents/skills/with-bin/SKILL.md" },
          ]),
        ),
        fileUtf8,
      );
      const findings = collectSkillFindings(tempDir);
      expect(
        findings.some((entry) => entry.issue.includes("executable file not allowed")),
      ).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("skills gate canaries", () => {
  it("treats valid skills as a failed canary when expecting violations", () => {
    const findings = collectSkillFindings(repoRoot);
    expect(findings).toEqual([]);
    let harnessError = "";
    try {
      expect(findings, "canary harness must fail when skills are valid").not.toEqual([]);
    } catch (error) {
      harnessError = String(error);
    }
    expect(harnessError).toContain("canary harness must fail");
  });

  it("formats skill findings", () => {
    const line = formatSkillFinding({
      file: "AGENTS.md",
      line: 1,
      issue: "stale skills index; run npm run agents:index",
    });
    expect(line).toContain("stale skills index");
  });
});

describe("skills index helpers", () => {
  it("throws when replacing a block without markers", () => {
    expect(() => replaceSkillsIndexInner("# agents\n", "| x |")).toThrow(/Missing skills index/);
    expect(extractSkillsIndexInner("# agents\n")).toBeNull();
  });

  it("lists only skills with complete frontmatter", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-skill-list-records-"));
    try {
      const goodDir = join(tempDir, ".agents/skills/good");
      const badDir = join(tempDir, ".agents/skills/incomplete");
      mkdirSync(goodDir, { recursive: true });
      mkdirSync(badDir, { recursive: true });
      writeFileSync(
        join(goodDir, "SKILL.md"),
        "---\nname: good\ndescription: Complete.\n---\n",
        fileUtf8,
      );
      writeFileSync(join(badDir, "SKILL.md"), "---\ndescription: No name.\n---\n", fileUtf8);
      const records = listSkillRecords(tempDir);
      expect(records.map((entry) => entry.name)).toEqual(["good"]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writeSkillsIndex reports changed and unchanged", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-skill-write-index-"));
    try {
      const skillDir = join(tempDir, ".agents/skills/indexed");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        "---\nname: indexed\ndescription: Indexed skill.\n---\n",
        fileUtf8,
      );
      writeFileSync(
        join(tempDir, "AGENTS.md"),
        agentsMdWithSkillsIndex(
          [skillsTableHeader, skillsTableSeparator, "| stale | x | `y` |"].join("\n"),
        ),
        fileUtf8,
      );
      const first = writeSkillsIndex(tempDir);
      expect(first.changed).toBe(true);
      const second = writeSkillsIndex(tempDir);
      expect(second.changed).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("runAgentsIndexCli updates skills index in an isolated tree", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-skill-run-index-"));
    let stdout = "";
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });
    try {
      cpSync(join(repoRoot, ".agents"), join(tempDir, ".agents"), { recursive: true });
      writeFileSync(
        join(tempDir, "AGENTS.md"),
        agentsMdWithSkillsIndex([skillsTableHeader, skillsTableSeparator].join("\n")),
        fileUtf8,
      );
      writeFileSync(join(tempDir, fixturePackageJsonRelative), modulePackageJson, fileUtf8);
      copyHarnessScripts(tempDir);
      const moduleUrl = pathToFileURL(join(tempDir, "scripts/agents-check.ts")).href;
      const code = runAgentsIndexCli(moduleUrl);
      expect(code).toBe(0);
      expect(stdout).toMatch(/Updated skills index/);
      expect(collectSkillFindings(tempDir)).toEqual([]);
      stdout = "";
      const again = runAgentsIndexCli(moduleUrl);
      expect(again).toBe(0);
      expect(stdout).toMatch(/already up to date/);
    } finally {
      stdoutSpy.mockRestore();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("agents:index CLI", () => {
  it("is idempotent on the template repository", () => {
    const agentsPath = join(repoRoot, "AGENTS.md");
    const before = readFileSync(agentsPath, fileUtf8);
    const first = execFileSync(process.execPath, nodeArgs, { cwd: repoRoot, encoding: fileUtf8 });
    const mid = readFileSync(agentsPath, fileUtf8);
    const second = execFileSync(process.execPath, nodeArgs, { cwd: repoRoot, encoding: fileUtf8 });
    const after = readFileSync(agentsPath, fileUtf8);
    expect(first).toMatch(/up to date|Updated skills index/);
    expect(second).toMatch(/up to date/);
    expect(mid).toBe(after);
    expect(before).toBe(after);
  });

  it("repairs a stale index in an isolated tree", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "agents-index-cli-"));
    try {
      cpSync(join(repoRoot, ".agents"), join(tempDir, ".agents"), { recursive: true });
      writeFileSync(
        join(tempDir, "AGENTS.md"),
        agentsMdWithSkillsIndex(
          [skillsTableHeader, skillsTableSeparator, "| stale | x | `y` |"].join("\n"),
        ),
        fileUtf8,
      );
      writeFileSync(join(tempDir, fixturePackageJsonRelative), emptyScriptsPackageJson, fileUtf8);
      copyHarnessScripts(tempDir);
      execFileSync(process.execPath, nodeArgs, { cwd: tempDir, encoding: fileUtf8 });
      const updated = readFileSync(join(tempDir, "AGENTS.md"), fileUtf8);
      expect(updated).toContain(verifyChangeSkill);
      expect(collectSkillFindings(tempDir)).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});