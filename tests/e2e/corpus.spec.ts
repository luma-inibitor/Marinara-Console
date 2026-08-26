// The fixture corpus, parsed with the app's own schemas.
//
// COVERAGE, PLAINLY: this covers the memory fixtures and nothing else. Only
// three files in src/tools/memory/api/ have valibot schemas — `grep -rln
// valibot src` — so there is nothing to parse a lorebook entry, a preset or a
// preset section against. Those fixtures are guarded by their TypeScript types
// where the wire shape allows it (tests/e2e/fixtures/lorebooks.ts) and not at
// all where it does not (tests/e2e/fixtures/presets.ts, which is in the
// engine's raw string-typed wire form by necessity). Do not read a green run
// here as the corpus being schema-checked.
//
// The value of parsing here rather than only in the browser is the failure
// message. `harness.ts` fails a screen when the running app logs a `[wire]`
// mismatch, but only for a response that screen consumed and only after a page
// load; this names the field, in milliseconds, before a browser starts.
//
// It runs in its own project, without a viewport, because the corpus does not
// change between viewports and four identical failures name one fault.

import * as v from "valibot";
import { expect, test } from "@playwright/test";
import { NoteSchema, ReviewResponseSchema } from "../../src/tools/memory/api/schema";
import { NOTES, REVIEW } from "./fixtures/memory";
import { SCREENS } from "./screens";

test("every note parses as the app parses it", () => {
  for (const note of NOTES) {
    const result = v.safeParse(NoteSchema, note);
    expect(issues(result), `note ${note.id}`).toEqual([]);
  }
});

test("the review response parses as the app parses it", () => {
  expect(issues(v.safeParse(ReviewResponseSchema, REVIEW))).toEqual([]);
});

// The vault's row count is a rule applied to this corpus — archived memories
// and source notes are not listed — so stating it in two places is a check, not
// a repetition. Adding a memory here without moving the count in screens.ts
// fails at this line rather than four times over in a browser.
test("the corpus holds exactly what the vault is expected to list", () => {
  const vault = SCREENS.find((s) => s.name === "memory-vault")!;
  const listed = NOTES.filter((n) => n.type !== "source" && n.status !== "archived");
  expect(listed).toHaveLength(vault.rows);
});

function issues(result: v.SafeParseResult<v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>): string[] {
  if (result.success) return [];
  return result.issues.map((issue) => {
    const path = v.getDotPath(issue);
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
