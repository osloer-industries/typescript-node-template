import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distIndex = join(repoRoot, "dist/index.js");

describe("npm run build", () => {
  it("emits dist/index.js", () => {
    if (existsSync(join(repoRoot, "dist"))) {
      rmSync(join(repoRoot, "dist"), { recursive: true, force: true });
    }
    execFileSync("npm", ["run", "build"], {
      cwd: repoRoot,
      stdio: "pipe",
      encoding: "utf8",
    });
    expect(existsSync(distIndex), "expected tsc build output at dist/index.js").toBe(true);
  });
});
