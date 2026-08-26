// Each case below is one way a deleted field, the licence, the script order or
// the deduplicated .gitignore comes back.
import { afterAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(target) {
  const r = spawnSync("node", [join(ROOT, "scripts", "pkgcheck.mjs"), ...(target ? [target] : [])], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const fixtures = [];
afterAll(() => {
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true });
});

function fixture({ pkg = {}, gitignore = "dist/\nshots/\n" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pkgcheck-"));
  fixtures.push(dir);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", license: "UNLICENSED", ...pkg }));
  writeFileSync(join(dir, ".gitignore"), gitignore);
  return dir;
}

describe("the real repository", () => {
  const { code, out } = run();

  it("passes", () => {
    expect(out).toContain("package.json clean");
    expect(code).toBe(0);
  });
});

describe("the root argument", () => {
  it("accepts a relative path", () => {
    const { code, out } = run(relative(ROOT, fixture({ pkg: { author: "" } })));
    expect(out).toContain('package.json still has "author"');
    expect(code).toBe(1);
  });

  it("accepts an absolute path", () => {
    const { code, out } = run(fixture());
    expect(out).toContain("package.json clean");
    expect(code).toBe(0);
  });
});

describe("a deleted field that came back", () => {
  for (const field of ["main", "description", "keywords", "author"]) {
    it(`reports "${field}"`, () => {
      const { code, out } = run(fixture({ pkg: { [field]: "" } }));
      expect(out).toContain(`package.json still has "${field}"`);
      expect(code).toBe(1);
    });
  }

  it("reports a field even when it holds a real value", () => {
    const { code, out } = run(fixture({ pkg: { description: "a console" } }));
    expect(out).toContain('package.json still has "description"');
    expect(code).toBe(1);
  });
});

describe("the licence", () => {
  it("reports an absent one", () => {
    const { code, out } = run(fixture({ pkg: { license: undefined } }));
    expect(out).toContain('package.json declares license null, not "UNLICENSED"');
    expect(code).toBe(1);
  });

  it("reports an empty one", () => {
    const { code } = run(fixture({ pkg: { license: "  " } }));
    expect(code).toBe(1);
  });

  it("reports the ISC this repository replaced", () => {
    const { code, out } = run(fixture({ pkg: { license: "ISC" } }));
    expect(out).toContain('package.json declares license "ISC", not "UNLICENSED"');
    expect(code).toBe(1);
  });
});

describe("the script order", () => {
  it("reports a script appended out of alphabetical order", () => {
    const scripts = { build: "vite build", verify: "node x.mjs", pkgcheck: "node y.mjs" };
    const { code, out } = run(fixture({ pkg: { scripts } }));
    expect(out).toContain('package.json lists script "pkgcheck" after "verify", out of alphabetical order');
    expect(code).toBe(1);
  });

  it("passes an alphabetical list", () => {
    const scripts = { build: "vite build", pkgcheck: "node y.mjs", verify: "node x.mjs" };
    const { code, out } = run(fixture({ pkg: { scripts } }));
    expect(out).toContain("package.json clean");
    expect(code).toBe(0);
  });

  it("passes a package.json with no scripts at all", () => {
    const { code } = run(fixture());
    expect(code).toBe(0);
  });
});

describe("a repeated .gitignore pattern", () => {
  it("names the pattern and both lines", () => {
    const { code, out } = run(fixture({ gitignore: "dist/\nshots/\nnode_modules/\nshots/\n" }));
    expect(out).toContain('.gitignore repeats "shots/" on lines 2 and 4');
    expect(code).toBe(1);
  });

  it("does not treat a comment or a blank line as a repeat", () => {
    const { code, out } = run(fixture({ gitignore: "# one\ndist/\n\n# one\n\nshots/\n" }));
    expect(out).toContain("package.json clean");
    expect(code).toBe(0);
  });

  it("keeps a directory pattern distinct from the bare name", () => {
    const { code } = run(fixture({ gitignore: ".decisions/\n.decisions\n" }));
    expect(code).toBe(0);
  });
});

describe("an input the check cannot read", () => {
  it("exits 2 rather than reading as a clean run", () => {
    const { code, out } = run(join("scripts", "fixtures", "pkgcheck-nothing-here"));
    expect(out).toContain("INTEGRITY FAILURE");
    expect(code).toBe(2);
  });
});
