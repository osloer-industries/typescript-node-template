#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { checkMarkdownFileLinks } from "./index.mjs";

const skipDirs = new Set(["node_modules", "dist", "coverage", ".git"]);

/**
 * @param {string} dir
 * @param {string[]} files
 */
function collectMarkdownFiles(dir, files) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue;
    const absolutePath = join(dir, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) collectMarkdownFiles(absolutePath, files);
    else if (entry.endsWith(".md")) files.push(absolutePath);
  }
}

const configArgIndex = process.argv.indexOf("--config");
const configPath = configArgIndex >= 0 ? process.argv[configArgIndex + 1] : undefined;
const linkCheckOptions = configPath
  ? JSON.parse(readFileSync(configPath, "utf8"))
  : {};

const markdownFiles = [];
collectMarkdownFiles(process.cwd(), markdownFiles);
markdownFiles.sort((left, right) => left.localeCompare(right));

const failures = await Promise.all(
  markdownFiles.map(async (filePath) => {
    try {
      const markdown = readFileSync(filePath, "utf8");
      await checkMarkdownFileLinks(markdown, filePath, linkCheckOptions);
      return undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `${relative(process.cwd(), filePath)}: ${message}`;
    }
  })
);

for (const message of failures) {
  if (message) console.error(message);
}

if (failures.some(Boolean)) process.exit(1);
