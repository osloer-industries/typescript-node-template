import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Thin caller workflows every repo scaffolded from the template should ship. */
const TEMPLATE_CALLER_WORKFLOWS = [
  ".github/workflows/ci.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/pr-title.yml",
  ".github/workflows/release.yml",
  ".github/workflows/auto-merge.yml",
] as const;

const AUTO_MERGE_REUSABLE_PIN =
  "osloer-industries/.github/.github/workflows/auto-merge.yml@a6ee91211fd9ba096ec141bacdb67985a82b6767 # v0.1.7";

describe("template GitHub workflow callers", () => {
  it("includes the standard thin caller workflows", () => {
    expect.assertions(TEMPLATE_CALLER_WORKFLOWS.length);
    for (const relativePath of TEMPLATE_CALLER_WORKFLOWS) {
      expect(() => readFileSync(new URL(`../${relativePath}`, import.meta.url))).not.toThrow();
    }
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