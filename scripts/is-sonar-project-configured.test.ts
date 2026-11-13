import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  runSonarConfiguredCli,
  sonarProjectConfigured,
} from "./is-sonar-project-configured.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function copySonarConfiguredScript(tempDir: string): string {
  const scriptsDir = join(tempDir, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  cpSync(join(repoRoot, "scripts/is-sonar-project-configured.ts"), join(scriptsDir, "is-sonar-project-configured.ts"));
  return new URL(`file://${join(scriptsDir, "is-sonar-project-configured.ts")}`).href;
}

describe("sonarProjectConfigured", () => {
  it("returns false when template placeholders remain", () => {
    expect(
      sonarProjectConfigured(`sonar.organization=YOUR_SONAR_ORGANIZATION\nsonar.projectKey=YOUR_SONAR_PROJECT_KEY\n`),
    ).toBe(false);
  });

  it("returns true when organization and project key are set", () => {
    expect(
      sonarProjectConfigured(`sonar.organization=osloer-industries\nsonar.projectKey=my_project\n`),
    ).toBe(true);
  });
});

describe("runSonarConfiguredCli", () => {
  it("writes configured=false to GITHUB_OUTPUT when placeholders remain", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sonar-configured-"));
    try {
      writeFileSync(
        join(tempDir, "sonar-project.properties"),
        "sonar.organization=YOUR_SONAR_ORGANIZATION\n",
        "utf8",
      );
      const outputPath = join(tempDir, "github-output.txt");
      const previousOutput = process.env.GITHUB_OUTPUT;
      process.env.GITHUB_OUTPUT = outputPath;
      const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      try {
        runSonarConfiguredCli(copySonarConfiguredScript(tempDir));
      } finally {
        stdout.mockRestore();
        if (previousOutput === undefined) {
          delete process.env.GITHUB_OUTPUT;
        } else {
          process.env.GITHUB_OUTPUT = previousOutput;
        }
      }
      expect(readFileSync(outputPath, "utf8")).toContain("configured=false");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes configured=true when project metadata is set", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sonar-configured-ok-"));
    try {
      writeFileSync(join(tempDir, "sonar-project.properties"), "sonar.organization=osloer\n", "utf8");
      let output = "";
      const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        output += String(chunk);
        return true;
      });
      runSonarConfiguredCli(copySonarConfiguredScript(tempDir));
      stdout.mockRestore();
      expect(output).toMatch(/metadata is configured/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
