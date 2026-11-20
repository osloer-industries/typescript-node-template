/** Numeric shrink-only ceiling shared by suppression and JS allowlist gates. */
export interface ShrinkOnlyCeiling {
  readonly version: 1;
  readonly total: number;
}

export interface AssertShrinkOnlyOptions {
  readonly label?: string;
  readonly remediation?: string;
}

export function assertShrinkOnly(
  actual: number,
  ceiling: ShrinkOnlyCeiling,
  options: AssertShrinkOnlyOptions = {},
): void {
  const label = options.label ?? "Suppression count";
  const remediation =
    options.remediation ??
    "Remove new disable/ts-comment suppressions or lower the baseline intentionally in a dedicated PR.";
  if (actual > ceiling.total) {
    throw new Error(`${label} ${actual} exceeds baseline ${ceiling.total}. ${remediation}`);
  }
}

function normalizePosixPath(path: string): string {
  return path.replaceAll("\\", "/").trim();
}

/**
 * Ensures tracked untyped JS paths match the allowlist exactly (no growth, no stale entries).
 */
export function assertTrackedPathsMatchAllowlist(
  trackedPaths: readonly string[],
  allowlistedPaths: readonly string[],
): void {
  const tracked = trackedPaths.map(normalizePosixPath).toSorted((a, b) => a.localeCompare(b));
  const allowlisted = allowlistedPaths.map(normalizePosixPath).toSorted((a, b) => a.localeCompare(b));

  assertShrinkOnly(tracked.length, { version: 1, total: allowlisted.length }, {
    label: "Tracked untyped JS",
    remediation:
      "Convert new files to TypeScript or update quality/js-allowlist.json in a guardrail-reviewed PR.",
  });

  const allowSet = new Set(allowlisted);
  const trackedSet = new Set(tracked);
  const unlisted = tracked.filter((path) => !allowSet.has(path));
  const stale = allowlisted.filter((path) => !trackedSet.has(path));

  if (unlisted.length > 0) {
    throw new Error(
      `Untyped JS not in quality/js-allowlist.json: ${unlisted.join(", ")}. ` +
        "Convert to TypeScript or update the allowlist in a guardrail-reviewed PR.",
    );
  }
  if (stale.length > 0) {
    throw new Error(
      `Stale allowlist entries (file no longer tracked): ${stale.join(", ")}. ` +
        "Remove the entry when converting or deleting the file (shrink-only).",
    );
  }
}

/** `--write-allowlist` may only remove paths, never add. */
export function assertAllowlistWriteShrinkOnly(
  trackedPaths: readonly string[],
  allowlistedPaths: readonly string[],
): void {
  const allowSet = new Set(allowlistedPaths.map(normalizePosixPath));
  const unlisted = trackedPaths
    .map(normalizePosixPath)
    .filter((path) => !allowSet.has(path));
  if (unlisted.length > 0) {
    throw new Error(
      `Cannot grow JS allowlist via --write-allowlist: ${unlisted.join(", ")}. ` +
        "Add allowlist entries only in a guardrail-reviewed PR.",
    );
  }
  assertShrinkOnly(trackedPaths.length, { version: 1, total: allowlistedPaths.length }, {
    label: "JS allowlist",
    remediation: "Shrink the allowlist when converting files; do not add entries via --write-allowlist.",
  });
}