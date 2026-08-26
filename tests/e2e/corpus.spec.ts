// The fixture corpus, parsed with the app's own schemas.
//
// Gotcha: this covers the MEMORY fixtures only. Just three files in
// src/tools/memory/api/ have valibot schemas, so nothing here parses a lorebook
// entry, a preset or a preset section. A green run is not the corpus being
// schema-checked.
//
// Runs without a viewport: the corpus does not change between them.

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
