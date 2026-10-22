#!/usr/bin/env node

import { runSetupCli } from "./setup-lib.mjs";

/**
 * @param {string} metaUrl
 * @param {string} argvEntry
 */
export function isSetupEntry(metaUrl, argvEntry) {
  return metaUrl === new URL(argvEntry, "file:").href;
}

/**
 * @param {string} metaUrl
 * @param {string} argvEntry
 * @param {readonly string[]} argv
 * @param {(args: readonly string[]) => Promise<void>} [runCli]
 */
export async function runSetupEntry(metaUrl, argvEntry, argv, runCli = runSetupCli) {
  if (isSetupEntry(metaUrl, argvEntry)) {
    await runCli(argv);
  }
}

const entry = process.argv[1] ?? "";
await runSetupEntry(import.meta.url, entry, process.argv.slice(2));
