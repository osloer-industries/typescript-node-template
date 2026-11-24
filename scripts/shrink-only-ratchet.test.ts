import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertAllowlistWriteShrinkOnly,
  assertShrinkOnly,
  assertTrackedPathsMatchAllowlist,
} from "./shrink-only-ratchet.ts";

const utf8 = "utf8";
const scriptsAMjs = "scripts/a.mjs";
const scriptsBMjs = "scripts/b.mjs";
const scriptsGenMjs = "scripts/gen.mjs";
const scriptsGhostMjs = "scripts/ghost.mjs";
const scriptsNewMjs = "scripts/new.mjs";
const emptyMjsExport = "export {};\n";

describe("assertShrinkOnly", () => {
  it("allows equal or lower counts", () => {
    const ceiling = { version: 1 as const, total: 2 };
    expect(() => assertShrinkOnly(2, ceiling)).not.toThrow();
    expect(() => assertShrinkOnly(1, ceiling)).not.toThrow();
  });

  it("rejects increases", () => {
    expect(() => assertShrinkOnly(3, { version: 1, total: 2 })).toThrow(/exceeds baseline/);
  });
});

describe("assertTrackedPathsMatchAllowlist", () => {
  it("passes when tracked paths match the allowlist", () => {
    expect.hasAssertions();
    const rootDir = mkdtempSync(join(tmpdir(), "ratchet-ok-"));
    try {
      mkdirSync(join(rootDir, "scripts"), { recursive: true });
      writeFileSync(join(rootDir, scriptsAMjs), emptyMjsExport, utf8);
      expect(() =>
        assertTrackedPathsMatchAllowlist([scriptsAMjs], [scriptsAMjs], rootDir),
      ).not.toThrow();
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects unlisted tracked paths", () => {
    expect(() => assertTrackedPathsMatchAllowlist([scriptsNewMjs], [scriptsAMjs], "/tmp"))
      .toThrow(/Untyped JS not in/);
  });

  it("allows allowlist entries that exist on disk but are not tracked", () => {
    expect.hasAssertions();
    const rootDir = mkdtempSync(join(tmpdir(), "ratchet-disk-"));
    try {
      mkdirSync(join(rootDir, "scripts"), { recursive: true });
      writeFileSync(join(rootDir, scriptsGenMjs), emptyMjsExport, utf8);
      expect(() =>
        assertTrackedPathsMatchAllowlist(
          [scriptsAMjs],
          [scriptsAMjs, scriptsGenMjs],
          rootDir,
        ),
      ).not.toThrow();
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects stale entries missing on disk", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "ratchet-stale-"));
    try {
      expect(() =>
        assertTrackedPathsMatchAllowlist([scriptsAMjs], [scriptsAMjs, scriptsGhostMjs], rootDir),
      ).toThrow(/Stale allowlist entries/);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

describe("assertAllowlistWriteShrinkOnly", () => {
  it("rejects growth via write mode", () => {
    expect(() =>
      assertAllowlistWriteShrinkOnly([scriptsAMjs, scriptsBMjs], [scriptsAMjs]),
    ).toThrow(/Cannot grow JS allowlist/);
  });

  it("allows shrinking the allowlist", () => {
    expect.hasAssertions();
    expect(() =>
      assertAllowlistWriteShrinkOnly([scriptsAMjs], [scriptsAMjs, scriptsBMjs]),
    ).not.toThrow();
  });
});

describe("assertShrinkOnly custom labels", () => {
  it("uses remediation text in errors", () => {
    expect(() =>
      assertShrinkOnly(2, { version: 1, total: 1 }, { label: "Example", remediation: "Fix it." }),
    ).toThrow(/Fix it\./);
  });
});