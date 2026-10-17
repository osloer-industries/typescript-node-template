#!/usr/bin/env node

import { runSetupCli } from "./setup-lib.mjs";

const entry = process.argv[1] ?? "";
if (import.meta.url === new URL(entry, "file:").href) {
  await runSetupCli(process.argv.slice(2));
}
