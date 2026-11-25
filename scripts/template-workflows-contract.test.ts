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

const ORG_REUSABLE_PIN_SHA = "a6ee91211fd9ba096ec141bacdb67985a82b6767";
const ORG_REUSABLE_PIN_SUFFIX = `# v0.1.7`;

const AUTO_MERGE_REUSABLE_PIN =
  `osloer-industries/.github/.github/workflows/auto-merge.yml@${ORG_REUSABLE_PIN_SHA} ${ORG_REUSABLE_PIN_SUFFIX}`;

const CI_PASSED_REUSABLE_PIN =
  `osloer-industries/.github/.github/workflows/ci-passed.yml@${ORG_REUSABLE_PIN_SHA} ${ORG_REUSABLE_PIN_SUFFIX}`;

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

  it("pins org ci-passed reusable at v0.1.7 in CI", () => {
    const ciYaml = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
    expect(ciYaml).toContain(CI_PASSED_REUSABLE_PIN);
    expect(ciYaml).toContain("\n  ci-passed:\n");
    expect(ciYaml).toMatch(/needs-json:\s*\$\{\{\s*toJSON\(needs\)\s*\}\}/u);
  });

  it("pins org auto-merge reusable at v0.1.7 with squash and release/Dependabot flags", () => {
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