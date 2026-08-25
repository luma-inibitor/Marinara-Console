// Characterization of the Sources workspace model: which sources read as
// imported, which are worth selecting, and how one row is assembled from the
// three places the engine exposes a source (import preview, review response,
// vault notes).
//
// The two predicates draw different lines through the same six states, and the
// rail's "Ready to import" view rides on one of them, so every state is pinned
// against both and again against the rail. The title parsing is pinned per
// kind because the lorebook split is positional and a stray colon moves it.
//
// These tests pin CURRENT behavior, not desired behavior; where the two look
// like they disagree the test says so with `SUSPECT:` and still asserts what
// the code does.

import { describe, expect, it } from "vitest";

import type { Disposition, ImportPreview, Note, NoteType, ReviewResponse } from "../api/types";
import {
  type SourceKind,
  type SourceRow,
  type SourceState,
  buildSources,
  isImported,
  isSelectable,
  partition,
} from "./sources";
import { flattenReview } from "./review";
import { makeMutation, makeNote } from "../test/factories";

const STATES: SourceState[] = [
  "new", "current", "source_updated", "context_updated", "extraction_incomplete", "source_missing",
];

/** The preview sample shape, plus the field buildSources reads through a cast:
 *  `existingNoteId` is not declared on ImportPreview but is what joins a sample
 *  to the source note it became. */
type Sample = ImportPreview["samples"][number] & { existingNoteId?: string };

function sample(over: Partial<Sample> = {}): Sample {
  return {
    sourceId: "src-1",
    title: "Untitled",
    importMode: "full",
    mutationCount: 0,
    summary: "",
    snippet: "",
    freshness: "new",
    ...over,
  };
}

function previews(...entries: Array<[SourceKind, Sample[]]>): Map<SourceKind, ImportPreview> {
  return new Map(entries.map(([kind, samples]) => [kind, {
    source: kind,
    scanned: samples.length,
    draftable: samples.length,
    importedCount: 0,
    samples,
  }]));
}

type WireSource = ReviewResponse["sources"][number];

/** One review source: `rows` per target and `codes` per held draft. */
function wireSource(
  sourceNoteId: string,
  opts: { targets?: Array<{ noteId: string; rows: number }>; drafts?: string[][] } = {},
): WireSource {
  return {
    sourceNoteId,
    modes: [],
    drafts: (opts.drafts ?? []).map((codes, i) => ({
      draft: { id: `d${i}`, status: "pending", mutations: [] },
      freshness: "new",
      blockReasons: codes.map((code) => ({ code, message: code })),
      diagnostics: [],
      candidateRejections: [],
    })),
    targets: (opts.targets ?? []).map((t) => ({
      noteId: t.noteId,
      noteType: "world" as NoteType,
      rows: Array.from({ length: t.rows }, (_, i) => ({
        draftId: `d${i}`,
        mutation: makeMutation(),
        disposition: "new" as Disposition,
        diagnostics: [],
        changes: [],
      })),
    })),
  };
}

function review(...sources: WireSource[]): ReviewResponse {
  return {
    generatedAt: "2026-01-01T00:00:00Z",
    sources,
    counts: { sources: sources.length, drafts: 0, mutations: 0, blockedDrafts: 0, candidateRejections: 0, deduplications: 0 },
  };
}

function extractedFrom(sourceNoteId: string, over: Partial<Note> = {}): Note {
  return makeNote({ links: [{ target: sourceNoteId, relation: "extracted_from" }], ...over });
}

function row(over: Partial<SourceRow> = {}): SourceRow {
  return {
    kind: "chats",
    sourceId: "src-1",
    title: "Untitled",
    group: "",
    importMode: "full",
    state: "new",
    snippet: "",
    derived: [],
    pending: 0,
    blocked: [],
    ...over,
  };
}

describe("isImported", () => {
  it("calls only `new` un-imported", () => {
    expect(isImported(row({ state: "new" }))).toBe(false);
    for (const state of STATES.filter((s) => s !== "new")) {
      expect(isImported(row({ state }))).toBe(true);
    }
  });

  it("counts a source whose original is gone as imported", () => {
    // The memories it produced still exist, so it is not a candidate.
    expect(isImported(row({ state: "source_missing" }))).toBe(true);
  });
});

