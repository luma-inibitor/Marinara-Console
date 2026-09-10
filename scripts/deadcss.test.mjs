// The drift test on DOMAINS and the cross-sheet conflict report: fixture trees
// that must break each, and trees that must not. A stale table stops scanning a
// namespace and still prints clean.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(...args) {
  const r = spawnSync("node", [join(ROOT, "scripts", "deadcss.mjs"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const fixture = (name) => run(join("scripts", "fixtures", "deadcss", name));

describe("the DOMAINS drift test", () => {
  it("passes a prefix the table names, and counts its composed classes live", () => {
    const { code, out } = fixture("registered");
    expect(out).toContain("2 classes, 0 unused");
    expect(code).toBe(0);
  });

  it("exits 2 on a prefix composed in a class position with no entry", () => {
    const { code, out } = fixture("unregistered");
    expect(out).toContain("UNREGISTERED CLASS PREFIX");
    expect(out).toContain("`rank-${...}`");
    expect(code).toBe(2);
  });

  it("reads a prefix nested one template deep inside the class template", () => {
    const { code, out } = fixture("nested-template");
    expect(out).toContain("`rank-${...}`");
    expect(code).toBe(2);
  });

  it("says nothing about a prefix composed outside a class position", () => {
    const { code, out } = fixture("non-class-template");
    expect(out).not.toContain("UNREGISTERED CLASS PREFIX");
    expect(code).toBe(0);
  });
});

describe("cross-sheet declaration conflicts", () => {
  it("reports one selector given one property two values in two sheets", () => {
    const { code, out } = fixture("cross-sheet");
    expect(out).toContain(".panel { bottom } — 2 values across 2 sheets");
    expect(out).toContain("also declared in scripts/fixtures/deadcss/cross-sheet/src/ui/Panel.css");
    expect(code).toBe(1);
  });

  it("says nothing about a selector two sheets give the SAME value", () => {
    const { out } = fixture("cross-sheet");
    expect(out).not.toContain(".safe-box");
  });

  it("keeps a rule's own declarations when another rule nests inside it", () => {
    const { out } = fixture("cross-sheet");
    expect(out).toContain(".panel-host { color } — 2 values across 2 sheets");
  });

  it("parses a sheet with a comment opener inside a quoted value", () => {
    const { out } = fixture("cross-sheet");
    expect(out).not.toContain("STYLESHEET DOES NOT PARSE");
  });

  it("says nothing about two animations that share a step name", () => {
    const { out } = fixture("cross-sheet");
    expect(out).not.toContain("from { opacity }");
  });
});

describe("the collisions ratchet", () => {
  // Gotcha: the baseline carries one entry under this fixture that nothing there
  // declares, so this run has a vanished conflict to fail on.
  it("fails on a recorded conflict that no longer appears in the tree", () => {
    const { code, out } = fixture("cross-sheet");
    expect(out).toContain("GONE FROM THE TREE");
    expect(out).toContain(".never-declared { color }");
    expect(code).toBe(1);
  });
});

describe("a scan of a tree outside the repository", () => {
  const baselines = () =>
    ["css-collisions-baseline.json", "deadcss-baseline.json"].map((f) => readFileSync(join(ROOT, "design", f), "utf8"));

  function outside(flag) {
    const dir = mkdtempSync(join(tmpdir(), "deadcss-"));
    writeFileSync(join(dir, "a.css"), ".a { color: red; }\n");
    try {
      return run(dir, flag);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("refuses --adopt-conflicts and leaves both baselines byte-identical", () => {
    const before = baselines();
    const { code, out } = outside("--adopt-conflicts");
    expect(out).toContain("NOTHING TO RECORD");
    expect(code).toBe(2);
    expect(baselines()).toEqual(before);
  });

  it("refuses --prune-conflicts and leaves both baselines byte-identical", () => {
    const before = baselines();
    const { code, out } = outside("--prune-conflicts");
    expect(out).toContain("NOTHING TO RECORD");
    expect(code).toBe(2);
    expect(baselines()).toEqual(before);
  });
});

describe("the real tree", () => {
  it("has a DOMAINS entry for every prefix its class positions compose", () => {
    const { code, out } = run();
    expect(out).not.toContain("UNREGISTERED CLASS PREFIX");
    expect(out).toContain("no dead class outside the baseline");
    expect(out).toContain("no cross-sheet conflict outside the baseline");
    expect(code).toBe(0);
  });

  it("records the four-valued .toaster bottom in the collisions baseline", () => {
    const recorded = JSON.parse(readFileSync(join(ROOT, "design", "css-collisions-baseline.json"), "utf8"));
    expect(recorded["src/styles/lorebooks.css"]).toContain(".toaster { bottom }");
    expect(recorded["src/styles/presets.css"]).toContain(".toaster { bottom }");
  });
});
