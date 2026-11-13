import { describe, expect, it } from "vitest";
import { sonarProjectConfigured } from "./is-sonar-project-configured.js";

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