describe("isSelectable", () => {
  it("rejects exactly `current` and `source_missing`", () => {
    expect(isSelectable(row({ state: "current" }))).toBe(false);
    expect(isSelectable(row({ state: "source_missing" }))).toBe(false);
    for (const state of ["new", "source_updated", "context_updated", "extraction_incomplete"] as SourceState[]) {
      expect(isSelectable(row({ state }))).toBe(true);
    }
  });
});

describe("the boundary between the two predicates", () => {
  it("splits the six states three ways", () => {
    const table = STATES.map((state) => [state, isImported(row({ state })), isSelectable(row({ state }))]);
    expect(table).toEqual([
      ["new", false, true], // never imported — the only un-imported state
      ["current", true, false], // imported and settled — nothing new to get
      ["source_updated", true, true], // imported, but re-importable
      ["context_updated", true, true],
      ["extraction_incomplete", true, true],
      ["source_missing", true, false], // imported, but nothing left to import from
    ]);
  });

  it("has no state that is both un-imported and unselectable", () => {
    expect(STATES.some((state) => !isImported(row({ state })) && !isSelectable(row({ state })))).toBe(false);
  });
});

describe("buildSources — shape and empties", () => {
  it("returns nothing when there are no previews", () => {
    expect(buildSources(new Map(), null, [])).toEqual([]);
  });

  it("returns nothing when a preview has no samples", () => {
    expect(buildSources(previews(["chats", []]), null, [])).toEqual([]);
  });

  it("tolerates a null review and an empty note list", () => {
    const out = buildSources(previews(["chats", [sample({ sourceId: "c1", title: "A chat" })]]), null, []);
    expect(out).toEqual([{
      kind: "chats",
      sourceId: "c1",
      title: "A chat",
      group: "",
      importMode: "full",
      state: "new",
      noteId: undefined,
      snippet: "",
      derived: [],
      pending: 0,
      blocked: [],
    }]);
  });

  it("emits one row per sample, previews in map order and samples in list order", () => {
    const out = buildSources(previews(
      ["characters", [sample({ sourceId: "ch1", title: "Character - Alice" })]],
      ["chats", [sample({ sourceId: "c1", title: "One" }), sample({ sourceId: "c2", title: "Two" })]],
    ), null, []);
    expect(out.map((r) => [r.kind, r.sourceId])).toEqual([
      ["characters", "ch1"], ["chats", "c1"], ["chats", "c2"],
    ]);
  });

  it("does NOT de-duplicate: two samples sharing a sourceId make two rows", () => {
    // SUSPECT: nothing joins on sourceId, so a source listed under two kinds —
    // or twice inside one preview — is listed twice in the workspace.
    const out = buildSources(previews(
      ["chats", [sample({ sourceId: "dup", title: "One" }), sample({ sourceId: "dup", title: "Two" })]],
    ), null, []);
    expect(out.map((r) => r.title)).toEqual(["One", "Two"]);
  });

  it("passes the snippet through, defaulting an absent one to empty string", () => {
    const out = buildSources(previews(["chats", [
      sample({ sourceId: "a", snippet: "the text" }),
      sample({ sourceId: "b", snippet: undefined as unknown as string }),
    ]]), null, []);
    expect(out.map((r) => r.snippet)).toEqual(["the text", ""]);
  });
});

