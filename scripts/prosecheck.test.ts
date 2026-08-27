// The two pieces of prosecheck that are ours rather than Vale's: reading added
// line numbers out of a unified diff, and building the symlink shim that gets
// a .mjs file past Vale's extension table.
//
// Running Vale itself is deliberately not covered. The binary is not a
// devDependency — README.md tells you to install it — so a spec that shelled
// out to it would fail on every machine that had not, which is a check on the
// installation and not on this file.
import { afterAll, describe, expect, it } from "vitest";
import { lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { linkTargets, parseAddedLines } from "./prosecheck.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "prosecheck-spec-"));
  dirs.push(dir);
  return dir;
}

describe("parseAddedLines", () => {
  it("reads one line from a hunk header that omits its count", () => {
    const diff = ["--- a/README.md", "+++ b/README.md", "@@ -4 +4 @@", "+one line"].join("\n");
    expect(parseAddedLines(diff)).toEqual(new Map([["README.md", new Set([4])]]));
  });

  it("reads a counted run of added lines", () => {
    const diff = ["--- a/a.ts", "+++ b/a.ts", "@@ -10,0 +11,3 @@", "+x", "+y", "+z"].join("\n");
    expect(parseAddedLines(diff)).toEqual(new Map([["a.ts", new Set([11, 12, 13])]]));
  });

  it("unions every hunk in one file and keeps files apart", () => {
    const diff = [
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1,0 +2,2 @@",
      "+x",
      "+y",
      "@@ -9,0 +12 @@",
      "+z",
      "--- a/b.mjs",
      "+++ b/b.mjs",
      "@@ -1,0 +5 @@",
      "+q",
    ].join("\n");
    expect(parseAddedLines(diff)).toEqual(
      new Map([
        ["a.ts", new Set([2, 3, 12])],
        ["b.mjs", new Set([5])],
      ]),
    );
  });

  it("drops a file whose hunks only delete", () => {
    const diff = ["--- a/gone.md", "+++ b/gone.md", "@@ -3,2 +2,0 @@", "-x", "-y"].join("\n");
    expect(parseAddedLines(diff)).toEqual(new Map());
  });

  it("returns nothing for an empty diff", () => {
    expect(parseAddedLines("")).toEqual(new Map());
  });
});

describe("linkTargets", () => {
  it("passes a natively supported file through untouched", () => {
    const dir = scratch();
    expect(linkTargets(["src/a.ts", "README.md"], dir)).toEqual(
      new Map([
        ["src/a.ts", "src/a.ts"],
        ["README.md", "README.md"],
      ]),
    );
  });

  it("links a .mjs file to a .js name that maps back to the original", () => {
    const dir = scratch();
    const targets = linkTargets(["scripts/checks.mjs"], dir);
    const link = join(dir, "scripts/checks.js");

    expect(targets).toEqual(new Map([[link, "scripts/checks.mjs"]]));
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readFileSync(link, "utf8")).toBe(readFileSync(resolve("scripts/checks.mjs"), "utf8"));
  });

  it("keeps two files of the same basename apart by mirroring the tree", () => {
    const dir = scratch();
    const targets = linkTargets(["scripts/baseline.mjs", "scripts/lib/baseline.mjs"], dir);
    expect([...targets.keys()]).toEqual([
      join(dir, "scripts/baseline.js"),
      join(dir, "scripts/lib/baseline.js"),
    ]);
  });

  it("links a .cjs file as well", () => {
    const dir = scratch();
    expect(linkTargets(["tool.cjs"], dir)).toEqual(new Map([[join(dir, "tool.js"), "tool.cjs"]]));
  });
});
