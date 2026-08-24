// Characterization of the payload -> Row transform.
//
// `flattenReview` is the only place the console's Row comes into existence, and
// several of its outputs are contracts other modules depend on by hand: the
// `draftId:mutationId` key is rebuilt as a string elsewhere, `parts` is what the
// pressure pass charges against a section, and `text` is what the queue reads
// out. These tests pin what the code does today, derived by reading it — where
// a reading looks wrong the test says so with `SUSPECT:` and still asserts the
// real behavior.
//
// `mutationText` and `mutationParts` are module-private, so they are reached
// through `row.text` and `row.parts`. The ReviewResponse builders below are
// local on purpose: they are wire scaffolding, not model fixtures, and nothing
// else needs them.

import { beforeEach, describe, expect, it } from "vitest";

import type { Mutation, ReviewResponse } from "../api/types";
import { flattenReview, sectionTextOf } from "./review";
import { chars, makeMutation, makeNote, resetIds, section } from "../test/factories";

type Source = ReviewResponse["sources"][number];
type Draft = Source["drafts"][number];
type Target = Source["targets"][number];
type WireRow = Target["rows"][number];

function wireRow(draftId: string, mutation: Mutation, over: Partial<WireRow> = {}): WireRow {
  return { draftId, mutation, disposition: "new", diagnostics: [], changes: [], ...over };
}

function draft(id: string, mutations: Mutation[], over: Partial<Draft> = {}): Draft {
  return {
    draft: { id, status: "pending", mutations },
    freshness: "fresh",
    blockReasons: [],
    diagnostics: [],
    candidateRejections: [],
    ...over,
  };
}

function target(noteId: string, rows: WireRow[], over: Partial<Target> = {}): Target {
  return { noteId, noteType: "world", rows, ...over };
}

function source(sourceNoteId: string, drafts: Draft[], targets: Target[]): Source {
  return { sourceNoteId, modes: [], drafts, targets };
}

function response(...sources: Source[]): ReviewResponse {
  return {
    generatedAt: "2026-01-01T00:00:00Z",
    sources,
    // Nothing in flattenReview reads counts; the engine sends them regardless.
    counts: { sources: sources.length, drafts: 0, mutations: 0, blockedDrafts: 0, candidateRejections: 0, deduplications: 0 },
  };
}

/** One source, one draft, one target, one row — the shape most of these tests
 *  want, so an assertion names only the thing it is about. */
function oneRow(m: Mutation, over: { target?: Partial<Target>; row?: Partial<WireRow> } = {}) {
  const data = response(
    source("s1", [draft("d1", [m])], [target("n1", [wireRow("d1", m, over.row)], over.target)]),
  );
  return flattenReview(data, new Map()).rows[0]!;
}

beforeEach(resetIds);

describe("sectionTextOf", () => {
  it("prefers section.text over text on update_section", () => {
    const m = makeMutation({ kind: "update_section", text: "wire", section: section("edited") });
    expect(sectionTextOf(m)).toBe("edited");
  });

  it("prefers section.text over text on append_section", () => {
    const m = makeMutation({ kind: "append_section", text: "wire", section: section("edited") });
    expect(sectionTextOf(m)).toBe("edited");
  });

  it("falls back to text on update_section when section is absent", () => {
    expect(sectionTextOf(makeMutation({ kind: "update_section", text: "wire" }))).toBe("wire");
  });

  it("falls back to text on append_section when section is absent", () => {
    expect(sectionTextOf(makeMutation({ kind: "append_section", text: "wire" }))).toBe("wire");
  });

  it("falls back to text when section is present but carries no text", () => {
    // `m.section?.text ?? m.text` reaches through a section object whose own
    // text field is missing — the wire does not guarantee it, the type does.
    const m = makeMutation({
      kind: "append_section",
      text: "wire",
      section: { text: undefined as unknown as string },
    });
    expect(sectionTextOf(m)).toBe("wire");
  });

  it("is undefined on a section kind carrying neither field", () => {
    expect(sectionTextOf(makeMutation({ kind: "append_section" }))).toBeUndefined();
    expect(sectionTextOf(makeMutation({ kind: "update_section" }))).toBeUndefined();
  });

  it("is undefined — not empty, not the text field — for every other kind", () => {
    for (const kind of ["create_note", "add_link", "set_keywords", "set_status", "set_subjects"] as const) {
      // text and section are both set, to prove the kind gate is what returns
      // undefined rather than the absence of a field to read.
      const m = makeMutation({ kind, text: "wire", section: section("edited") });
      expect(sectionTextOf(m)).toBeUndefined();
    }
  });

  it("resolves a mutation carrying both fields the same way for both section kinds", () => {
    const both = { text: "wire", section: section("edited") };
    expect(sectionTextOf(makeMutation({ kind: "append_section", ...both }))).toBe(
      sectionTextOf(makeMutation({ kind: "update_section", ...both })),
    );
  });
});

