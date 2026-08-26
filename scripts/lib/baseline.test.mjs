// The ratchet's scope argument has to do two opposite things, and getting one
// of them wrong is silent. It must shelter entries a narrowed run never looked
// at, and it must NOT shelter entries whose file has been deleted. A scope
// built from the files a run actually opened does the first and fails the
// second, because a deleted file is never opened, so `--prune` keeps its
// entries forever and every baseline accretes ghosts.
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ratchet } from "./baseline.mjs";

let root;
const BASE = () => join(root, "baseline.json");
const read = () => JSON.parse(readFileSync(BASE(), "utf8"));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ratchet-"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "alive.css"), "");
  writeFileSync(join(root, "src", "elsewhere.css"), "");
  writeFileSync(
    BASE(),
    JSON.stringify({
      "src/alive.css": ["one"],
      "src/elsewhere.css": ["two"],
      "src/deleted.css": ["three"],
    }),
  );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

// The scope a run of typescale builds: the files stylelint handed back.
const opened = (...files) => (f) => new Set(files).has(f);

describe("an entry whose file has been deleted", () => {
  it("is reported as vanished even though no run can open it", () => {
    const { vanished } = ratchet(BASE(), [{ file: "src/alive.css", item: "one" }], {
      root,
      scope: opened("src/alive.css"),
    });
    expect(vanished).toEqual([{ file: "src/deleted.css", item: "three" }]);
  });

  it("is dropped by --prune", () => {
    ratchet(BASE(), [{ file: "src/alive.css", item: "one" }], {
      root,
      prune: true,
      scope: opened("src/alive.css"),
    });
    expect(read()).not.toHaveProperty("src/deleted.css");
  });
});

describe("an entry whose file is merely out of this run's scope", () => {
  it("is not called vanished", () => {
    const { vanished } = ratchet(BASE(), [{ file: "src/alive.css", item: "one" }], {
      root,
      scope: opened("src/alive.css"),
    });
    expect(vanished.map((v) => v.file)).not.toContain("src/elsewhere.css");
  });

  it("survives --prune", () => {
    ratchet(BASE(), [{ file: "src/alive.css", item: "one" }], {
      root,
      prune: true,
      scope: opened("src/alive.css"),
    });
    expect(read()["src/elsewhere.css"]).toEqual(["two"]);
  });
});

describe("an entry in scope whose finding is gone", () => {
  it("is still reported and pruned, which is the ratchet's ordinary job", () => {
    const { vanished } = ratchet(BASE(), [], { root, prune: true, scope: opened("src/alive.css") });
    expect(vanished).toContainEqual({ file: "src/alive.css", item: "one" });
    expect(read()).not.toHaveProperty("src/alive.css");
  });
});
