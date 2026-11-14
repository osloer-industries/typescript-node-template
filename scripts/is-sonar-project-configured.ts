import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SONAR_PLACEHOLDER_MARKERS = [
  "YOUR_SONAR_ORGANIZATION",
  "YOUR_SONAR_PROJECT_KEY",
] as const;

export function sonarProjectConfigured(propertiesText: string): boolean {
  return !SONAR_PLACEHOLDER_MARKERS.some((marker) => propertiesText.includes(marker));
}

export function runSonarConfiguredCli(moduleUrl: string): void {
  const repoRoot = resolve(dirname(fileURLToPath(moduleUrl)), "..");
  const propertiesText = readFileSync(join(repoRoot, "sonar-project.properties"), "utf8");
  const configured = sonarProjectConfigured(propertiesText);
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (typeof githubOutput === "string" && githubOutput.length > 0) {
    appendFileSync(githubOutput, `configured=${configured ? "true" : "false"}\n`);
  }
  if (configured) {
    process.stdout.write("Sonar project metadata is configured.\n");
    return;
  }
  process.stdout.write(
    "Sonar project metadata still uses template placeholders; Actions scanner steps will skip.\n",
  );
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  runSonarConfiguredCli(import.meta.url);
}
