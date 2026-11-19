import { readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NODE_CMD_PATTERN, NPM_RUN_PATTERN } from "./agents-check-patterns.mjs";

/** Root and harness docs always scanned for cited paths and npm scripts. */
export const FIXED_GUIDANCE_FILES = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  ".github/pull_request_template.md",
  "docs/agent-guard-hooks.md",
] as const;

/** Dot-directory guidance globs (repo-relative). */
export const DOTDIR_GUIDANCE_GLOBS: readonly string[] = [".agents/skills/**/SKILL.md"];

const NESTED_WALK_SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  "__fixtures__",
  "reusables-pm",
]);
const PLACEHOLDER_PATTERN = /[*{}[\]<>?]/u;

/** Scenario-generated paths not present in a fresh template clone (issue #134). */
export const ALLOWLISTED_PATHS = [
  // Created by the mcp setup scenario via npm run setup.
  "scripts/test-mcp.mjs",
  // Created by npm run setup for new repositories.
  "SETUP.md",
] as const;

/** Scenario-generated npm scripts missing from root package.json until setup runs. */
export const ALLOWLISTED_NPM_SCRIPTS = [
  // Added by the mcp profile in scripts/setup-lib.mjs.
  "test:mcp",
  // Added by publishable setup scenarios in scripts/setup-lib.mjs.
  "prepublishOnly",
] as const;

export type ReferenceKind = "path" | "npm-script";

const PATH_REFERENCE_KIND: ReferenceKind = "path";
const NPM_SCRIPT_REFERENCE_KIND: ReferenceKind = "npm-script";

export interface GuidanceReference {
  readonly kind: ReferenceKind;
  readonly token: string;
  readonly line: number;
}

export interface GuidanceFinding {
  readonly file: string;
  readonly line: number;
  readonly kind: ReferenceKind;
  readonly token: string;
}

const BACKTICK = String.fromCodePoint(96);

function normalizeSlashes(value: string): string {
  return value.replaceAll("\\", "/").trim();
}

export function isPlaceholderToken(token: string): boolean {
  const normalized = normalizeSlashes(token);
  if (normalized.includes("../")) {
    return true;
  }
  return PLACEHOLDER_PATTERN.test(normalized);
}

export function isPathLikeBacktickToken(token: string): boolean {
  const normalized = normalizeSlashes(token);
  if (normalized.startsWith("-")) {
    return false;
  }
  if (!normalized.includes("/")) {
    return false;
  }
  if (normalized.endsWith("/")) {
    return true;
  }
  return /\.(?:ts|mjs|js|json|md|yml|yaml)$/iu.test(normalized);
}

function shouldSkipLinkTarget(target: string): boolean {
  const trimmed = target.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (trimmed.startsWith("#")) {
    return true;
  }
  if (/^https?:\/\//iu.test(trimmed) || /^mailto:/iu.test(trimmed)) {
    return true;
  }
  return false;
}

const ALLOWLISTED_PATH_SET = new Set<string>(ALLOWLISTED_PATHS);
const ALLOWLISTED_NPM_SCRIPT_SET = new Set<string>(ALLOWLISTED_NPM_SCRIPTS);

export function isAllowlistedPath(token: string): boolean {
  const normalized = normalizeSlashes(token);
  if (ALLOWLISTED_PATH_SET.has(normalized)) {
    return true;
  }
  if (normalized === "dist" || normalized.startsWith("dist/")) {
    return true;
  }
  return false;
}

export function isAllowlistedNpmScript(scriptName: string): boolean {
  return ALLOWLISTED_NPM_SCRIPT_SET.has(scriptName);
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/u);
}

const FENCE_MARKER = BACKTICK.repeat(3);

function updateFenceState(line: string, inFence: boolean): boolean {
  const trimmed = line.trimStart();
  if (trimmed.startsWith(FENCE_MARKER)) {
    return !inFence;
  }
  return inFence;
}

