// The pull request rules, in both directions.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bodyProblems, countSentences, openingOf } from "./prcheck.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(title, body) {
  const r = spawnSync("node", [join(ROOT, "scripts", "prcheck.mjs"), "--title", title, "--body", body], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

// Real openings, so a rule that fires on a good one fails here first.
const REAL_OPENINGS = [
  "Undo on an archived memory stopped working a few seconds before the message offering it disappeared, and nothing on screen showed that the window had closed. This gives those toasts the full undo window and the countdown that goes with it.",
  "Keywords you add to a memory by hand can silently stop working: the engine only ever matches on the first thirty of a note's keywords, and the ones it generated itself take those slots first. This teaches the console that limit and gives it a way to count the keywords that are stored but never used, so nothing changes on screen yet.",
  "On a phone, the review queue's header took up so much room that only seven claims fit on screen, and it repeated the keep/drop counts the dock already showed. This moves filtering, grouping and sorting into three sheets behind a single row, so the list gets the space back.",
];

describe("openings that pass", () => {
  it.each(REAL_OPENINGS)("accepts a real opening: %s", (opening) => {
    expect(bodyProblems(`${opening}\n\n## What changed\n\n- \`src/x.ts\` does the thing.`)).toEqual([]);
  });

  it("checks the opening paragraph only", () => {
    const body = `${REAL_OPENINGS[0]}\n\nFixes #12 in \`src/ui/Toaster.tsx\`, where \`onExpire\` was the tell.`;
    expect(bodyProblems(body)).toEqual([]);
  });

  it("ignores an HTML comment above the opening", () => {
    expect(bodyProblems(`<!-- a template note -->\n\n${REAL_OPENINGS[1]}`)).toEqual([]);
  });

  it("does not count an abbreviation's period as a sentence end", () => {
    expect(countSentences("The importer drops rows, e.g. a row with no id.")).toBe(1);
  });
});

describe("openings that fail", () => {
  it("rejects an empty body", () => {
    expect(bodyProblems("")).toEqual([expect.stringContaining("the body is empty")]);
  });

  it.each([
    ["## Summary\n\nIt was broken. Now it is not.", "a heading"],
    ["- It was broken. Now it is not.", "a bullet"],
    ["| a | b |\n|---|---|", "a table"],
    ["```\nit was broken\n```", "a code fence"],
    ["> It was broken. Now it is not.", "a quote"],
  ])("rejects a body opening with %s", (body, what) => {
    expect(bodyProblems(body)).toEqual([expect.stringContaining(what)]);
  });

  it("rejects a one-sentence opening", () => {
    expect(bodyProblems("Fixes the undo window on archived memories.")).toEqual([
      expect.stringContaining("one sentence"),
    ]);
  });

  it.each([
    ["The bug was in `Toaster.tsx`. This fixes it in the toast helper too.", "a code span"],
    ["The bug came in with #54. This fixes it and adds a test for the window.", "a `#123` cross-reference"],
    ["The bug was in Toaster.tsx. This fixes it and adds a test for the window.", "a file name"],
    ["The bug was in src/ui/Toaster. This fixes it and adds a test for the window.", "a file path"],
    ["The tally came from onExpire. This reads it from the toast options instead.", "a camelCase identifier"],
    ["The tally came from item_draft. This reads it from the toast options instead.", "a snake_case identifier"],
    ["The tally came from accounting(). This reads it from the toast options instead.", "a function call"],
  ])("rejects an opening naming %s", (body, what) => {
    expect(bodyProblems(body).join("\n")).toContain(what);
  });
});

describe("the title", () => {
  it("passes a conventional title with a good opening", () => {
    const { code, out } = run("fix: give an already-landed undo the same window", REAL_OPENINGS[0]);
    expect(out).toContain("title is conventional");
    expect(code).toBe(0);
  });

  it("rejects a title that would land unconventional on a squash merge", () => {
    const { code, out } = run("Give undo the same window", REAL_OPENINGS[0]);
    expect(out).toContain("TITLE breaks Conventional Commits");
    expect(out).toContain("squash merge");
    expect(code).toBe(1);
  });

  it("shows a correct opening when the body fails", () => {
    const { code, out } = run("fix: a thing", "Fixed it.");
    expect(out).toContain("Example opening:");
    expect(code).toBe(1);
  });
});

describe("running out of context", () => {
  it("exits 2 rather than passing when there is no event payload", () => {
    const r = spawnSync("node", [join(ROOT, "scripts", "prcheck.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, GITHUB_EVENT_PATH: "" },
    });
    expect(r.stdout + r.stderr).toContain("CANNOT CHECK");
    expect(r.status).toBe(2);
  });

  it("treats the text before the first blank line as the opening", () => {
    expect(openingOf("One line.\nStill the same paragraph.\n\nLater.").paragraph).toBe(
      "One line.\nStill the same paragraph.",
    );
  });
});
