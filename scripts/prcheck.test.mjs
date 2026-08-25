// The pull request rules, in both directions.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bodyProblems } from "./prcheck.mjs";

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
  "On a phone, the review queue's header took up so much room that only seven claims fit on screen, and it repeated the keep/drop counts the dock already showed. This moves filtering, grouping and sorting into three sheets behind a single row, so the list gets the space back.",
];

describe("openings that pass", () => {
  it.each(REAL_OPENINGS)("accepts a real opening: %s", (opening) => {
    expect(bodyProblems(`${opening}\n\n## What changed\n\n- \`src/x.ts\` does the thing.`)).toEqual([]);
  });

  it("ignores an HTML comment above the opening", () => {
    expect(bodyProblems(`<!-- a template note -->\n\n${REAL_OPENINGS[0]}`)).toEqual([]);
  });
});

describe("openings that fail", () => {
  it.each([
    ["", "the body is empty"],
    ["## Summary\n\nIt was broken. Now it is not.", "a heading, list or code fence"],
    ["- It was broken. Now it is not.", "a heading, list or code fence"],
    ["```\nit was broken\n```", "a heading, list or code fence"],
    ["Fixes the undo window on archived memories.", "one sentence"],
    ["The bug was in `Toaster`. This fixes it in the toast helper too.", "a code span"],
    ["The bug came in with #54. This fixes it and adds a test for the window.", "a `#123` cross-reference"],
    ["The bug was in Toaster.tsx. This fixes it and adds a test for the window.", "a file name"],
    ["The bug was in src/ui/Toaster. This fixes it and adds a test for the window.", "a file path"],
  ])("rejects %s", (body, what) => {
    expect(bodyProblems(body).join("\n")).toContain(what);
  });
});

describe("the check as run", () => {
  it("passes a conventional title with a good opening", () => {
    const { code, out } = run("fix: give an already-landed undo the same window", REAL_OPENINGS[0]);
    expect(out).toContain("title is conventional");
    expect(code).toBe(0);
  });

  it("rejects a title that would land unconventional on a squash merge", () => {
    const { code, out } = run("Give undo the same window", REAL_OPENINGS[0]);
    expect(out).toContain("TITLE breaks Conventional Commits");
    expect(code).toBe(1);
  });

  it("rejects a one-sentence body", () => {
    const { code, out } = run("fix: a thing", "Fixed it.");
    expect(out).toContain("one sentence");
    expect(code).toBe(1);
  });

  it("exits 2 rather than passing when there is no event payload", () => {
    const r = spawnSync("node", [join(ROOT, "scripts", "prcheck.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, GITHUB_EVENT_PATH: "" },
    });
    expect(r.stdout + r.stderr).toContain("CANNOT CHECK");
    expect(r.status).toBe(2);
  });
});
