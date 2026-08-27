// A document that names a deleted script reads as instructions and is a dead
// end. Wave 3 deleted four scripts and left nine such names behind.
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { docRefs } from "./docrefs.mjs";

let root;
const write = (rel, text) => writeFileSync(join(root, rel), text);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "docrefs-"));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "design"));
  write("scripts/real.mjs", "");
  write("package.json", JSON.stringify({ scripts: { lint: "eslint ." } }));
  write("README.md", "Run `scripts/real.mjs` and `npm run lint`.\n");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

it("passes when every name has something behind it", () => {
  expect(docRefs(root).findings).toEqual([]);
});

it("reports a script the tree does not have", () => {
  write("design/BRIEFING.md", "Run `scripts/gone.mjs` for this.\n");
  expect(docRefs(root).findings).toEqual([{ doc: "design/BRIEFING.md", name: "scripts/gone.mjs" }]);
});

it("reports an npm script package.json does not have", () => {
  write("design/DESIGN.md", "Run `npm run verify` first.\n");
  expect(docRefs(root).findings).toEqual([{ doc: "design/DESIGN.md", name: "npm run verify" }]);
});

describe("what it deliberately does not read", () => {
  it("ignores BACKLOG.md, which quotes other projects and past measurements", () => {
    write("BACKLOG.md", "Their `scripts/lint-copy.mjs` is not mechanical.\n");
    expect(docRefs(root).findings).toEqual([]);
  });
});