function collectPatterns(
  segment: string,
  pattern: RegExp,
  line: number,
  kind: ReferenceKind,
  pushReference: (reference: GuidanceReference) => void,
): void {
  const scoped = new RegExp(pattern.source, pattern.flags);
  let match = scoped.exec(segment);
  while (match !== null) {
    const token = match[1];
    if (typeof token === "string" && token.length > 0) {
      const normalized = normalizeSlashes(token);
      if (kind === "path" && !isPathLikeBacktickToken(normalized) && !/\.(?:ts|mjs|js|json|md|yml|yaml)$/iu.test(normalized)) {
        match = scoped.exec(segment);
        continue;
      }
      pushReference({ kind, line, token: normalized });
    }
    match = scoped.exec(segment);
  }
}

function referenceKey(reference: GuidanceReference): string {
  return reference.kind + ":" + reference.line + ":" + reference.token;
}

function markdownLinkTargets(rawLine: string): string[] {
  const targets: string[] = [];
  let index = 0;
  while (index < rawLine.length) {
    if (rawLine[index] !== "[") {
      index += 1;
      continue;
    }
    const labelEnd = rawLine.indexOf("]", index + 1);
    if (labelEnd === -1) {
      break;
    }
    if (rawLine[labelEnd + 1] !== "(") {
      index = labelEnd + 1;
      continue;
    }
    const targetEnd = rawLine.indexOf(")", labelEnd + 2);
    if (targetEnd === -1) {
      break;
    }
    targets.push(rawLine.slice(labelEnd + 2, targetEnd));
    index = targetEnd + 1;
  }
  return targets;
}

function extractMarkdownLinks(
  rawLine: string,
  lineNumber: number,
  pushReference: (reference: GuidanceReference) => void,
): void {
  for (const target of markdownLinkTargets(rawLine)) {
    if (!shouldSkipLinkTarget(target)) {
      pushReference({ kind: PATH_REFERENCE_KIND, line: lineNumber, token: normalizeSlashes(target) });
    }
  }
}

function backtickSegments(rawLine: string): string[] {
  const segments: string[] = [];
  let searchFrom = 0;
  while (searchFrom < rawLine.length) {
    const start = rawLine.indexOf(BACKTICK, searchFrom);
    if (start === -1) {
      break;
    }
    const end = rawLine.indexOf(BACKTICK, start + 1);
    if (end === -1) {
      break;
    }
    segments.push(rawLine.slice(start + 1, end));
    searchFrom = end + 1;
  }
  return segments;
}

function extractBacktickReferences(
  rawLine: string,
  lineNumber: number,
  pushReference: (reference: GuidanceReference) => void,
): void {
  for (const inner of backtickSegments(rawLine)) {
    const normalized = normalizeSlashes(inner);
    if (isPathLikeBacktickToken(normalized)) {
      pushReference({ kind: PATH_REFERENCE_KIND, line: lineNumber, token: normalized });
    }
    collectPatterns(inner, NPM_RUN_PATTERN, lineNumber, NPM_SCRIPT_REFERENCE_KIND, pushReference);
    collectPatterns(inner, NODE_CMD_PATTERN, lineNumber, PATH_REFERENCE_KIND, pushReference);
  }
}

function extractReferencesFromLine(
  rawLine: string,
  lineNumber: number,
  inFence: boolean,
  pushReference: (reference: GuidanceReference) => void,
): void {
  extractMarkdownLinks(rawLine, lineNumber, pushReference);
  extractBacktickReferences(rawLine, lineNumber, pushReference);
  if (inFence) {
    collectPatterns(rawLine, NPM_RUN_PATTERN, lineNumber, NPM_SCRIPT_REFERENCE_KIND, pushReference);
    collectPatterns(rawLine, NODE_CMD_PATTERN, lineNumber, PATH_REFERENCE_KIND, pushReference);
  }
}

