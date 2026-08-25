// Re-export judging, against a fixture tree that hides a dead one and two that
// do not.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function fixture(name) {
  const r = spawnSync("node", [join(ROOT, "scripts", "deadexports.mjs"), join("scripts", "fixtures", "deadexports", name)], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

describe("re-exports", () => {
  it("reports a re-export nothing imports from the barrel", () => {
    const { code, out } = fixture("dead-reexport");
    expect(out).toContain("dead-reexport/src/tools/barrel.ts");
    expect(out).toContain("Widget   (re-export, imported from nowhere)");
    expect(code).toBe(1);
  });

  it("leaves a re-export its consumers actually import through", () => {
    const { code, out } = fixture("live-reexport");
    expect(out).toContain("every export has a consumer outside its own file");
    expect(out).not.toContain("Widget");
    expect(code).toBe(0);
  });

  it("judges no name under `export *`, and calls nothing it forwards unused", () => {
    const { code, out } = fixture("star-reexport");
    expect(out).toContain("every export has a consumer outside its own file");
    expect(code).toBe(0);
  });
});

describe("the baseline ratchet", () => {
  it("passes the real tree, whose findings are all recorded", () => {
    const r = spawnSync("node", [join(ROOT, "scripts", "deadexports.mjs")], { cwd: ROOT, encoding: "utf8" });
    expect(r.stdout).toContain("no dead export outside the baseline");
    expect(r.status).toBe(0);
  });
});
