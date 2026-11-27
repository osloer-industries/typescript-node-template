import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertGithubActionsCooldownSupported, readRepoDependabotConfig } from "./dependabot-config.js";

/** Thin caller workflows every repo scaffolded from the template should ship. */
const TEMPLATE_CALLER_WORKFLOWS = [
  ".github/workflows/ci.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/pr-title.yml",
  ".github/workflows/release.yml",
  ".github/workflows/auto-merge.yml",
] as const;

const ORG_REUSABLES_SHA = "d8f690b3ee555b72426099f4755e0da2f74d745f";
const ORG_REUSABLES_TAG = "v0.1.11";

const AUTO_MERGE_REUSABLE_PIN =
  `osloer-industries/.github/.github/workflows/auto-merge.yml@${ORG_REUSABLES_SHA} # ${ORG_REUSABLES_TAG}`;

describe("template harness contracts", () => {
  it("keeps github-actions Dependabot cooldown to supported keys only", () => {
    expect(() => assertGithubActionsCooldownSupported(readRepoDependabotConfig())).not.toThrow();
  });
});

describe("template GitHub workflow callers", () => {
  it("includes the standard thin caller workflows", () => {
    expect.assertions(TEMPLATE_CALLER_WORKFLOWS.length);
    for (const relativePath of TEMPLATE_CALLER_WORKFLOWS) {
      expect(() => readFileSync(new URL(`../${relativePath}`, import.meta.url))).not.toThrow();
    }
  });

  it("pins every org reusable caller at the same release tag", () => {
    const pins: Array<{ path: string; sha: string; tag: string }> = [];
    for (const relativePath of TEMPLATE_CALLER_WORKFLOWS) {
      const yaml = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
      for (const match of yaml.matchAll(
        /osloer-industries\/\.github\/\.github\/workflows\/[^\s@]+@([0-9a-f]{40})\s*#\s*(\S+)/gu,
      )) {
        pins.push({ path: relativePath, sha: match[1] ?? "", tag: match[2] ?? "" });
      }
    }
    expect(pins.length).toBeGreaterThan(0);
    for (const pin of pins) {
      expect(pin.sha).toBe(ORG_REUSABLES_SHA);
      expect(pin.tag).toBe(ORG_REUSABLES_TAG);
    }
  });

  it("pins org auto-merge reusable with squash and release/Dependabot flags", () => {
    const autoMergeYaml = readFileSync(
      new URL("../.github/workflows/auto-merge.yml", import.meta.url),
      "utf8",
    );
    expect(autoMergeYaml).toContain(AUTO_MERGE_REUSABLE_PIN);
    expect(autoMergeYaml).toMatch(/merge-method:\s*squash/u);
    expect(autoMergeYaml).toMatch(/allow-dependabot:\s*true/u);
    expect(autoMergeYaml).toMatch(/allow-release-prs:\s*true/u);
    expect(autoMergeYaml).toMatch(/RELEASE_APP_PRIVATE_KEY/u);
    expect(autoMergeYaml).toMatch(/OSLOER_RELEASE_APP_ID/u);
  });
});