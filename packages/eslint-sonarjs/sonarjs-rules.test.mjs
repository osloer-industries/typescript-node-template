import { describe, expect, it } from "vitest";

import {
  buildSonarjsTypeScriptFlatRules,
  recommendedSeverityToError,
  sonarCloudShiftLeftRules,
} from "./sonarjs-rules.mjs";

describe("recommendedSeverityToError", () => {
  it("drops off rules", () => {
    expect(recommendedSeverityToError("off")).toBeUndefined();
    expect(recommendedSeverityToError(0)).toBeUndefined();
  });

  it("promotes warn and error to error", () => {
    expect(recommendedSeverityToError("warn")).toBe("error");
    expect(recommendedSeverityToError("error")).toBe("error");
    expect(recommendedSeverityToError(1)).toBe("error");
    expect(recommendedSeverityToError(2)).toBe("error");
  });

  it("preserves options while forcing error", () => {
    expect(recommendedSeverityToError(["warn", { threshold: 15 }])).toEqual(["error", { threshold: 15 }]);
  });
});

describe("buildSonarjsTypeScriptFlatRules", () => {
  it("includes SonarCloud shift-left rules", () => {
    const rules = buildSonarjsTypeScriptFlatRules();
    for (const name of Object.keys(sonarCloudShiftLeftRules)) {
      expect(rules[name]).toBe("error");
    }
  });

  it("never emits warn severities", () => {
    const rules = buildSonarjsTypeScriptFlatRules();
    const levels = Object.values(rules).map((severity) =>
      Array.isArray(severity) ? severity[0] : severity,
    );
    expect(levels.every((level) => level === "error")).toBe(true);
  });
});