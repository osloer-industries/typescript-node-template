import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Label maintainers may add when a PR intentionally changes harness files. */
export const HARNESS_CHANGE_LABEL = "harness-change";

/** GitHub logins listed in CODEOWNERS who may approve harness edits. */
export const CODEOWNER_LOGINS = ["tn819"] as const;

/** Paths (file or directory prefix) treated as agent harness / guardrails. */
export const GUARDRAIL_PATH_PREFIXES = [
  ".github/",
  "AGENTS.md",
  "CODEOWNERS",
  ".oxlintrc.json",
  "vitest.config.ts",
  "lefthook.yml",
  "scripts/suppression-baseline.json",
  "scripts/count-suppressions.ts",
  "scripts/gate-self.test.ts",
  "scripts/check-guardrail-changes.ts",
  "scripts/agent-hooks/",
  "packages/eslint-sonarjs/",
] as const;

const TSCONFIG_JSON_PATTERN = /^tsconfig[^/]*\.json$/;

export function isGuardrailPath(changedPath: string): boolean {
  const normalized = changedPath.replaceAll("\\", "/");
  if (TSCONFIG_JSON_PATTERN.test(normalized)) {
    return true;
  }
  return GUARDRAIL_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix),
  );
}

const GIT_EXECUTABLE = process.env.GUARDRAIL_GIT_PATH ?? "/usr/bin/git";

export function listChangedPaths(baseRef: string, headRef: string, cwd: string): string[] {
  const output = execFileSync(GIT_EXECUTABLE, ["diff", "--name-only", `${baseRef}...${headRef}`], {
    cwd,
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function findGuardrailChanges(changedPaths: readonly string[]): string[] {
  return changedPaths.filter(isGuardrailPath);
}

export function parseCommaSeparatedList(value: string | undefined): string[] {
  if (value === undefined || value.trim().length === 0) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export type GuardrailApprovalInput = {
  readonly labels: readonly string[];
  readonly approvedByLogins: readonly string[];
};

export function hasGuardrailApproval(input: GuardrailApprovalInput): boolean {
  if (input.labels.includes(HARNESS_CHANGE_LABEL)) {
    return true;
  }
  const owners = new Set(CODEOWNER_LOGINS.map((login) => login.toLowerCase()));
  return input.approvedByLogins.some((login) => owners.has(login.toLowerCase()));
}

export type GuardrailCheckOutcome = "pass" | "fail";

export type GuardrailCheckResult = {
  readonly outcome: GuardrailCheckOutcome;
  readonly message: string;
};

export function computeGuardrailCheckResult(
  changedPaths: readonly string[],
  approval: GuardrailApprovalInput,
): GuardrailCheckResult {
  const guardrail = findGuardrailChanges(changedPaths);
  if (guardrail.length === 0) {
    return { outcome: "pass", message: "No guardrail path changes detected.\n" };
  }
  if (hasGuardrailApproval(approval)) {
    return {
      outcome: "pass",
      message:
        `Guardrail paths changed (${guardrail.length}) with maintainer approval: ${guardrail.join(", ")}\n`,
    };
  }
  return {
    outcome: "fail",
    message:
      `Guardrail paths changed (${guardrail.length}): ${guardrail.join(", ")}\n` +
      `Add the \`${HARNESS_CHANGE_LABEL}\` label or obtain an approving review from ` +
      `a CODEOWNERS maintainer (${CODEOWNER_LOGINS.join(", ")}).\n` +
      "Dependabot Action SHA bumps under `.github/` follow the same rule: approve the pull request.\n",
  };
}

type GitHubReview = {
  user?: { login?: string };
  state?: string;
  submitted_at?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGitHubReview(value: unknown): value is GitHubReview {
  if (!isRecord(value)) {
    return false;
  }
  if (value.user !== undefined && !isRecord(value.user)) {
    return false;
  }
  if (value.state !== undefined && typeof value.state !== "string") {
    return false;
  }
  if (value.submitted_at !== undefined && typeof value.submitted_at !== "string") {
    return false;
  }
  return true;
}

export function approvedLoginsFromReviews(reviews: readonly GitHubReview[]): string[] {
  const latestStateByLogin = new Map<string, string>();
  const sorted = [...reviews].toSorted((left, right) => {
    const leftTime = left.submitted_at ?? "";
    const rightTime = right.submitted_at ?? "";
    return leftTime.localeCompare(rightTime);
  });
  for (const review of sorted) {
    const login = review.user?.login;
    if (login === undefined || review.state === undefined) {
      continue;
    }
    latestStateByLogin.set(login, review.state);
  }
  return [...latestStateByLogin.entries()]
    .filter(([, state]) => state === "APPROVED")
    .map(([login]) => login);
}

export async function fetchApprovedReviewLogins(
  repository: string,
  pullNumber: number,
  token: string,
): Promise<string[]> {
  const url = `https://api.github.com/repos/${repository}/pulls/${pullNumber}/reviews`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to list pull request reviews (${response.status} ${response.statusText}). ` +
        "Ensure the workflow grants pull-requests: read.",
    );
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Expected an array of pull request reviews from the GitHub API.");
  }
  const reviews: GitHubReview[] = payload.filter(isGitHubReview);
  return approvedLoginsFromReviews(reviews);
}

export async function resolveApprovedReviewLoginsFromEnv(): Promise<string[]> {
  const override = process.env.GUARDRAIL_APPROVED_BY;
  if (override !== undefined && override.trim().length > 0) {
    return parseCommaSeparatedList(override);
  }
  const repository = process.env.GITHUB_REPOSITORY;
  const pullNumberRaw = process.env.GUARDRAIL_PR_NUMBER;
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (repository === undefined || pullNumberRaw === undefined || token === undefined) {
    return [];
  }
  const pullNumber = Number(pullNumberRaw);
  if (!Number.isFinite(pullNumber) || pullNumber <= 0) {
    return [];
  }
  return fetchApprovedReviewLogins(repository, pullNumber, token);
}

export async function runGuardrailCheckCli(moduleUrl: string, argv: readonly string[]): Promise<number> {
  const repoRoot = resolve(dirname(fileURLToPath(moduleUrl)), "..");
  const baseRef = argv[0] ?? process.env.GUARDRAIL_BASE_REF;
  const headRef = argv[1] ?? process.env.GUARDRAIL_HEAD_REF ?? "HEAD";
  if (typeof baseRef !== "string" || baseRef.length === 0) {
    throw new Error(
      "Missing base ref. Pass argv[0] or set GUARDRAIL_BASE_REF (e.g. origin/main or pull_request base SHA).",
    );
  }

  const changed = listChangedPaths(baseRef, headRef, repoRoot);
  const labels = parseCommaSeparatedList(process.env.GUARDRAIL_PR_LABELS);
  const approvedByLogins = await resolveApprovedReviewLoginsFromEnv();
  const result = computeGuardrailCheckResult(changed, { labels, approvedByLogins });

  if (result.outcome === "pass") {
    process.stdout.write(result.message);
    return 0;
  }
  process.stderr.write(result.message);
  return 1;
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const exitCode = await runGuardrailCheckCli(import.meta.url, process.argv.slice(2));
  process.exit(exitCode);
}
