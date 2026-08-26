// A rule without a fixture is a rule that can be disabled by an edit and stay
// green. The cases worth pinning are the ones a regex gets wrong: a literal
// that sits exactly on a step is still a finding, a computed size is a size the
// scale cannot name, a nested rule owns its own selector rather than the
// at-rule above it, and a property whose name merely ends in "font-size" is
// not one.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import stylelint from "stylelint";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(...args) {
  const r = spawnSync("node", [join(ROOT, "scripts", "typescale.mjs"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

describe("what counts as a literal size", () => {
  const { code, out } = run(join("scripts", "fixtures", "typescale", "mixed"));

  it("passes a font-size that names a token", () => {
    expect(out).not.toContain(".tokened");
  });

  it("reports a literal that happens to sit on a step, and names the token for it", () => {
    expect(out).toContain(".on-scale → 11px");
    expect(out).toContain("--fs-data-s");
  });

  it("marks a size the scale cannot name", () => {
    expect(out).toContain(".off-scale → 13px   OFF THE SCALE");
  });

  it("treats a computed size as a size the scale cannot name", () => {
    expect(out).toContain(".computed → clamp(11px, 2vw, 14px)");
  });

  it("gives a nested rule its own selector, not the at-rule above it", () => {
    expect(out).toContain("@media (min-width: 900px) .nested → 9px");
  });

  it("ignores a custom property that merely mentions the words", () => {
    expect(out).not.toContain("--my-font-size");
    expect(out).not.toContain(".decoy");
  });

  it("fails on findings outside the baseline", () => {
    expect(code).toBe(1);
  });
});

describe("the baseline ratchet", () => {
  it("passes the real tree, whose literals are all recorded", () => {
    const { code, out } = run();
    expect(out).toContain("no literal font-size outside the baseline");
    expect(code).toBe(0);
  });
});

describe("a stylesheet the parser cannot read", () => {
  const fixture = join("scripts", "fixtures", "typescale", "unparsable");

  it("exits 2 rather than reading as a clean run", () => {
    const { code, out } = run(fixture);
    expect(out).toContain("INTEGRITY FAILURE");
    expect(code).toBe(2);
  });

  it("arrives as a CssSyntaxError warning while parseErrors stays empty", async () => {
    const { results } = await stylelint.lint({ cwd: ROOT, files: [`${fixture}/**/*.css`] });
    expect(results[0].parseErrors).toEqual([]);
    expect(results[0].warnings.some((w) => w.rule === "CssSyntaxError")).toBe(true);
  });
});
