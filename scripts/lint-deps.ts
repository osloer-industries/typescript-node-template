import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import swcCore from "@swc/core";
import { cruise } from "dependency-cruiser";
import type { ICruiseOptions, IConfiguration } from "dependency-cruiser";

import { ensureEslintSonarjsDependencies } from "./lint-sonarjs.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const depcruiseConfig = join(repoRoot, ".dependency-cruiser.cjs");
const requireFromRepo = createRequire(join(repoRoot, "package.json"));

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

function isDepcruiseConfiguration(value: unknown): value is IConfiguration {
  return isRecord(value) && Array.isArray(value.forbidden);
}

function loadDepcruiseConfiguration(): IConfiguration {
  if (!existsSync(depcruiseConfig)) {
    throw new Error(`Missing dependency-cruiser config at ${depcruiseConfig}`);
  }
  const loaded: unknown = requireFromRepo(depcruiseConfig);
  if (!isDepcruiseConfiguration(loaded)) {
    throw new Error("dependency-cruiser config must export forbidden rules.");
  }
  return loaded;
}

function assertSwcParserBackend(): void {
  if (typeof swcCore.transform !== "function") {
    throw new TypeError("@swc/core is unavailable; dependency-cruiser swc parser cannot run.");
  }
}

function buildCruiseOptions(configuration: IConfiguration, outputType: "json" | "err"): ICruiseOptions {
  const options = configuration.options ?? {};
  return {
    ...options,
    ruleSet: configuration,
    outputType,
  };
}

function reporterOutputToStdout(output: unknown): string {
  return typeof output === "string" ? output : JSON.stringify(output);
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

async function runDepcruiseJson(cruiseRoots: readonly string[]): Promise<{
  status: number;
  stdout: string;
  stderr: string;
}> {
  assertSwcParserBackend();
  const configuration = loadDepcruiseConfiguration();
  const reporter = await cruise([...cruiseRoots], buildCruiseOptions(configuration, "json"));
  return {
    status: reporter.exitCode,
    stdout: reporterOutputToStdout(reporter.output),
    stderr: reporter.meta ?? "",
  };
}

async function runDepcruiseErr(cruiseRoots: readonly string[]): Promise<number> {
  assertSwcParserBackend();
  const configuration = loadDepcruiseConfiguration();
  const reporter = await cruise([...cruiseRoots], buildCruiseOptions(configuration, "err"));
  if (typeof reporter.output === "string") {
    process.stdout.write(reporter.output);
    if (!reporter.output.endsWith("\n")) {
      process.stdout.write("\n");
    }
  }
  if (reporter.meta !== undefined && reporter.meta.length > 0) {
    process.stderr.write(reporter.meta);
  }
  return reporter.exitCode;
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

type DepcruiseJsonRun = Awaited<ReturnType<typeof runDepcruiseJson>>;

export async function runLintDepsCli(
  argv: readonly string[],
  options: {
    runJson?: (roots: readonly string[]) => Promise<DepcruiseJsonRun>;
    runErr?: (roots: readonly string[]) => Promise<number>;
    ensureSonarWorkspace?: () => void;
  } = {},
): Promise<number> {
  const ensureSonar = options.ensureSonarWorkspace ?? ensureEslintSonarjsDependencies;
  ensureSonar();

  const cruiseRoots = argv.length > 0 ? argv : defaultCruiseRoots;
  const runJson = options.runJson ?? runDepcruiseJson;

  const jsonRun = await runJson(cruiseRoots);
  if (jsonRun.stderr.length > 0) {
    process.stderr.write(jsonRun.stderr);
  }

  const gate = evaluateDepcruiseGate(jsonRun.stdout);
  if (!gate.ok) {
    process.stderr.write(`lint:deps: ${gate.message}\n`);
    return 1;
  }

  const runErr = options.runErr ?? runDepcruiseErr;
  const errStatus = await runErr(cruiseRoots);
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
  try {
    const code = await runLintDepsCli(process.argv.slice(2));
    process.exit(code);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`lint:deps: ${message}\n`);
    process.exit(1);
  }
}