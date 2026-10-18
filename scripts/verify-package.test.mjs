import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runVerifyPackage, shouldVerifyPackage } from "./verify-package.mjs";

describe("shouldVerifyPackage", () => {
  it("requires exports or bin", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "verify-package-"));
    const pkgPath = join(tempDir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ name: "example", private: true }));
    expect(shouldVerifyPackage(pkgPath)).toBe(false);
    writeFileSync(pkgPath, JSON.stringify({ name: "example", exports: { ".": "./dist/index.js" } }));
    expect(shouldVerifyPackage(pkgPath)).toBe(true);
  });
});

describe("runVerifyPackage", () => {
  it("skips when nothing is publishable", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "verify-package-"));
    const pkgPath = join(tempDir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ name: "example" }));
    const runNpmFn = vi.fn();
    expect(runVerifyPackage({ runNpmFn, packageJsonPath: pkgPath, stdio: "pipe" })).toEqual({ skipped: true });
    expect(runNpmFn).not.toHaveBeenCalled();
  });

  it("runs publint and attw when exports exist", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "verify-package-"));
    const pkgPath = join(tempDir, "package.json");
    writeFileSync(pkgPath, JSON.stringify({ name: "example", exports: { ".": "./dist/index.js" } }));
    const runNpmFn = vi.fn();
    expect(runVerifyPackage({ runNpmFn, packageJsonPath: pkgPath, stdio: "pipe" })).toEqual({ skipped: false });
    expect(runNpmFn).toHaveBeenNthCalledWith(1, ["exec", "--", "publint", "."], { stdio: "pipe" });
    expect(runNpmFn).toHaveBeenNthCalledWith(2, ["exec", "--", "attw", "--pack"], { stdio: "pipe" });
  });
});