describe("buildSources — titles and groups", () => {
  const titleOf = (kind: SourceKind, title: string) =>
    buildSources(previews([kind, [sample({ title })]]), null, [])[0];

  it("strips the kind prefix from a character title and groups it under nothing", () => {
    const r = titleOf("characters", "Character - Alice Vane");
    expect([r.title, r.group]).toEqual(["Alice Vane", ""]);
  });

  it("leaves a chat title alone", () => {
    const r = titleOf("chats", "Character - Alice Vane");
    expect([r.title, r.group]).toEqual(["Character - Alice Vane", ""]);
  });

  it("splits a lorebook part into book (group) and entry (title)", () => {
    const r = titleOf("lorebooks", "Lorebook - The Deep Vale: Tidewater Rites");
    expect([r.title, r.group]).toEqual(["Tidewater Rites", "The Deep Vale"]);
  });

  it("splits on the FIRST colon, leaving later ones in the entry", () => {
    const r = titleOf("lorebooks", "Lorebook - Vale: Rites: Second Tide");
    expect([r.title, r.group]).toEqual(["Rites: Second Tide", "Vale"]);
  });

  it("uses the whole title for both group and entry when there is no colon", () => {
    const r = titleOf("lorebooks", "Lorebook - Vale");
    expect([r.title, r.group]).toEqual(["Vale", "Vale"]);
  });

  it("still splits a lorebook title that is missing its kind prefix", () => {
    const r = titleOf("lorebooks", "Vale: Rites");
    expect([r.title, r.group]).toEqual(["Rites", "Vale"]);
  });

  it("treats a leading colon as no split at all", () => {
    // SUSPECT: the split guards `indexOf(":") > 0`, so a title that opens with
    // a colon is neither split nor trimmed — group and entry both keep the colon.
    const r = titleOf("lorebooks", "Lorebook - : Rites");
    expect([r.title, r.group]).toEqual([": Rites", ": Rites"]);
  });

  it("only strips a prefix that is at the very start", () => {
    const r = titleOf("characters", "About Character - Alice");
    expect(r.title).toBe("About Character - Alice");
  });
});

describe("buildSources — state resolution", () => {
  const stateOf = (freshness: string, blocked: string[] = []) =>
    buildSources(
      previews(["chats", [sample({ sourceId: "c1", freshness, existingNoteId: "note-src" })]]),
      blocked.length ? review(wireSource("note-src", { drafts: [blocked] })) : null,
      [],
    )[0].state;

  it("maps each catalog freshness onto its own state", () => {
    expect(stateOf("current")).toBe("current");
    expect(stateOf("source_updated")).toBe("source_updated");
    expect(stateOf("context_updated")).toBe("context_updated");
    expect(stateOf("extraction_incomplete")).toBe("extraction_incomplete");
  });

  it("falls back to `new` for any freshness it does not recognise", () => {
    // SUSPECT: an unknown freshness on a sample that already has a source note
    // reads as never-imported, so the row lands in the pending rail despite
    // having produced a note. An engine that adds a freshness value silently
    // un-imports every source carrying it.
    expect(stateOf("")).toBe("new");
    expect(stateOf("imported")).toBe("new");
  });

  it("lets a held draft's `source_missing` override any freshness", () => {
    expect(stateOf("current", ["source_missing"])).toBe("source_missing");
    expect(stateOf("new", ["source_missing"])).toBe("source_missing");
  });

  it("translates a held draft's `source_stale` into context_updated", () => {
    expect(stateOf("current", ["source_stale"])).toBe("context_updated");
  });

  it("prefers source_missing over source_stale when a draft carries both", () => {
    expect(stateOf("current", ["source_stale", "source_missing"])).toBe("source_missing");
  });

  it("ignores block codes it has no rule for", () => {
    expect(stateOf("current", ["schema_invalid"])).toBe("current");
  });
});

