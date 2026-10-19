#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import linkCheck from "link-check";

const skipDirs = new Set(["node_modules", "dist", "coverage", ".git"]);
const linkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;

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

/**
 * @param {string} content
 */
function extractMarkdownLinks(content) {
  const links = [];
  for (const match of content.matchAll(linkPattern)) {
    const target = match[1]?.trim();
    if (target) links.push(target);
  }
  return links;
}

/**
 * @param {string} url
 */
function checkHttpLink(url) {
  const config = JSON.parse(
    readFileSync(new URL("../.markdown-link-check.json", import.meta.url), "utf8")
  );
  return new Promise((resolvePromise, reject) => {
    linkCheck(url, config, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      if (result.status === "alive") {
        resolvePromise(undefined);
        return;
      }
      reject(new Error(`${url} (${result.statusCode ?? result.status})`));
    });
  });
}

/**
 * @param {string} filePath
 * @param {string} target
 */
function checkRelativeLink(filePath, target) {
  const withoutFragment = target.split("#")[0];
  if (withoutFragment.length === 0) return;
  const resolved = resolve(dirname(filePath), withoutFragment);
  if (!existsSync(resolved)) {
    throw new Error(`${relative(process.cwd(), filePath)}: missing target ${target}`);
  }
}

/**
 * @param {string} filePath
 * @param {string} target
 */
async function checkLinkTarget(filePath, target) {
  if (target.startsWith("#") || target.startsWith("mailto:")) return;
  if (/^https?:\/\//i.test(target)) {
    await checkHttpLink(target);
    return;
  }
  checkRelativeLink(filePath, target);
}

/**
 * @param {string} filePath
 */
async function checkMarkdownFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  await Promise.all(extractMarkdownLinks(content).map((target) => checkLinkTarget(filePath, target)));
}

const markdownFiles = [];
collectMarkdownFiles(process.cwd(), markdownFiles);
markdownFiles.sort((left, right) => left.localeCompare(right));

const failures = await Promise.all(
  markdownFiles.map(async (file) => {
    try {
      await checkMarkdownFile(file);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  })
);

for (const message of failures) {
  if (message) console.error(message);
}

if (failures.some(Boolean)) process.exit(1);