describe("flattenReview — the row's identity", () => {
  it("keys a row `draftId:mutationId` with a single colon", () => {
    // Load-bearing: other code rebuilds this string by hand to look a row up.
    const m = makeMutation({ id: "mut-9" });
    const data = response(source("s1", [draft("draft-7", [m])], [target("n1", [wireRow("draft-7", m)])]));
    expect(flattenReview(data, new Map()).rows[0]!.key).toBe("draft-7:mut-9");
  });

  it("takes the key's draft half from the wire row, not from the draft list", () => {
    // The row carries its own draftId; the drafts array is only consulted for
    // block reasons and rejections.
    const m = makeMutation({ id: "m1" });
    const data = response(source("s1", [draft("d1", [m])], [target("n1", [wireRow("d-other", m)])]));
    const row = flattenReview(data, new Map()).rows[0]!;
    expect(row.key).toBe("d-other:m1");
    expect(row.draftId).toBe("d-other");
  });
});

describe("flattenReview — source and target resolution", () => {
  it("resolves sourceTitle through the map", () => {
    const m = makeMutation();
    const data = response(source("s1", [draft("d1", [m])], [target("n1", [wireRow("d1", m)])]));
    const { rows } = flattenReview(data, new Map([["s1", "The Harbour Chat"]]));
    expect(rows[0]!.sourceNoteId).toBe("s1");
    expect(rows[0]!.sourceTitle).toBe("The Harbour Chat");
  });

  it("falls back to the source id when the map has no entry for it", () => {
    const m = makeMutation();
    const data = response(source("s1", [draft("d1", [m])], [target("n1", [wireRow("d1", m)])]));
    expect(flattenReview(data, new Map([["other", "Nope"]])).rows[0]!.sourceTitle).toBe("s1");
  });

  it("takes targetTitle and targetType off the target, not off the mutation", () => {
    // The mutation names a different note and carries a note of another type;
    // neither is consulted.
    const m = makeMutation({ kind: "create_note", noteId: "wrong", note: makeNote({ type: "tone", title: "Wrong" }) });
    const row = oneRow(m, { target: { title: "Kael", noteType: "character" } });
    expect(row.targetId).toBe("n1");
    expect(row.targetTitle).toBe("Kael");
    expect(row.targetType).toBe("character");
  });

  it("falls back to the target's note id when it has no title", () => {
    expect(oneRow(makeMutation()).targetTitle).toBe("n1");
  });
});

describe("flattenReview — what passes through untouched", () => {
  it("carries the disposition through", () => {
    for (const disposition of ["new", "merge", "rewrite"] as const) {
      expect(oneRow(makeMutation(), { row: { disposition } }).disposition).toBe(disposition);
    }
  });

  it("carries changes through by reference", () => {
    const changes = [{ kind: "section" as const, key: "history", before: "a", after: "b" }];
    const row = oneRow(makeMutation(), { row: { changes } });
    expect(row.changes).toBe(changes);
  });

  it("carries the mutation itself through by reference", () => {
    const m = makeMutation();
    expect(oneRow(m).mutation).toBe(m);
  });

  it("leaves the derived fields unset for the pressure pass to fill", () => {
    const row = oneRow(makeMutation());
    expect(row.restates).toBeUndefined();
    expect(row.duplicateOf).toBeUndefined();
    expect(row.sh).toBeUndefined();
  });
});

describe("flattenReview — conflicts", () => {
  it("takes conflicts off a create_note's draft note", () => {
    const conflicts = [{ field: "status", existing: "active", proposed: "resolved" }];
    const m = makeMutation({ kind: "create_note", note: makeNote({ conflicts }) });
    expect(oneRow(m).conflicts).toEqual(conflicts);
  });

  it("is an empty array for a create_note whose note declares none", () => {
    expect(oneRow(makeMutation({ kind: "create_note", note: makeNote() })).conflicts).toEqual([]);
  });

  it("is an empty array for a create_note with no note at all", () => {
    expect(oneRow(makeMutation({ kind: "create_note" })).conflicts).toEqual([]);
  });

  it("ignores conflicts hanging off a non-create mutation's note", () => {
    // The kind gate, not the field's absence, is what empties this.
    const m = makeMutation({ kind: "append_section", note: makeNote({ conflicts: [{ field: "status" }] }) });
    expect(oneRow(m).conflicts).toEqual([]);
  });
});

