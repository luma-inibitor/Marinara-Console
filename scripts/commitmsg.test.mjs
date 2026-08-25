// The commit subject rule, in both directions.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { conventionalProblem, subjectOf } from "./lib/conventional.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(...args) {
  const r = spawnSync("node", [join(ROOT, "scripts", "commitmsg.mjs"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

describe("subjects that pass", () => {
  it.each([
    "feat: add a thing",
    "fix(memory): drop the stale keyword tally",
    "refactor!: rename the note store",
    "chore(deps)!: move to vite 8",
    "ci: run the conventions workflow on edits",
  ])("accepts %s", (subject) => {
    expect(conventionalProblem(subject)).toBeNull();
  });

  it.each([
    "Merge pull request #12 from luma-inibitor/x",
    'Revert "feat: add a thing"',
    "fixup! feat: add a thing",
  ])("skips git's own wording: %s", (subject) => {
    expect(run("--message", subject).code).toBe(0);
  });
});

describe("subjects that fail", () => {
  it.each([
    ["Add a thing", "no `type: description` prefix"],
    ["feat:add a thing", "no space after the colon"],
    ["feat: ", "no description after the type"],
    ["style: nudge the padding", "`style` is not a type used here"],
    ["Feat: add a thing", "type `Feat` must be lowercase `feat`"],
    ["feat(): add a thing", "the scope parentheses are empty"],
    ["fix: add a thing.", "the description ends with a period"],
  ])("rejects %s", (subject, problem) => {
    expect(conventionalProblem(subject)).toBe(problem);
    const { code, out } = run("--message", subject);
    expect(code).toBe(1);
    expect(out).toContain(problem);
  });

  it("names the rule and shows a correct example", () => {
    const { out } = run("--message", "just some words");
    expect(out).toContain("type(optional-scope): description");
    expect(out).toContain("feat(memory): flag keywords the engine has stopped indexing");
    expect(out).toContain("--no-verify");
  });
});

describe("the message git hands the hook", () => {
  it("reads the subject past comment lines and the verbose diff", () => {
    const message = [
      "# Please enter the commit message for your changes.",
      "feat: add a thing",
      "",
      "A body.",
      "# ------------------------ >8 ------------------------",
      "diff --git a/feat: nope b/x",
    ].join("\n");
    expect(subjectOf(message)).toBe("feat: add a thing");
  });
});

describe("running out of range", () => {
  it("exits 2 rather than passing when given nothing to check", () => {
    const { code, out } = run();
    expect(out).toContain("CANNOT CHECK");
    expect(code).toBe(2);
  });

  it("exits 2 when the range names no commits", () => {
    const { code, out } = run("--range", "HEAD..HEAD");
    expect(out).toContain("CANNOT CHECK");
    expect(code).toBe(2);
  });
});
