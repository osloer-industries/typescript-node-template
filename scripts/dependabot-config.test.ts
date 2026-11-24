import { readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertGithubActionsCooldownSupported,
  GITHUB_ACTIONS_COOLDOWN_UNSUPPORTED_KEYS,
  readRepoDependabotConfig,
  unsupportedGithubActionsCooldownKeys,
} from "./dependabot-config.js";

describe("dependabot.yml github-actions cooldown contract", () => {
  it("rejects semver-* cooldown keys on github-actions entries", () => {
    const config = readRepoDependabotConfig();
    expect(() => assertGithubActionsCooldownSupported(config)).not.toThrow();
    for (const key of GITHUB_ACTIONS_COOLDOWN_UNSUPPORTED_KEYS) {
      expect(unsupportedGithubActionsCooldownKeys(`    cooldown:\n      ${key}: 7\n`)).toContain(
        key,
      );
    }
  });

  it("fails when unsupported semver cooldown keys appear on github-actions", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "dependabot-contract-"));
    const configPath = join(tempDir, "dependabot.yml");
    try {
      const invalid = `version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    cooldown:
      default-days: 7
      semver-patch-days: 3
`;
      writeFileSync(configPath, invalid);
      const raw = readFileSync(configPath, "utf8");
      expect(() => assertGithubActionsCooldownSupported(raw)).toThrow(/semver-patch-days/u);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});