export function extractGuidanceReferences(text: string): GuidanceReference[] {
  const references: GuidanceReference[] = [];
  const seen = new Set<string>();
  let inFence = false;

  const pushReference = (reference: GuidanceReference): void => {
    const key = referenceKey(reference);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    references.push(reference);
  };

  for (const [index, rawLine] of splitLines(text).entries()) {
    const lineNumber = index + 1;
    inFence = updateFenceState(rawLine, inFence);
    extractReferencesFromLine(rawLine, lineNumber, inFence, pushReference);
  }

  return references;
}

function globSuffixAfterStarStar(pattern: string): { prefix: string; suffix: string } | null {
  const marker = "/**/";
  const index = pattern.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return { prefix: pattern.slice(0, index), suffix: pattern.slice(index + marker.length) };
}

export function expandDotdirGuidanceGlob(rootDir: string, pattern: string): string[] {
  const parsed = globSuffixAfterStarStar(pattern);
  if (parsed === null) {
    return [];
  }
  const { prefix, suffix } = parsed;
  const prefixAbs = join(rootDir, prefix);
  try {
    statSync(prefixAbs);
  } catch {
    return [];
  }

  const matches: string[] = [];
  const walk = (relativeDir: string): void => {
    const absoluteDir = join(rootDir, relativeDir);
    for (const entry of readdirSync(absoluteDir)) {
      const relativePath = join(relativeDir, entry).replaceAll("\\", "/");
      const absolutePath = join(rootDir, relativePath);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(relativePath);
        continue;
      }
      if (
        relativePath.endsWith("/" + suffix) ||
        relativePath === prefix + "/" + suffix
      ) {
        matches.push(relativePath);
      }
    }
  };
  walk(prefix);
  return matches;
}

function walkNestedAgentsMd(rootDir: string): string[] {
  const found: string[] = [];

  const walk = (relativeDir: string): void => {
    const absoluteDir = join(rootDir, relativeDir);
    for (const entry of readdirSync(absoluteDir)) {
      const relativePath = join(relativeDir, entry).replaceAll("\\", "/");
      const absolutePath = join(rootDir, relativePath);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        if (NESTED_WALK_SKIP_DIRS.has(entry)) {
          continue;
        }
        if (entry.startsWith(".")) {
          continue;
        }
        walk(relativePath);
        continue;
      }
      if (entry === "AGENTS.md" && relativePath !== "AGENTS.md") {
        found.push(relativePath);
      }
    }
  };

  walk(".");
  return found.toSorted((a, b) => a.localeCompare(b));
}

export function discoverGuidanceFiles(rootDir: string): string[] {
  const files = new Set<string>();

  for (const relativePath of FIXED_GUIDANCE_FILES) {
    try {
      statSync(join(rootDir, relativePath));
      files.add(relativePath);
    } catch {
      // Optional harness file absent in minimal fixtures.
    }
  }

  for (const nested of walkNestedAgentsMd(rootDir)) {
    files.add(nested);
  }

  if (DOTDIR_GUIDANCE_GLOBS.length > 0) {
    for (const pattern of DOTDIR_GUIDANCE_GLOBS) {
      for (const match of expandDotdirGuidanceGlob(rootDir, pattern)) {
        files.add(match);
      }
    }
  }

  return [...files].toSorted((a, b) => a.localeCompare(b));
}

function stripLinkFragment(target: string): string {
  const hash = target.indexOf("#");
  if (hash === -1) {
    return target;
  }
  return target.slice(0, hash);
}

