import { describe, expect, it } from "vitest";
import { findNeedsFailures, parseNeedsJson, runCiPassedGate } from "./ci-passed-gate.js";

describe("findNeedsFailures", () => {
  it("accepts success only by default", () => {
    expect(findNeedsFailures({ lint: { result: "success" } })).toEqual([]);
    expect(findNeedsFailures({ lint: { result: "failure" } })).toEqual(["lint: failure"]);
    expect(findNeedsFailures({ lint: { result: "cancelled" } })).toEqual(["lint: cancelled"]);
    expect(findNeedsFailures({})).toEqual([
      "needs context has no jobs (misconfigured ci-passed gate)",
    ]);
  });

  it("allows sonar-zero-open-issues skipped on push", () => {
    const needs = { "sonar-zero-open-issues": { result: "skipped" }, quality: { result: "success" } };
    expect(findNeedsFailures(needs, "push")).toEqual([]);
    expect(findNeedsFailures(needs, "schedule")).toEqual([]);
  });

  it("rejects sonar-zero-open-issues skipped or failed on pull_request", () => {
    const skipped = { "sonar-zero-open-issues": { result: "skipped" } };
    const failed = { "sonar-zero-open-issues": { result: "failure" } };
    expect(findNeedsFailures(skipped, "pull_request")).toEqual([
      "sonar-zero-open-issues: skipped",
    ]);
    expect(findNeedsFailures(failed, "pull_request")).toEqual([
      "sonar-zero-open-issues: failure",
    ]);
    expect(findNeedsFailures({ "sonar-zero-open-issues": { result: "success" } }, "pull_request")).toEqual(
      [],
    );
  });

  it("allows harness-approval skipped on non-pull_request events", () => {
    const needs = { "harness-approval": { result: "skipped" } };
    expect(findNeedsFailures(needs, "push")).toEqual([]);
    expect(findNeedsFailures(needs, "pull_request")).toEqual(["harness-approval: skipped"]);
  });

  it("does not allow arbitrary jobs skipped on push", () => {
    expect(findNeedsFailures({ quality: { result: "skipped" } }, "push")).toEqual(["quality: skipped"]);
  });

  it("requires GITHUB_EVENT_NAME to allow pull-request-only skips", () => {
    expect(findNeedsFailures({ "sonar-zero-open-issues": { result: "skipped" } })).toEqual([
      "sonar-zero-open-issues: skipped",
    ]);
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
  });
});