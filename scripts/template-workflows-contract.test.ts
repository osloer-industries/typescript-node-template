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

const AUTO_MERGE_REUSABLE_PIN =
  "osloer-industries/.github/.github/workflows/auto-merge.yml@962e9cfd1567c7ea3b31ff704a17961d0a6afc17 # v0.1.9";

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

  it("pins org auto-merge reusable at v0.1.9 with squash and release/Dependabot flags", () => {
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