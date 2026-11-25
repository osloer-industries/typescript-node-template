import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Cooldown keys GitHub documents for `package-ecosystem: github-actions` only. */
export const GITHUB_ACTIONS_COOLDOWN_UNSUPPORTED_KEYS = [
  "semver-major-days",
  "semver-minor-days",
  "semver-patch-days",
] as const;

const PACKAGE_ECOSYSTEM_LINE = /^\s*- package-ecosystem:\s*(\S+)/u;

export type DependabotUpdateEntry = {
  ecosystem: string;
  block: string;
};

function blockUsesCooldownKey(block: string, key: string): boolean {
  const prefix = `${key}:`;
  return block.split("\n").some((line) => line.trimStart().startsWith(prefix));
}

export function splitDependabotUpdateEntries(config: string): DependabotUpdateEntry[] {
  const lines = config.split("\n");
  const entries: DependabotUpdateEntry[] = [];
  let currentEcosystem = "";
  let currentLines: string[] = [];

  const flush = (): void => {
    if (currentEcosystem.length === 0) {
      return;
    }
    entries.push({ ecosystem: currentEcosystem, block: currentLines.join("\n") });
    currentEcosystem = "";
    currentLines = [];
  };

  for (const line of lines) {
    const ecosystemMatch = PACKAGE_ECOSYSTEM_LINE.exec(line);
    if (ecosystemMatch) {
      flush();
      currentEcosystem = ecosystemMatch[1] ?? "";
      currentLines = [line];
      continue;
    }
    if (currentEcosystem.length > 0) {
      currentLines.push(line);
    }
  }
  flush();
  return entries;
}

export function unsupportedGithubActionsCooldownKeys(block: string): string[] {
  return GITHUB_ACTIONS_COOLDOWN_UNSUPPORTED_KEYS.filter((key) => blockUsesCooldownKey(block, key));
}

export function assertGithubActionsCooldownSupported(config: string): void {
  const githubActionsEntries = splitDependabotUpdateEntries(config).filter(
    (entry) => entry.ecosystem === "github-actions",
  );
  if (githubActionsEntries.length === 0) {
    throw new Error("dependabot.yml must include a github-actions update entry.");
  }
  for (const entry of githubActionsEntries) {
    const unsupported = unsupportedGithubActionsCooldownKeys(entry.block);
    if (unsupported.length > 0) {
      throw new Error(
        `github-actions cooldown must not use ${unsupported.join(", ")} (Dependabot rejects them); use default-days only.`,
      );
    }
    if (!blockUsesCooldownKey(entry.block, "default-days")) {
      throw new Error("github-actions cooldown must set default-days.");
    }
  }
}

export function readRepoDependabotConfig(): string {
  const configPath = fileURLToPath(new URL("../.github/dependabot.yml", import.meta.url));
  return readFileSync(configPath, "utf8");
}