export function candidatePathResolutions(
  guidanceRelativePath: string,
  token: string,
): string[] {
  const bare = stripLinkFragment(normalizeSlashes(token)).replace(/^\.\//u, "");
  const guidanceDir = dirname(guidanceRelativePath);
  const fromGuidance =
    guidanceDir === "." ? bare : join(guidanceDir, bare).replaceAll("\\", "/");
  const candidates = [bare, fromGuidance];
  return [...new Set(candidates.map((entry) => normalizeSlashes(entry)))];
}

function resolvedRoot(rootDir: string): string {
  return realpathSync(rootDir);
}

function isPathInsideRoot(rootDir: string, absolutePath: string): boolean {
  const rootReal = resolvedRoot(rootDir);
  let candidateReal: string;
  try {
    candidateReal = realpathSync(absolutePath);
  } catch {
    return false;
  }
  if (candidateReal === rootReal) {
    return true;
  }
  return candidateReal.startsWith(rootReal + sep);
}

export function pathExistsInRepo(
  rootDir: string,
  guidanceRelativePath: string,
  token: string,
): boolean {
  for (const candidate of candidatePathResolutions(guidanceRelativePath, token)) {
    const absolute = resolve(rootDir, candidate);
    if (!absolute.startsWith(resolve(rootDir))) {
      continue;
    }
    try {
      const stats = statSync(absolute);
      if (stats.isSymbolicLink() && !isPathInsideRoot(rootDir, absolute)) {
        continue;
      }
      if (!isPathInsideRoot(rootDir, absolute)) {
        continue;
      }
      return true;
    } catch {
      // try next candidate
    }
  }
  return false;
}

export function loadPackageScriptNames(rootDir: string): Set<string> {
  const packagePath = join(rootDir, "package.json");
  const parsed: unknown = JSON.parse(readFileSync(packagePath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid package.json");
  }
  const scripts = Reflect.get(parsed, "scripts");
  if (typeof scripts !== "object" || scripts === null) {
    throw new Error("Missing package.json scripts");
  }
  return new Set(Object.keys(scripts));
}

export function validateReference(
  rootDir: string,
  guidanceRelativePath: string,
  reference: GuidanceReference,
  scriptNames: ReadonlySet<string>,
): GuidanceFinding | null {
  if (isPlaceholderToken(reference.token)) {
    return null;
  }

  if (reference.kind === NPM_SCRIPT_REFERENCE_KIND) {
    if (isAllowlistedNpmScript(reference.token)) {
      return null;
    }
    if (!scriptNames.has(reference.token)) {
      return {
        file: guidanceRelativePath,
        line: reference.line,
        kind: NPM_SCRIPT_REFERENCE_KIND,
        token: reference.token,
      };
    }
    return null;
  }

  if (isAllowlistedPath(reference.token)) {
    return null;
  }

  if (!pathExistsInRepo(rootDir, guidanceRelativePath, reference.token)) {
    return {
      file: guidanceRelativePath,
      line: reference.line,
      kind: PATH_REFERENCE_KIND,
      token: reference.token,
    };
  }
  return null;
}

export function collectGuidanceFindings(rootDir: string): GuidanceFinding[] {
  const scriptNames = loadPackageScriptNames(rootDir);
  const findings: GuidanceFinding[] = [];

  for (const guidancePath of discoverGuidanceFiles(rootDir)) {
    const text = readFileSync(join(rootDir, guidancePath), "utf8");
    const references = extractGuidanceReferences(text);
    for (const reference of references) {
      const finding = validateReference(rootDir, guidancePath, reference, scriptNames);
      if (finding !== null) {
        findings.push(finding);
      }
    }
  }

  return findings.toSorted((a, b) => {
    const fileCmp = a.file.localeCompare(b.file);
    if (fileCmp !== 0) {
      return fileCmp;
    }
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return a.token.localeCompare(b.token);
  });
}

export function formatFinding(finding: GuidanceFinding): string {
  const label = finding.kind === "path" ? "broken path" : "unknown npm script";
  return finding.file + ":" + finding.line + ": " + label + ": " + finding.token;
}

export const SKILLS_INDEX_BEGIN = "<!-- agents:skills:begin -->";
export const SKILLS_INDEX_END = "<!-- agents:skills:end -->";

const SKILL_DIR = ".agents/skills";

/** Agent Skills `name` field (agentskills.io). */
export const SKILL_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;

export interface SkillRecord {
  readonly name: string;
  readonly description: string;
  readonly skillPath: string;
}

export interface SkillFinding {
  readonly file: string;
  readonly line: number;
  readonly issue: string;
}

export function isValidSkillName(name: string, directoryName: string): boolean {
  if (name !== directoryName) {
    return false;
  }
  if (name.length < 1 || name.length > 64) {
    return false;
  }
  if (!SKILL_NAME_PATTERN.test(name)) {
    return false;
  }
  if (name.includes("--")) {
    return false;
  }
  return true;
}

function splitFrontmatter(text: string): { frontmatter: string; bodyStartLine: number } | null {
  const trimmed = text.startsWith("\uFEFF") ? text.slice(1) : text;
  if (!trimmed.startsWith("---\n") && !trimmed.startsWith("---\r\n")) {
    return null;
  }
  const newline = trimmed.startsWith("---\r\n") ? "\r\n" : "\n";
  const closeMarker = newline + "---" + newline;
  const closeIndex = trimmed.indexOf(closeMarker, 4);
  if (closeIndex === -1) {
    return null;
  }
  const frontmatter = trimmed.slice(4, closeIndex);
  const linesBeforeBody = trimmed.slice(0, closeIndex + closeMarker.length).split(/\r?\n/u).length;
  return { frontmatter, bodyStartLine: linesBeforeBody + 1 };
}

function readScalarField(frontmatter: string, field: string): string | undefined {
  const lines = frontmatter.split(/\r?\n/u);
  const prefix = field + ":";
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith(prefix)) {
      continue;
    }
    const value = trimmed.slice(prefix.length).trim();
    if (value.length === 0) {
      return "";
    }
    return value;
  }
  return undefined;
}

