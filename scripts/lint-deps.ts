import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { ensureEslintSonarjsDependencies } from "./lint-sonarjs.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const depcruiseConfig = join(repoRoot, ".dependency-cruiser.cjs");
const depcruiseBin = join(repoRoot, "node_modules", ".bin", "depcruise");

const defaultCruiseRoots = ["src", "scripts", "packages"] as const;

type DepcruiseJsonSummary = {
  totalCruised?: number;
  error?: number;
  warn?: number;
};

type DepcruiseJsonOutput = {
  summary?: DepcruiseJsonSummary;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDepcruiseJson(stdout: string): DepcruiseJsonOutput {
  const parsed: unknown = JSON.parse(stdout);
  if (!isRecord(parsed)) {
    throw new Error("dependency-cruiser JSON output was not an object.");
  }
  const summary = parsed.summary;
  if (summary !== undefined && !isRecord(summary)) {
    throw new Error("dependency-cruiser JSON summary was not an object.");
  }
  const result: DepcruiseJsonOutput = {};
  if (summary !== undefined) {
    const nextSummary: DepcruiseJsonSummary = {};
    if (typeof summary.totalCruised === "number") {
      nextSummary.totalCruised = summary.totalCruised;
    }
    if (typeof summary.error === "number") {
      nextSummary.error = summary.error;
    }
    if (typeof summary.warn === "number") {
      nextSummary.warn = summary.warn;
    }
    result.summary = nextSummary;
  }
  return result;
}

function runDepcruiseJson(cruiseRoots: readonly string[]): { status: number; stdout: string; stderr: string } {
  if (!existsSync(depcruiseBin)) {
    throw new Error(
      "dependency-cruiser binary not found. Run npm ci and ensure dependency-cruiser is installed.",
    );
  }
  const result = spawnSync(
    depcruiseBin,
    ["--config", depcruiseConfig, "--output-type", "json", ...cruiseRoots],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function evaluateDepcruiseGate(stdout: string): { ok: true } | { ok: false; message: string } {
  let parsed: DepcruiseJsonOutput;
  try {
    parsed = parseDepcruiseJson(stdout);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  const totalCruised = parsed.summary?.totalCruised;
  if (totalCruised === undefined) {
    return { ok: false, message: "dependency-cruiser JSON output missing summary.totalCruised." };
  }
  if (totalCruised === 0) {
    return {
      ok: false,
      message:
        "dependency-cruiser cruised 0 modules (empty or misconfigured scope). " +
        "This gate must not pass without analyzing the repo graph.",
    };
  }
  return { ok: true };
}

type DepcruiseJsonRun = ReturnType<typeof runDepcruiseJson>;

type SpawnErrResult = Pick<ReturnType<typeof spawnSync>, "status">;

export function runLintDepsCli(
  argv: readonly string[],
  options: {
    spawnJson?: (roots: readonly string[]) => DepcruiseJsonRun;
    spawnErr?: (command: string, args: readonly string[], options: object) => SpawnErrResult;
    ensureSonarWorkspace?: () => void;
  } = {},
): number {
  const ensureSonar = options.ensureSonarWorkspace ?? ensureEslintSonarjsDependencies;
  ensureSonar();

  const cruiseRoots = argv.length > 0 ? argv : defaultCruiseRoots;
  const runJson = options.spawnJson ?? runDepcruiseJson;

  const jsonRun = runJson(cruiseRoots);
  if (jsonRun.stderr.length > 0) {
    process.stderr.write(jsonRun.stderr);
  }

  const gate = evaluateDepcruiseGate(jsonRun.stdout);
  if (!gate.ok) {
    process.stderr.write(`lint:deps: ${gate.message}\n`);
    return 1;
  }

  if (!existsSync(depcruiseBin)) {
    process.stderr.write("lint:deps: dependency-cruiser binary not found.\n");
    return 1;
  }

  const spawnErr = options.spawnErr ?? spawnSync;
  const errRun = spawnErr(
    depcruiseBin,
    ["--config", depcruiseConfig, "--output-type", "err", ...cruiseRoots],
    { cwd: repoRoot, stdio: "inherit" },
  );
  const errStatus = errRun.status ?? 1;
  if (errStatus !== 0) {
    return errStatus;
  }
  if (jsonRun.status !== 0) {
    return jsonRun.status;
  }
  return 0;
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) {
    return false;
  }
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  process.exit(runLintDepsCli(process.argv.slice(2)));
}