// Fixtures are shaped from real dev-engine responses with the contents
// replaced, so an "accepts" case failing means the schema drifted, not the
// fixture.

import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { MutationSchema, NoteSchema, ReviewResponseSchema } from "./schema";

const ok = (schema: Parameters<typeof v.safeParse>[0], value: unknown) => v.safeParse(schema, value).success;

const note = () => ({
  id: "char_example",
  title: "Example",
  type: "character",
  status: "active",
  modes: ["roleplay"],
  scope: { characterIds: ["abc123"] },
  tags: ["typed_memory", "character"],
  keywords: ["example"],
  manualKeywords: [],
  suppressedKeywords: [],
  createdAt: "2026-08-21T19:48:28.561Z",
  updatedAt: "2026-08-21T19:48:28.561Z",
  version: 3,
  links: [{ target: "source_example", relation: "extracted_from" }],
  sections: {
    voice: {
      text: "- Speaks in questions.",
      updatedAt: "2026-08-21T19:48:28.561Z",
      salience: 0.85,
      confidence: 0.82,
      importance: "moderate",
      evidence: ["source_note:source_example"],
      contributions: [],
      dimensions: {},
    },
  },
  subjects: [{ key: "character:abc123", ref: { kind: "character", id: "abc123" } }],
});

describe("NoteSchema", () => {
  it("accepts a memory in the shape the live engine sends", () => {
    expect(ok(NoteSchema, note())).toBe(true);
  });

  it("keeps the fields it does not name, rather than stripping them", () => {
    const parsed = v.parse(NoteSchema, note());
    expect(parsed.scope).toEqual({ characterIds: ["abc123"] });
    expect(parsed.createdAt).toBe("2026-08-21T19:48:28.561Z");
    expect((parsed.sections.voice as { salience?: number }).salience).toBe(0.85);
  });

  it("accepts a field the engine has not shipped yet", () => {
    expect(ok(NoteSchema, { ...note(), somethingNewUpstream: { nested: true } })).toBe(true);
  });

  it("accepts a subject with no resolved ref", () => {
    expect(ok(NoteSchema, { ...note(), subjects: [{ key: "npc:watson" }] })).toBe(true);
  });

  it("rejects a subject sent as a bare string", () => {
    expect(ok(NoteSchema, { ...note(), subjects: ["character:abc123"] })).toBe(false);
  });

  it("accepts a memory with no subjects, which is most of them", () => {
    const { subjects, ...rest } = note();
    void subjects;
    expect(ok(NoteSchema, rest)).toBe(true);
  });

  it("accepts an empty section map", () => {
    expect(ok(NoteSchema, { ...note(), sections: {} })).toBe(true);
  });

  // A memory with no usable id keys `notesById` under `undefined`.
  it("rejects a memory with no id", () => {
    const { id, ...rest } = note();
    void id;
    expect(ok(NoteSchema, rest)).toBe(false);
  });

  it("rejects a memory whose id is empty", () => {
    expect(ok(NoteSchema, { ...note(), id: "" })).toBe(false);
  });

  it("rejects a write envelope handed over as if it were a memory", () => {
    expect(ok(NoteSchema, { note: note(), rebuild: {} })).toBe(false);
  });

  it("rejects a memory type the copy catalog cannot label", () => {
    expect(ok(NoteSchema, { ...note(), type: "faction" })).toBe(false);
  });

  it("rejects a status the copy catalog cannot label", () => {
    expect(ok(NoteSchema, { ...note(), status: "pending" })).toBe(false);
  });

  it("rejects a section whose text is missing", () => {
    expect(ok(NoteSchema, { ...note(), sections: { voice: { importance: "moderate" } } })).toBe(false);
  });
});

const mutation = () => ({
  id: "a4ee5529-bf35-4187-b72c-63f9fcd961dc",
  claimKind: "change",
  risk: "low",
  confidence: 0.96,
  summary: "Create timeline_event memory",
  evidence: ["source_note:source_example"],
  kind: "create_note",
  importance: "moderate",
  salience: 0.7,
  note: note(),
});

describe("MutationSchema", () => {
  it("accepts a create_note mutation carrying a whole memory", () => {
    expect(ok(MutationSchema, mutation())).toBe(true);
  });

  it("accepts the scoring fields the engine attaches and the console ignores", () => {
    const parsed = v.parse(MutationSchema, mutation());
    expect(parsed.salience).toBe(0.7);
  });

  it("rejects a mutation kind the console has no operation for", () => {
    expect(ok(MutationSchema, { ...mutation(), kind: "delete_note" })).toBe(false);
  });

  it("rejects a mutation whose confidence arrived as a string", () => {
    expect(ok(MutationSchema, { ...mutation(), confidence: "0.96" })).toBe(false);
  });
});

const review = () => ({
  generatedAt: "2026-08-24T01:00:00.000Z",
  sources: [{
    sourceNoteId: "source_example",
    modes: ["roleplay"],
    drafts: [{
      draft: {
        id: "draft-1",
        status: "pending",
        mutations: [mutation()],
        source: { sourceNoteId: "source_example" },
        applyState: "idle",
        reviewRequired: true,
        scope: {},
        accounting: {},
      },
      freshness: "fresh",
      blockReasons: [],
      diagnostics: [{ code: "x", severity: "info" }],
      candidateRejections: [{ reason: "invalid_format", message: "no", snippet: "…", index: 3 }],
      deduplications: [],
    }],
    targets: [{
      noteId: "note-1",
      title: "Example",
      noteType: "world",
      rows: [{
        draftId: "draft-1",
        mutation: mutation(),
        disposition: "merge",
        diagnostics: [],
        changes: [{ kind: "section", key: "voice", before: "a", after: "b" }],
      }],
    }],
  }],
  counts: { sources: 1, drafts: 1, mutations: 1, blockedDrafts: 0, candidateRejections: 1, deduplications: 0 },
});

describe("ReviewResponseSchema", () => {
  it("accepts the queue in the shape the live engine sends", () => {
    expect(ok(ReviewResponseSchema, review())).toBe(true);
  });

  it("accepts a queue with no sources", () => {
    expect(ok(ReviewResponseSchema, { ...review(), sources: [], counts: { sources: 0, drafts: 0, mutations: 0, blockedDrafts: 0, candidateRejections: 0, deduplications: 0 } })).toBe(true);
  });

  it("keeps the draft fields it does not name", () => {
    const parsed = v.parse(ReviewResponseSchema, review());
    expect(parsed.sources[0].drafts[0].draft.applyState).toBe("idle");
    expect(parsed.sources[0].drafts[0].deduplications).toEqual([]);
  });

  it("rejects a queue with no counts", () => {
    const { counts, ...rest } = review();
    void counts;
    expect(ok(ReviewResponseSchema, rest)).toBe(false);
  });

  it("rejects a count sent as a string", () => {
    expect(ok(ReviewResponseSchema, { ...review(), counts: { ...review().counts, drafts: "1" } })).toBe(false);
  });

  it("rejects a disposition the review screen has no column for", () => {
    const bad = review();
    bad.sources[0].targets[0].rows[0].disposition = "replace";
    expect(ok(ReviewResponseSchema, bad)).toBe(false);
  });
});