export function parseSkillFrontmatter(text: string): {
  readonly name: string | undefined;
  readonly description: string | undefined;
  readonly bodyStartLine: number;
} {
  const parsed = splitFrontmatter(text);
  if (parsed === null) {
    return { name: undefined, description: undefined, bodyStartLine: 1 };
  }
  return {
    name: readScalarField(parsed.frontmatter, "name"),
    description: readScalarField(parsed.frontmatter, "description"),
    bodyStartLine: parsed.bodyStartLine,
  };
}

export function listSkillRecords(rootDir: string): SkillRecord[] {
  const skillsRoot = join(rootDir, SKILL_DIR);
  let entries: string[];
  try {
    entries = readdirSync(skillsRoot);
  } catch {
    return [];
  }
  const records: SkillRecord[] = [];
  for (const entry of entries) {
    const skillPath = `${SKILL_DIR}/${entry}/SKILL.md`;
    const absolute = join(rootDir, skillPath);
    let text: string;
    try {
      text = readFileSync(absolute, "utf8");
    } catch {
      continue;
    }
    const { name, description } = parseSkillFrontmatter(text);
    if (typeof name !== "string" || typeof description !== "string") {
      continue;
    }
    records.push({ name, description, skillPath });
  }
  return records.toSorted((a, b) => a.name.localeCompare(b.name));
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", String.raw`\|`).replaceAll("\n", " ").trim();
}

export function renderSkillsIndexInner(records: readonly SkillRecord[]): string {
  const header = "| Skill | Description | Path |\n| --- | --- | --- |";
  if (records.length === 0) {
    return header;
  }
  const rows = records.map((record) => {
    const desc = escapeTableCell(record.description);
    const pathCell = `\`${record.skillPath}\``;
    return `| ${record.name} | ${desc} | ${pathCell} |`;
  });
  return [header, ...rows].join("\n");
}

export function extractSkillsIndexInner(agentsMd: string): string | null {
  const begin = agentsMd.indexOf(SKILLS_INDEX_BEGIN);
  const end = agentsMd.indexOf(SKILLS_INDEX_END);
  if (begin === -1 || end === -1 || end <= begin) {
    return null;
  }
  const sliceStart = begin + SKILLS_INDEX_BEGIN.length;
  let inner = agentsMd.slice(sliceStart, end);
  if (inner.startsWith("\n")) {
    inner = inner.slice(1);
  }
  if (inner.endsWith("\n")) {
    inner = inner.slice(0, -1);
  }
  return inner;
}

