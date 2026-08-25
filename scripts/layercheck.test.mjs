// Every rule layercheck enforces, run against a fixture tree that breaks it and
// one that does not. A rule with no fixture can be disabled by an edit and stay
// green.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(...args) {
  const r = spawnSync("node", [join(ROOT, "scripts", "layercheck.mjs"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const fixture = (name) => run(join("scripts", "fixtures", "layercheck", name));

describe("rule 1 · direction", () => {
  it("passes a tree whose every value import points downward", () => {
    const { code, out } = fixture("clean");
    expect(out).toContain("every value import points downward");
    expect(code).toBe(0);
  });

  it("fails the model value-importing an endpoints constant", () => {
    const { code, out } = fixture("model-to-endpoints");
    expect(out).toContain("model → endpoints");
    expect(out).toContain("SECTION_CAP");
    expect(code).toBe(1);
  });

  it("passes the model naming an endpoints type", () => {
    const { code, out } = fixture("model-to-endpoints-type-only");
    expect(out).toContain("every value import points downward");
    expect(code).toBe(0);
  });

  it("fails state reaching presentation", () => {
    const { code, out } = fixture("state-to-presentation");
    expect(out).toContain("state → presentation");
    expect(code).toBe(1);
  });

  it("fails endpoints reaching the model", () => {
    const { code, out } = fixture("endpoints-to-model");
    expect(out).toContain("endpoints → model");
    expect(code).toBe(1);
  });
});

describe("rule 2 · ownership", () => {
  it("fails presentation importing api/ directly", () => {
    const { code, out } = fixture("presentation-to-endpoints");
    expect(out).toContain("presentation reaches api/ directly");
    expect(code).toBe(1);
  });

  it("fails presentation importing the transport client", () => {
    const { code, out } = fixture("presentation-to-transport");
    expect(out).toContain("presentation reaches the transport client");
    expect(code).toBe(1);
  });

  it("fails the global fetch outside the transport layer", () => {
    const { code, out } = fixture("fetch-outside-transport");
    expect(out).toContain("the global fetch() outside the transport layer");
    expect(code).toBe(1);
  });
});

describe("path arguments", () => {
  it("reads the same files whether the path is absolute or relative", () => {
    const relative = fixture("clean").out;
    const absolute = run(join(ROOT, "scripts", "fixtures", "layercheck", "clean")).out;
    expect(absolute).toBe(relative);
  });

  it("exits 2 when a path argument matches no source file", () => {
    const { code, out } = run("scripts/fixtures/layercheck/does-not-exist");
    expect(out).toContain("NOTHING TO CHECK");
    expect(code).toBe(2);
  });
});
