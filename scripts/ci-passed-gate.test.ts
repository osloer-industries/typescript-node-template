import { describe, expect, it } from "vitest";
import {
  findNeedsFailures,
  guardrailHarnessApprovalNotRequired,
  parseNeedsJson,
  runCiPassedGate,
} from "./ci-passed-gate.js";

const allGreenPr = {
  "workflow-security": { result: "success" },
  quality: { result: "success" },
  "sonar-zero-open-issues": { result: "success" },
} as const;

describe("findNeedsFailures", () => {
  it("accepts success only for ordinary jobs", () => {
    expect(findNeedsFailures({ lint: { result: "success" } })).toEqual([]);
    expect(findNeedsFailures({ lint: { result: "failure" } })).toEqual(["lint: failure"]);
    expect(findNeedsFailures({ lint: { result: "cancelled" } })).toEqual(["lint: cancelled"]);
    expect(findNeedsFailures({})).toEqual([
      "needs context has no jobs (misconfigured ci-passed gate)",
    ]);
  });

  describe("sonar-zero-open-issues", () => {
    it("allows skipped on push when other jobs succeeded", () => {
      const needs = { "sonar-zero-open-issues": { result: "skipped" }, quality: { result: "success" } };
      expect(findNeedsFailures(needs, "push")).toEqual([]);
    });

    it("fails sonar skipped on pull_request", () => {
      expect(findNeedsFailures({ "sonar-zero-open-issues": { result: "skipped" } }, "pull_request")).toEqual(
        ["sonar-zero-open-issues: skipped"],
      );
    });

    it("fails sonar cancelled or missing result on pull_request", () => {
      expect(
        findNeedsFailures({ "sonar-zero-open-issues": { result: "cancelled" } }, "pull_request"),
      ).toEqual(["sonar-zero-open-issues: cancelled"]);
      expect(
        findNeedsFailures({ "sonar-zero-open-issues": { result: "" } }, "pull_request"),
      ).toEqual(["sonar-zero-open-issues: missing result"]);
    });

    it("fails when sonar-zero-open-issues is absent from needs on pull_request", () => {
      expect(findNeedsFailures({ quality: { result: "success" } }, "pull_request")).toEqual([
        "sonar-zero-open-issues: missing from needs on pull_request",
      ]);
    });

    it("fails sonar failure on push", () => {
      expect(
        findNeedsFailures(
          { "sonar-zero-open-issues": { result: "failure" }, quality: { result: "success" } },
          "push",
        ),
      ).toEqual(["sonar-zero-open-issues: failure"]);
    });

    it("fails another job skipped on push", () => {
      expect(findNeedsFailures({ quality: { result: "skipped" } }, "push")).toEqual(["quality: skipped"]);
    });

    it("passes all-success pull_request including sonar", () => {
      expect(findNeedsFailures({ ...allGreenPr }, "pull_request")).toEqual([]);
    });

    it("does not allow sonar skip without event name", () => {
      expect(findNeedsFailures({ "sonar-zero-open-issues": { result: "skipped" } })).toEqual([
        "sonar-zero-open-issues: skipped",
      ]);
    });
  });

  describe("harness-approval", () => {
    it("allows skipped when guardrail-detect reports no harness change", () => {
      const needs = {
        "guardrail-detect": { result: "success", outputs: { guardrail_changed: "false" } },
        "harness-approval": { result: "skipped" },
        "sonar-zero-open-issues": { result: "success" },
      };
      expect(findNeedsFailures(needs, "pull_request")).toEqual([]);
      expect(guardrailHarnessApprovalNotRequired(needs)).toBe(true);
    });

    it("fails harness-approval skipped when guardrail changed", () => {
      const needs = {
        "guardrail-detect": { result: "success", outputs: { guardrail_changed: "true" } },
        "harness-approval": { result: "skipped" },
        "sonar-zero-open-issues": { result: "success" },
      };
      expect(findNeedsFailures(needs, "pull_request")).toEqual(["harness-approval: skipped"]);
    });

    it("fails harness-approval skipped when guardrail-detect output is absent", () => {
      const needs = {
        "guardrail-detect": { result: "success" },
        "harness-approval": { result: "skipped" },
      };
      expect(findNeedsFailures(needs, "push")).toEqual(["harness-approval: skipped"]);
    });
  });
});

describe("parseNeedsJson", () => {
  it("fails closed on invalid input", () => {
    expect(() => parseNeedsJson("")).toThrow(/empty/);
    expect(() => parseNeedsJson("[]")).toThrow(/object/);
    expect(() => parseNeedsJson(JSON.stringify({ job: { result: 1 } }))).toThrow(/invalid/);
    expect(() => parseNeedsJson(JSON.stringify({ job: { result: "success", outputs: [] } }))).toThrow(
      /invalid/,
    );
  });

  it("parses outputs when present", () => {
    const needs = parseNeedsJson(JSON.stringify({ job: { result: "success", outputs: { a: "b" } } }));
    expect(needs.job?.outputs).toEqual({ a: "b" });
  });
});

describe("runCiPassedGate", () => {
  it("returns exit codes for aggregate needs", () => {
    expect(
      runCiPassedGate(JSON.stringify({ a: { result: "success" }, b: { result: "success" } }), "push"),
    ).toBe(0);
    expect(runCiPassedGate(JSON.stringify({ ...allGreenPr }), "pull_request")).toBe(0);
    expect(runCiPassedGate(JSON.stringify({ a: { result: "failure" } }), "pull_request")).toBe(1);
    expect(runCiPassedGate("")).toBe(1);
    expect(
      runCiPassedGate(
        JSON.stringify({
          "sonar-zero-open-issues": { result: "skipped" },
          quality: { result: "success" },
        }),
        "push",
      ),
    ).toBe(0);
    expect(
      runCiPassedGate(
        JSON.stringify({ "sonar-zero-open-issues": { result: "skipped" } }),
        "pull_request",
      ),
    ).toBe(1);
  });
});