export function replaceSkillsIndexInner(agentsMd: string, inner: string): string {
  const begin = agentsMd.indexOf(SKILLS_INDEX_BEGIN);
  const end = agentsMd.indexOf(SKILLS_INDEX_END);
  if (begin === -1 || end === -1 || end <= begin) {
    throw new Error(`Missing skills index markers in AGENTS.md (${SKILLS_INDEX_BEGIN}).`);
  }
  const before = agentsMd.slice(0, begin + SKILLS_INDEX_BEGIN.length);
  const after = agentsMd.slice(end);
  return `${before}\n${inner}\n${after}`;
}

export function validateSkillFrontmatter(
  skillRelativePath: string,
  directoryName: string,
  text: string,
): SkillFinding[] {
  const findings: SkillFinding[] = [];
  const { name, description, bodyStartLine } = parseSkillFrontmatter(text);
  const line = bodyStartLine > 1 ? 2 : 1;

  if (name === undefined) {
    findings.push({
      file: skillRelativePath,
      line,
      issue: "skill frontmatter missing name",
    });
    return findings;
  }

  if (!isValidSkillName(name, directoryName)) {
    findings.push({
      file: skillRelativePath,
      line,
      issue: `skill name must match directory "${directoryName}" (lowercase, digits, hyphens, ≤ 64 chars)`,
    });
  }

  if (description === undefined || description.trim().length === 0) {
    findings.push({
      file: skillRelativePath,
      line,
      issue: "skill description must be non-empty (≤ 1024 characters)",
    });
  } else if (description.length > 1024) {
    findings.push({
      file: skillRelativePath,
      line,
      issue: "skill description exceeds 1024 characters",
    });
  }

  return findings;
}

function isExecutableFile(absolutePath: string): boolean {
  const stats = statSync(absolutePath);
  if (!stats.isFile()) {
    return false;
  }
  const mode = stats.mode;
  return (mode & 0o111) !== 0;
}

function walkSkillFiles(skillDirAbsolute: string, skillDirRelative: string): string[] {
  const files: string[] = [];
  const walk = (relative: string): void => {
    const absolute = join(skillDirAbsolute, relative);
    for (const entry of readdirSync(absolute)) {
      const childRelative = relative.length === 0 ? entry : `${relative}/${entry}`;
      const childAbsolute = join(skillDirAbsolute, childRelative);
      const stats = statSync(childAbsolute);
      if (stats.isDirectory()) {
        walk(childRelative);
        continue;
      }
      files.push(`${skillDirRelative}/${childRelative}`);
    }
  };
  walk("");
  return files;
}

export function findExecutableSkillFiles(rootDir: string, skillDirName: string): string[] {
  const skillDirRelative = `${SKILL_DIR}/${skillDirName}`;
  const skillDirAbsolute = join(rootDir, skillDirRelative);
  const executables: string[] = [];
  let files: string[];
  try {
    files = walkSkillFiles(skillDirAbsolute, skillDirRelative);
  } catch {
    return executables;
  }
  for (const relativePath of files) {
    if (isExecutableFile(join(rootDir, relativePath))) {
      executables.push(relativePath);
    }
  }
  return executables;
}

