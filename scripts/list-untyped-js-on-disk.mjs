import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const JS_EXTENSIONS = [".mjs", ".cjs", ".js", ".jsx", ".d.mts"];
const WALK_SKIP_DIR_NAMES = new Set(["node_modules", "dist", "coverage", ".git"]);

/**
 * @param {string} fileName
 */
function isJsExtension(fileName) {
  return JS_EXTENSIONS.some((suffix) => fileName.endsWith(suffix));
}

/**
 * @param {string} rootDir
 * @param {string} [relativeDir]
 * @param {string[]} [collected]
 * @returns {string[]}
 */
export function listJsPathsOnDisk(rootDir, relativeDir = "", collected = []) {
  const absoluteDir = join(rootDir, relativeDir);
  for (const entry of readdirSync(absoluteDir)) {
    const relativePath = relativeDir.length > 0 ? `${relativeDir}/${entry}` : entry;
    const absolutePath = join(rootDir, relativePath);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      if (WALK_SKIP_DIR_NAMES.has(entry)) continue;
      listJsPathsOnDisk(rootDir, relativePath, collected);
      continue;
    }
    if (isJsExtension(entry)) {
      collected.push(relativePath.replaceAll("\\", "/"));
    }
  }
  return collected;
}