describe("buildSources — joining the note, its memories and its queue", () => {
  it("attaches memories linked to the source note by extracted_from", () => {
    const notes = [
      extractedFrom("note-src", { id: "m1", title: "Tidewater", type: "world" as NoteType }),
      extractedFrom("note-src", { id: "m2", title: "Alice", type: "character" as NoteType }),
      extractedFrom("other", { id: "m3", title: "Elsewhere" }),
    ];
    const out = buildSources(
      previews(["chats", [sample({ sourceId: "c1", freshness: "current", existingNoteId: "note-src" })]]),
      null,
      notes,
    );
    expect(out[0].derived).toEqual([
      { id: "m1", title: "Tidewater", type: "world" },
      { id: "m2", title: "Alice", type: "character" },
    ]);
  });

  it("ignores links with any other relation", () => {
    const notes = [makeNote({ id: "m1", links: [{ target: "note-src", relation: "mentions" }] })];
    const out = buildSources(
      previews(["chats", [sample({ freshness: "current", existingNoteId: "note-src" })]]),
      null,
      notes,
    );
    expect(out[0].derived).toEqual([]);
  });

  it("falls back to the note id when a memory has no title", () => {
    const out = buildSources(
      previews(["chats", [sample({ freshness: "current", existingNoteId: "note-src" })]]),
      null,
      [extractedFrom("note-src", { id: "m1", title: undefined })],
    );
    expect(out[0].derived).toEqual([{ id: "m1", title: "m1", type: "world" }]);
  });

  it("lists a memory twice if it links to the same source twice", () => {
    // SUSPECT: the index appends per link rather than per note, so a duplicated
    // extracted_from link double-counts the memory in the derived list.
    const note = makeNote({
      id: "m1",
      title: "Tidewater",
      links: [
        { target: "note-src", relation: "extracted_from" },
        { target: "note-src", relation: "extracted_from" },
      ],
    });
    const out = buildSources(
      previews(["chats", [sample({ freshness: "current", existingNoteId: "note-src" })]]),
      null,
      [note],
    );
    expect(out[0].derived.map((d) => d.id)).toEqual(["m1", "m1"]);
  });

  it("sums pending claims across every target of the source", () => {
    const out = buildSources(
      previews(["chats", [sample({ freshness: "current", existingNoteId: "note-src" })]]),
      review(
        wireSource("note-src", { targets: [{ noteId: "t1", rows: 2 }, { noteId: "t2", rows: 3 }] }),
        wireSource("other", { targets: [{ noteId: "t3", rows: 9 }] }),
      ),
      [],
    );
    expect(out[0].pending).toBe(5);
  });

  it("does NOT count claims from a HELD draft as pending", () => {
    // flattenReview drops rows whose draft is blocked, so the review queue
    // never shows these. Counting them would advertise work that opening the
    // queue does not produce.
    const out = buildSources(
      previews(["chats", [sample({ freshness: "current", existingNoteId: "note-src" })]]),
      review(wireSource("note-src", {
        // wireSource numbers its rows' draftIds d0..dn and its drafts d0..dn,
        // so this holds d0 and leaves d1, d2, d3 waiting.
        targets: [{ noteId: "t1", rows: 4 }],
        drafts: [["source_stale"]],
      })),
      [],
    );
    expect(out[0].pending).toBe(3);
    expect(out[0].blocked).toEqual(["source_stale"]);
  });

  it("agrees with the number of rows flattenReview will actually emit", () => {
    // The count and the queue are two readings of one payload; if they drift,
    // a source advertises N and the queue shows fewer.
    const data = review(wireSource("note-src", {
      targets: [{ noteId: "t1", rows: 3 }, { noteId: "t2", rows: 2 }],
      drafts: [["source_stale"], []],
    }));
    const out = buildSources(
      previews(["chats", [sample({ freshness: "current", existingNoteId: "note-src" })]]),
      data,
      [],
    );
    const queued = flattenReview(data, new Map()).rows.filter((r) => r.sourceNoteId === "note-src");
    expect(out[0].pending).toBe(queued.length);
  });

  it("counts nothing pending when every draft of the source is held", () => {
    const out = buildSources(
      previews(["chats", [sample({ freshness: "current", existingNoteId: "note-src" })]]),
      review(wireSource("note-src", {
        targets: [{ noteId: "t1", rows: 2 }],
        drafts: [["source_stale"], ["source_missing"]],
      })),
      [],
    );
    expect(out[0].pending).toBe(0);
  });

  it("collects every block code from every held draft, in order", () => {
    const out = buildSources(
      previews(["chats", [sample({ freshness: "current", existingNoteId: "note-src" })]]),
      review(wireSource("note-src", { drafts: [["a", "b"], ["c"]] })),
      [],
    );
    expect(out[0].blocked).toEqual(["a", "b", "c"]);
  });

  it("gives a sample with no existing note nothing joined to it at all", () => {
    const out = buildSources(
      previews(["chats", [sample({ sourceId: "c1" })]]),
      review(wireSource("note-src", { targets: [{ noteId: "t1", rows: 3 }], drafts: [["source_stale"]] })),
      [extractedFrom("note-src", { id: "m1" })],
    );
    expect(out[0]).toMatchObject({ noteId: undefined, derived: [], pending: 0, blocked: [] });
  });

  it("hands two rows on the same source note the SAME derived array instance", () => {
    // SUSPECT: the joined list is shared, not copied. Anything that mutates one
    // row's `derived` mutates the other's.
    const out = buildSources(
      previews(["chats", [
        sample({ sourceId: "a", freshness: "current", existingNoteId: "note-src" }),
        sample({ sourceId: "b", freshness: "current", existingNoteId: "note-src" }),
      ]]),
      null,
      [extractedFrom("note-src", { id: "m1" })],
    );
    expect(out[0].derived).toBe(out[1].derived);
  });
});