export function collectSkillFindings(rootDir: string): SkillFinding[] {
  const findings: SkillFinding[] = [];
  const skillsRoot = join(rootDir, SKILL_DIR);
  let skillDirs: string[];
  try {
    skillDirs = readdirSync(skillsRoot);
  } catch {
    return findings;
  }

  for (const dirName of skillDirs) {
    const skillRelativePath = `${SKILL_DIR}/${dirName}/SKILL.md`;
    const skillAbsolute = join(rootDir, skillRelativePath);
    let text: string;
    try {
      text = readFileSync(skillAbsolute, "utf8");
    } catch {
      findings.push({
        file: `${SKILL_DIR}/${dirName}/`,
        line: 1,
        issue: "skill directory missing SKILL.md",
      });
      continue;
    }
    findings.push(...validateSkillFrontmatter(skillRelativePath, dirName, text));
    for (const executable of findExecutableSkillFiles(rootDir, dirName)) {
      findings.push({
        file: executable,
        line: 1,
        issue: "executable file not allowed inside skills (instruction-only policy)",
      });
    }
  }

  const agentsPath = join(rootDir, "AGENTS.md");
  let agentsMd: string;
  try {
    agentsMd = readFileSync(agentsPath, "utf8");
  } catch {
    findings.push({ file: "AGENTS.md", line: 1, issue: "missing AGENTS.md for skills index" });
    return findings;
  }

  const expectedInner = renderSkillsIndexInner(listSkillRecords(rootDir));
  const actualInner = extractSkillsIndexInner(agentsMd);
  if (actualInner === null) {
    findings.push({
      file: "AGENTS.md",
      line: 1,
      issue: `missing skills index markers (${SKILLS_INDEX_BEGIN})`,
    });
  } else if (actualInner !== expectedInner) {
    findings.push({
      file: "AGENTS.md",
      line: 1,
      issue: "stale skills index; run npm run agents:index",
    });
  }

  return findings.toSorted((a, b) => {
    const fileCmp = a.file.localeCompare(b.file);
    if (fileCmp !== 0) {
      return fileCmp;
    }
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return a.issue.localeCompare(b.issue);
  });
}

export function formatSkillFinding(finding: SkillFinding): string {
  return `${finding.file}:${finding.line}: ${finding.issue}`;
}

export function writeSkillsIndex(rootDir: string): { changed: boolean; path: string } {
  const agentsPath = join(rootDir, "AGENTS.md");
  const agentsMd = readFileSync(agentsPath, "utf8");
  const inner = renderSkillsIndexInner(listSkillRecords(rootDir));
  const next = replaceSkillsIndexInner(agentsMd, inner);
  const changed = next !== agentsMd;
  if (changed) {
    writeFileSync(agentsPath, next, "utf8");
  }
  return { changed, path: basename(agentsPath) };
}

function repoRootFromModuleUrl(moduleUrl: string): string {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..");
}

export function runAgentsCheckCli(moduleUrl: string): void {
  const rootDir = repoRootFromModuleUrl(moduleUrl);
  const guidanceFindings = collectGuidanceFindings(rootDir);
  const skillFindings = collectSkillFindings(rootDir);
  const total = guidanceFindings.length + skillFindings.length;
  if (total === 0) {
    process.stdout.write("Agent guidance, skills, and npm scripts OK.\n");
    return;
  }
  for (const finding of guidanceFindings) {
    process.stderr.write(formatFinding(finding) + "\n");
  }
  for (const finding of skillFindings) {
    process.stderr.write(formatSkillFinding(finding) + "\n");
  }
  throw new Error("agents:check failed with " + total + " finding(s).");
}

export function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) {
    return false;
  }
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

/** @returns process exit code (0 success, 1 failure). */
export function runAgentsCheckCliEntry(moduleUrl: string): number {
  try {
    runAgentsCheckCli(moduleUrl);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("agents:check failed")) {
      process.stderr.write(message + "\n");
    }
    return 1;
  }
}

export function runAgentsIndexCli(moduleUrl: string): number {
  const rootDir = repoRootFromModuleUrl(moduleUrl);
  const { changed, path } = writeSkillsIndex(rootDir);
  if (changed) {
    process.stdout.write(`Updated skills index in ${path}.\n`);
  } else {
    process.stdout.write("Skills index already up to date.\n");
  }
  return 0;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  if (process.argv[2] === "index") {
    process.exitCode = runAgentsIndexCli(import.meta.url);
  } else {
    process.exitCode = runAgentsCheckCliEntry(import.meta.url);
  }
}