describe("flattenReview — rows produced, and in what order", () => {
  it("emits one row per wire row, ordered source, then target, then row", () => {
    // Drafts do NOT group the output: rows come out in target order, so two
    // drafts writing to one target interleave with each other's neighbours.
    const a = makeMutation({ id: "m-a" });
    const b = makeMutation({ id: "m-b" });
    const c = makeMutation({ id: "m-c" });
    const d = makeMutation({ id: "m-d" });
    const data = response(
      source(
        "s1",
        [draft("d1", [a, c]), draft("d2", [b])],
        [
          target("n1", [wireRow("d1", a), wireRow("d2", b)]),
          target("n2", [wireRow("d1", c)]),
        ],
      ),
      source("s2", [draft("d3", [d])], [target("n3", [wireRow("d3", d)])]),
    );
    expect(flattenReview(data, new Map()).rows.map((r) => r.key)).toEqual([
      "d1:m-a",
      "d2:m-b",
      "d1:m-c",
      "d3:m-d",
    ]);
  });

  it("emits a row per target when one mutation is aimed at several", () => {
    // Nothing dedupes on mutation id, so the same mutation under two targets
    // produces two rows that share a key.
    const m = makeMutation({ id: "m1" });
    const data = response(
      source("s1", [draft("d1", [m])], [target("n1", [wireRow("d1", m)]), target("n2", [wireRow("d1", m)])]),
    );
    const { rows } = flattenReview(data, new Map());
    expect(rows.map((r) => r.targetId)).toEqual(["n1", "n2"]);
    // SUSPECT: the key is not unique across the batch. Two rows differing only
    // by target collide on `draftId:mutationId`, so anything keying decisions
    // by row.key decides both at once.
    expect(rows.map((r) => r.key)).toEqual(["d1:m1", "d1:m1"]);
  });

  it("returns empty rows, blocked and rejections for a payload with no sources", () => {
    expect(flattenReview(response(), new Map())).toEqual({ rows: [], blocked: [], rejections: [] });
  });

  it("does not throw on a source with drafts but no targets, or targets with no rows", () => {
    const m = makeMutation();
    const data = response(
      source("s1", [draft("d1", [m])], []),
      source("s2", [], [target("n1", [])]),
    );
    expect(flattenReview(data, new Map())).toEqual({ rows: [], blocked: [], rejections: [] });
  });
});

describe("flattenReview — blocked drafts", () => {
  const reasons = [{ code: "stale", message: "Source changed since drafting" }];

  it("records a blocked draft with its source, title and mutation count", () => {
    const m = makeMutation();
    const data = response(
      source("s1", [draft("d1", [m, makeMutation()], { blockReasons: reasons })], []),
    );
    const { blocked } = flattenReview(data, new Map([["s1", "Chat One"]]));
    expect(blocked).toEqual([
      { draftId: "d1", sourceNoteId: "s1", sourceTitle: "Chat One", reasons, mutationCount: 2 },
    ]);
  });

  it("counts the DRAFT's mutations, not the rows the target produced", () => {
    // A blocked draft emits no rows at all, so the count has to come from the
    // draft's own list or the blocked banner would always read zero.
    const m = makeMutation();
    const data = response(
      source("s1", [draft("d1", [m, makeMutation(), makeMutation()], { blockReasons: reasons })],
        [target("n1", [wireRow("d1", m)])]),
    );
    const { rows, blocked } = flattenReview(data, new Map());
    expect(rows).toEqual([]);
    expect(blocked[0]!.mutationCount).toBe(3);
  });

  it("suppresses only the blocked draft's rows, leaving its siblings", () => {
    const a = makeMutation({ id: "m-a" });
    const b = makeMutation({ id: "m-b" });
    const data = response(
      source(
        "s1",
        [draft("d1", [a], { blockReasons: reasons }), draft("d2", [b])],
        [target("n1", [wireRow("d1", a), wireRow("d2", b)])],
      ),
    );
    const { rows, blocked } = flattenReview(data, new Map());
    expect(rows.map((r) => r.key)).toEqual(["d2:m-b"]);
    expect(blocked.map((b2) => b2.draftId)).toEqual(["d1"]);
  });

  it("blocks a draft on any non-empty reasons list, whatever the codes say", () => {
    const m = makeMutation();
    const data = response(
      source("s1", [draft("d1", [m], { blockReasons: [{ code: "", message: "" }] })],
        [target("n1", [wireRow("d1", m)])]),
    );
    expect(flattenReview(data, new Map()).rows).toEqual([]);
  });

  it("scopes the block set to one source, so a same-named draft elsewhere still emits", () => {
    // SUSPECT: blockedDraftIds is rebuilt per source, so suppression is keyed
    // on draft id alone within a source. Two sources reusing a draft id would
    // disagree about whether it is blocked. Draft ids look globally unique in
    // practice, which is the only reason this is not visible.
    const a = makeMutation({ id: "m-a" });
    const b = makeMutation({ id: "m-b" });
    const data = response(
      source("s1", [draft("dup", [a], { blockReasons: reasons })], [target("n1", [wireRow("dup", a)])]),
      source("s2", [draft("dup", [b])], [target("n2", [wireRow("dup", b)])]),
    );
    expect(flattenReview(data, new Map()).rows.map((r) => r.key)).toEqual(["dup:m-b"]);
  });

  it("emits a row whose draft is not in the drafts list at all", () => {
    // SUSPECT: suppression tests membership of the BLOCKED set, not of the
    // drafts list, so a target row referencing an unknown draft passes through
    // as an ordinary row.
    const m = makeMutation({ id: "m1" });
    const data = response(source("s1", [], [target("n1", [wireRow("ghost", m)])]));
    expect(flattenReview(data, new Map()).rows.map((r) => r.key)).toEqual(["ghost:m1"]);
  });
});