describe("partition", () => {
  // Every state is named individually rather than derived from a predicate, so
  // a state added upstream has to be placed here by hand instead of falling
  // into or out of the rail on whatever the default branch happens to be.
  it.each([
    ["new", true, false], // never imported — the whole of the old `pending`
    ["current", false, true], // settled: nothing to import, nothing to re-extract
    ["source_updated", true, true], // imported AND ready: the two sides overlap here
    ["context_updated", true, true],
    ["extraction_incomplete", true, true],
    ["source_missing", false, true], // imported, but there is nothing left to read
  ] as Array<[SourceState, boolean, boolean]>)(
    "%s is ready=%s imported=%s",
    (state, ready, imported) => {
      const p = partition([row({ sourceId: state, state })]);
      expect(p.ready).toHaveLength(ready ? 1 : 0);
      expect(p.imported).toHaveLength(imported ? 1 : 0);
    });

  it("covers every state the model declares", () => {
    // Guards the table above: a seventh state would otherwise be untested.
    expect(STATES).toHaveLength(6);
  });

  it("lists a source under `ready` exactly when it is selectable", () => {
    // The rail and the checkbox column must never disagree about which sources
    // can be acted on, which is why both read the one predicate.
    const rows = STATES.map((state) => row({ sourceId: state, state }));
    expect(partition(rows).ready).toEqual(rows.filter(isSelectable));
  });

  it("puts a re-extractable source in both `ready` and `imported`", () => {
    // These are filters, not a partition. The counts overlap on purpose and
    // must never be shown as if they summed to `all`.
    const r = row({ sourceId: "a", state: "source_updated" });
    const { ready, imported, all } = partition([r]);
    expect(ready).toEqual([r]);
    expect(imported).toEqual([r]);
    expect(ready.length + imported.length).toBeGreaterThan(all.length);
  });

  it("leaves every row reachable from some view", () => {
    const rows = [...STATES, ...STATES].map((state, i) => row({ sourceId: `s${i}`, state }));
    const { ready, imported, all } = partition(rows);
    expect(all).toHaveLength(rows.length);
    const seen = new Set([...ready, ...imported].map((r) => r.sourceId));
    expect([...seen].sort()).toEqual(rows.map((r) => r.sourceId).sort());
  });

  it("keeps input order within each view", () => {
    const a = row({ sourceId: "a", state: "new" });
    const b = row({ sourceId: "b", state: "current" });
    const c = row({ sourceId: "c", state: "source_updated" });
    const { ready, imported } = partition([a, b, c]);
    expect(ready.map((r) => r.sourceId)).toEqual(["a", "c"]);
    expect(imported.map((r) => r.sourceId)).toEqual(["b", "c"]);
  });

  it("returns the caller's own array as `all`", () => {
    const rows = [row()];
    expect(partition(rows).all).toBe(rows);
  });

  it("returns three empties for no rows", () => {
    expect(partition([])).toEqual({ ready: [], imported: [], all: [] });
  });
});
