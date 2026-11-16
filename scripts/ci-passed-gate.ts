#!/usr/bin/env node
/**
 * Fail closed unless every entry in the GitHub Actions `needs` context is result success.
 *
 * Org-standard exceptions (port to osloer-industries/.github ci-passed-gate.ts):
 * - `sonar-zero-open-issues`: `skipped` is OK on non–pull_request events only (caller runs it on PR).
 * - `harness-approval`: `skipped` is OK when `guardrail-detect` outputs `guardrail_changed: "false"`.
 */

import { fileURLToPath } from "node:url";

export const ALLOWED_NEEDS_RESULTS = new Set(["success"]);

export const SONAR_ZERO_OPEN_ISSUES_JOB_ID = "sonar-zero-open-issues";
export const HARNESS_APPROVAL_JOB_ID = "harness-approval";
export const GUARDRAIL_DETECT_JOB_ID = "guardrail-detect";
export const GUARDRAIL_CHANGED_OUTPUT_KEY = "guardrail_changed";

export interface NeedsJobEntry {
  result: string;
  outputs?: Record<string, string>;
}

export type NeedsMap = Record<string, NeedsJobEntry>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseNeedsEntry(value: unknown): NeedsJobEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const result = value["result"];
  if (typeof result !== "string") {
    return null;
  }
  const outputs = value["outputs"];
  if (outputs === undefined) {
    return { result };
  }
  if (!isRecord(outputs)) {
    return null;
  }
  const mapped: Record<string, string> = {};
  for (const [key, outputValue] of Object.entries(outputs)) {
    if (typeof outputValue !== "string") {
      return null;
    }
    mapped[key] = outputValue;
  }
  return { result, outputs: mapped };
}

export function parseNeedsJson(raw: string): NeedsMap {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("NEEDS_JSON is empty");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("NEEDS_JSON is not valid JSON");
  }
  if (!isRecord(parsed)) {
    throw new Error("NEEDS_JSON must be a JSON object");
  }
  const needs: NeedsMap = {};
  for (const [jobId, entryValue] of Object.entries(parsed)) {
    const entry = parseNeedsEntry(entryValue);
    if (entry === null) {
      throw new Error(`NEEDS_JSON entry for ${jobId} is invalid`);
    }
    needs[jobId] = entry;
  }
  return needs;
}

export function guardrailHarnessApprovalNotRequired(needs: NeedsMap): boolean {
  const detect = needs[GUARDRAIL_DETECT_JOB_ID];
  return detect?.outputs?.[GUARDRAIL_CHANGED_OUTPUT_KEY] === "false";
}

function sonarZeroOpenIssuesSkipAllowed(eventName: string | undefined): boolean {
  return eventName !== undefined && eventName.length > 0 && eventName !== "pull_request";
}

function skippedResultTolerated(jobId: string, needs: NeedsMap, eventName: string | undefined): boolean {
  if (jobId === SONAR_ZERO_OPEN_ISSUES_JOB_ID) {
    return sonarZeroOpenIssuesSkipAllowed(eventName);
  }
  if (jobId === HARNESS_APPROVAL_JOB_ID) {
    return guardrailHarnessApprovalNotRequired(needs);
  }
  return false;
}

export function findNeedsFailures(needs: NeedsMap, eventName?: string): string[] {
  const failures: string[] = [];
  const entries = Object.entries(needs);
  if (entries.length === 0) {
    failures.push("needs context has no jobs (misconfigured ci-passed gate)");
    return failures;
  }

  if (eventName === "pull_request") {
    const sonar = needs[SONAR_ZERO_OPEN_ISSUES_JOB_ID];
    if (sonar === undefined) {
      failures.push(`${SONAR_ZERO_OPEN_ISSUES_JOB_ID}: missing from needs on pull_request`);
    }
  }

  for (const [jobId, entry] of entries) {
    const result = (entry?.result ?? "").trim();
    if (result.length === 0) {
      failures.push(`${jobId}: missing result`);
      continue;
    }
    if (result === "skipped" && skippedResultTolerated(jobId, needs, eventName)) {
      continue;
    }
    if (!ALLOWED_NEEDS_RESULTS.has(result)) {
      failures.push(`${jobId}: ${result}`);
    }
  }
  return failures;
}

function formatCaughtError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return JSON.stringify(error);
}

export function runCiPassedGate(needsJson: string, eventName?: string): number {
  let needs: NeedsMap;
  try {
    needs = parseNeedsJson(needsJson);
  } catch (error: unknown) {
    console.error(`::error::${formatCaughtError(error)}`);
    return 1;
  }

  const failures = findNeedsFailures(needs, eventName);
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`::error::Required job did not succeed: ${failure}`);
    }
    console.error(
      "::error::ci-passed gate failed: skipped, cancelled, and failed upstream jobs block merge.",
    );
    return 1;
  }

  console.log("ci-passed: all required jobs succeeded.");
  return 0;
}

function main(): void {
  const needsJson = process.env.NEEDS_JSON ?? "";
  const eventName = process.env.GITHUB_EVENT_NAME;
  process.exit(runCiPassedGate(needsJson, eventName));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}