describe("flattenReview — rejections", () => {
  it("collects each candidate rejection with its source and title", () => {
    const data = response(
      source("s1", [draft("d1", [], {
        candidateRejections: [
          { reason: "too_short", message: "Nothing to save", snippet: "ok" },
          { reason: "duplicate" },
        ],
      })], []),
    );
    expect(flattenReview(data, new Map([["s1", "Chat One"]])).rejections).toEqual([
      { sourceNoteId: "s1", sourceTitle: "Chat One", reason: "too_short", message: "Nothing to save", snippet: "ok" },
      { sourceNoteId: "s1", sourceTitle: "Chat One", reason: "duplicate", message: undefined, snippet: undefined },
    ]);
  });

  it("drops the rejection's recovery field", () => {
    const data = response(
      source("s1", [draft("d1", [], { candidateRejections: [{ reason: "dup", recovery: { noteId: "n9" } }] })], []),
    );
    expect(flattenReview(data, new Map()).rejections[0]).not.toHaveProperty("recovery");
  });

  it("collects rejections from a blocked draft too", () => {
    const data = response(
      source("s1", [draft("d1", [], {
        blockReasons: [{ code: "stale", message: "m" }],
        candidateRejections: [{ reason: "too_short" }],
      })], []),
    );
    const { blocked, rejections } = flattenReview(data, new Map());
    expect(blocked).toHaveLength(1);
    expect(rejections.map((r) => r.reason)).toEqual(["too_short"]);
  });

  it("survives a draft with no candidateRejections field", () => {
    const bare = { draft: { id: "d1", status: "pending", mutations: [] }, freshness: "fresh", blockReasons: [], diagnostics: [] };
    const data = response(source("s1", [bare as unknown as Draft], []));
    expect(flattenReview(data, new Map()).rejections).toEqual([]);
  });

  it("keeps rejections in draft order across drafts and sources", () => {
    const data = response(
      source("s1", [
        draft("d1", [], { candidateRejections: [{ reason: "r1" }] }),
        draft("d2", [], { candidateRejections: [{ reason: "r2" }] }),
      ], []),
      source("s2", [draft("d3", [], { candidateRejections: [{ reason: "r3" }] })], []),
    );
    expect(flattenReview(data, new Map()).rejections.map((r) => r.reason)).toEqual(["r1", "r2", "r3"]);
  });
});

