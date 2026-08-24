// Builders for the memory model's tests.
//
// Every field the wire types require is filled with something inert, so a test
// names only the field it is actually about. A test that reads as five lines of
// scaffolding around one assertion hides which input the behavior depends on.
//
// Cap boundaries are built with repeat() rather than captured from real data:
// a test that turns on a section being exactly SECTION_CAP long should say so
// in the test, not in a fixture file someone has to open to understand it.

import type { Mutation, Note, NoteSection, NoteType, Row } from "../data";

/** Section text of an exact length — the only thing cap tests care about. */
export function chars(n: number): string {
  return "x".repeat(n);
}

export function section(text: string, extra: Partial<NoteSection> = {}): NoteSection {
  return { text, ...extra };
}

let noteSeq = 0;

export function makeNote(over: Partial<Note> = {}): Note {
  noteSeq += 1;
  return {
    id: `note-${noteSeq}`,
    type: "world" as NoteType,
    status: "active",
    modes: [],
    links: [],
    sections: {},
    ...over,
  };
}

let mutSeq = 0;

export function makeMutation(over: Partial<Mutation> = {}): Mutation {
  mutSeq += 1;
  return {
    id: `mut-${mutSeq}`,
    kind: "append_section",
    claimKind: "static",
    risk: "low",
    // Above LOW_CONFIDENCE, so a default mutation carries no flag of its own.
    // A factory whose defaults trip a rule under test makes every test that
    // uses it assert around noise it never asked for.
    confidence: 0.99,
    summary: "summary",
    evidence: [],
    ...over,
  };
}

let rowSeq = 0;

export function makeRow(over: Partial<Row> = {}): Row {
  rowSeq += 1;
  const mutation = over.mutation ?? makeMutation();
  return {
    key: `draft-${rowSeq}:${mutation.id}`,
    draftId: `draft-${rowSeq}`,
    sourceNoteId: "source-1",
    sourceTitle: "Source",
    targetId: "note-target",
    targetTitle: "Target",
    targetType: "world" as NoteType,
    disposition: "new",
    changes: [],
    conflicts: [],
    text: "row text",
    parts: [],
    ...over,
    mutation,
  };
}

/** A row that writes `text` into `key` of `targetId` — the shape every pressure
 *  test needs, without restating the eleven fields pressure never reads. */
export function makeWrite(targetId: string, key: string, text: string, over: Partial<Row> = {}): Row {
  return makeRow({
    targetId,
    parts: [{ key, text }],
    mutation: makeMutation({ kind: "append_section", sectionKey: key, text }),
    ...over,
  });
}

/** Reset the id counters so a test that asserts on generated ids is not
 *  order-dependent on the tests that ran before it. */
export function resetIds() {
  noteSeq = 0;
  mutSeq = 0;
  rowSeq = 0;
}
