// The copy gate's path handling. `join(ROOT, "/abs/path")` concatenated instead
// of resolving, so every absolute path — which the agent instructions in this
// repo ask for — scanned zero files and exited 0.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(...args) {
  const r = spawnSync("node", [join(ROOT, "scripts", "copycheck.mjs"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

describe("path arguments", () => {
  it("reads the same files whether the path is absolute or relative", () => {
    const relative = run("src/tools/presets").out;
    const absolute = run(join(ROOT, "src", "tools", "presets")).out;
    expect(absolute).toBe(relative);
    expect(relative).not.toContain("0 user-visible strings");
  });

  it("exits 2 when a path argument matches no source file", () => {
    const { code, out } = run("src/does-not-exist");
    expect(out).toContain("NOTHING TO CHECK");
    expect(code).toBe(2);
  });
});