// mutationText / mutationParts are private; row.text and row.parts are the only
// way in, and are also the only way anything downstream reads them.
describe("row.text and row.parts — create_note", () => {
  it("takes text from the FIRST section and parts from every one", () => {
    const note = makeNote({ sections: { core: section("first"), history: section("second") } });
    const row = oneRow(makeMutation({ kind: "create_note", note, summary: "the summary" }));
    expect(row.text).toBe("first");
    expect(row.parts).toEqual([{ key: "core", text: "first" }, { key: "history", text: "second" }]);
  });

  it("falls back to the summary when the note has no sections", () => {
    const row = oneRow(makeMutation({ kind: "create_note", note: makeNote({ sections: {} }), summary: "the summary" }));
    expect(row.text).toBe("the summary");
    expect(row.parts).toEqual([]);
  });

  it("falls back to the summary when there is no note at all", () => {
    const row = oneRow(makeMutation({ kind: "create_note", summary: "the summary" }));
    expect(row.text).toBe("the summary");
    expect(row.parts).toEqual([]);
  });

  it("reads an empty first section as the row's text rather than the summary", () => {
    // SUSPECT: the fallback is `??`, so a section that exists with empty text
    // wins over the summary and the row renders blank. `||` would show the
    // summary; the two readers disagree about whether "" is a value.
    const note = makeNote({ sections: { core: section(""), history: section("real") } });
    expect(oneRow(makeMutation({ kind: "create_note", note, summary: "the summary" })).text).toBe("");
  });

  it("treats a section with no text as an empty part rather than dropping it", () => {
    const note = makeNote({ sections: { core: { text: undefined as unknown as string } } });
    expect(oneRow(makeMutation({ kind: "create_note", note })).parts).toEqual([{ key: "core", text: "" }]);
  });

  it("carries the full section text into parts, not a truncation of it", () => {
    const note = makeNote({ sections: { core: section(chars(5000)) } });
    expect(oneRow(makeMutation({ kind: "create_note", note })).parts[0]!.text).toHaveLength(5000);
  });
});

describe("row.text and row.parts — section writes", () => {
  it("produces one part keyed by sectionKey for append_section", () => {
    const m = makeMutation({ kind: "append_section", sectionKey: "history", text: "added" });
    const row = oneRow(m);
    expect(row.text).toBe("added");
    expect(row.parts).toEqual([{ key: "history", text: "added" }]);
  });

  it("produces one part keyed by sectionKey for update_section", () => {
    const m = makeMutation({ kind: "update_section", sectionKey: "voice", section: section("rewritten"), text: "stale" });
    const row = oneRow(m);
    expect(row.text).toBe("rewritten");
    expect(row.parts).toEqual([{ key: "voice", text: "rewritten" }]);
  });

  it("measures the same string in text and in parts", () => {
    const m = makeMutation({ kind: "update_section", sectionKey: "voice", text: chars(3), section: section(chars(50)) });
    const row = oneRow(m);
    expect(row.parts[0]!.text).toBe(row.text);
  });

  it("shows the summary but charges nothing when a section write carries no text", () => {
    // SUSPECT: text and parts disagree here. `mutationText` falls back to the
    // summary while `mutationParts` records "", so the row displays a sentence
    // the pressure pass is not charging for.
    const m = makeMutation({ kind: "append_section", sectionKey: "history", summary: "the summary" });
    const row = oneRow(m);
    expect(row.text).toBe("the summary");
    expect(row.parts).toEqual([{ key: "history", text: "" }]);
  });

  it("keeps an explicitly empty section text as empty, not as the summary", () => {
    // SUSPECT: same `??` split as create_note — "" is a value here, so the row
    // renders blank rather than falling back to the summary.
    const m = makeMutation({ kind: "append_section", sectionKey: "history", text: "", summary: "the summary" });
    expect(oneRow(m).text).toBe("");
  });

  it("emits a part with an undefined key when sectionKey is missing", () => {
    // SUSPECT: `m.sectionKey!` asserts a field the wire type marks optional, so
    // the part's `key` is undefined despite being typed `string`. Downstream
    // this keys pressure as "n1 undefined".
    const m = makeMutation({ kind: "append_section", text: "added" });
    const row = oneRow(m);
    expect(row.parts).toHaveLength(1);
    expect(row.parts[0]!.key).toBeUndefined();
    expect(row.parts[0]!.text).toBe("added");
  });
});

describe("row.text and row.parts — kinds that write no section text", () => {
  it("falls back to the summary and writes no parts", () => {
    for (const kind of ["add_link", "set_keywords", "set_status", "set_subjects"] as const) {
      // text and section are populated to prove the kind, not the fields, is
      // what empties parts.
      const m = makeMutation({ kind, summary: `${kind} summary`, sectionKey: "history", text: "ignored", section: section("ignored") });
      const row = oneRow(m);
      expect(row.text).toBe(`${kind} summary`);
      expect(row.parts).toEqual([]);
    }
  });
});
