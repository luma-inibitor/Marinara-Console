// Characterization of the flag rules: what `flagsOf` emits today, in what
// order, and exactly where each numeric boundary sits.
//
// These tests exist so a refactor that merges the duplicated flag logic can
// prove it changed nothing. They pin CURRENT behavior, not desired behavior —
// where the two look like they disagree the test says so with `SUSPECT:` and
// still asserts what the code does.
//
// Copy is stubbed to `key|param=value` so an assertion names the catalog key
// and its params. Asserting on English would make every reword of
// src/copy/*.json a test failure, which is noise, not signal.

import { describe, expect, it, vi } from "vitest";

vi.mock("../../../copy", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params && Object.keys(params).length
      ? `${key}|${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(",")}`
      : key,
  // store.ts is pulled in transitively (flags imports rowOverflows) and reads
  // these two off the same module.
  tAny: (key: string) => key,
  joinList: (items: readonly string[]) => items.join(", "),
}));

import type { Mutation, Note, ReviewResponse } from "../api/types";
import { KEYWORD_CAP, SECTION_CAP } from "./caps";
import { flattenReview, type Row, sectionTextOf } from "./review";
import type { SectionPressure } from "./pressure";
import { FLAG, LOW_CONFIDENCE, contributionChars, flagsOf, worstSeverity } from "./flags";
import { chars, makeMutation, makeNote, makeRow, section } from "../test/factories";

const LONG_CHARS = 800; // module-private in flags.ts
const NEAR_LIMIT = SECTION_CAP * 0.8;

/** The factories' default confidence (0.9) is BELOW LOW_CONFIDENCE, so a row
 *  built plainly already carries a flag. Every test that is not about
 *  confidence starts from here instead, to keep its assertion about one rule. */
function cleanRow(over: Partial<Row> = {}): Row {
  return makeRow({ ...over, mutation: makeMutation({ confidence: 0.99, ...over.mutation }) });
}

function ctx(over: { pressure?: Map<string, SectionPressure>; notesById?: Map<string, Note> } = {}) {
  return { pressure: over.pressure ?? new Map(), notesById: over.notesById ?? new Map() };
}

/** Pressure is keyed `${targetId} ${sectionKey}`; only `projected` is read. */
function pressure(entries: Array<[string, string, number]>): Map<string, SectionPressure> {
  const m = new Map<string, SectionPressure>();
  for (const [noteId, key, projected] of entries) {
    m.set(`${noteId} ${key}`, { noteId, key, current: 0, projected, additive: true });
  }
  return m;
}

const labels = (r: Row, c = ctx()) => flagsOf(r, c).map((f) => f.label);

describe("contributionChars", () => {
  it("reads text on append_section", () => {
    expect(contributionChars(cleanRow({ mutation: makeMutation({ kind: "append_section", text: chars(12) }) }))).toBe(12);
  });

  it("falls back to section.text on append_section", () => {
    const mutation = makeMutation({ kind: "append_section", section: section(chars(7)) });
    expect(contributionChars(cleanRow({ mutation }))).toBe(7);
  });

  it("prefers section.text over text when both are present", () => {
    // section.text is the field the console's own edit path writes, so on a
    // mutation carrying both it is the newer of the two.
    const mutation = makeMutation({ kind: "update_section", text: chars(3), section: section(chars(50)) });
    expect(contributionChars(cleanRow({ mutation }))).toBe(50);
  });

  it("falls back to section.text on update_section", () => {
    const mutation = makeMutation({ kind: "update_section", section: section(chars(9)) });
    expect(contributionChars(cleanRow({ mutation }))).toBe(9);
  });

  it("sums every section on create_note", () => {
    const note = makeNote({ sections: { a: section(chars(10)), b: section(chars(5)) } });
    expect(contributionChars(cleanRow({ mutation: makeMutation({ kind: "create_note", note }) }))).toBe(15);
  });

  it("is 0 for mutation kinds that write no section text", () => {
    for (const kind of ["add_link", "set_keywords", "set_status", "set_subjects"] as const) {
      // text is set to prove the kind, not the field, is what zeroes it out.
      expect(contributionChars(cleanRow({ mutation: makeMutation({ kind, text: chars(99) }) }))).toBe(0);
    }
  });

  it("is 0, not NaN, when the text is missing entirely", () => {
    expect(contributionChars(cleanRow({ mutation: makeMutation({ kind: "append_section" }) }))).toBe(0);
    expect(contributionChars(cleanRow({ mutation: makeMutation({ kind: "create_note" }) }))).toBe(0);
  });
});

// The long-claim flag, the row's readline and the cap projection all read the
// text a mutation writes. They read it through one helper, so a mutation
// carrying both fields cannot measure one string and display another.
describe("one section-text reader", () => {
  /** The row `flattenReview` builds for a single mutation against one target. */
  function flatten(m: Mutation): Row {
    const data: ReviewResponse = {
      generatedAt: "",
      sources: [
        {
          sourceNoteId: "s1",
          modes: [],
          drafts: [
            {
              draft: { id: "d1", status: "pending", mutations: [m] },
              freshness: "fresh",
              blockReasons: [],
              diagnostics: [],
              candidateRejections: [],
            },
          ],
          targets: [
            {
              noteId: "n1",
              noteType: "world",
              rows: [{ draftId: "d1", mutation: m, disposition: "new", diagnostics: [], changes: [] }],
            },
          ],
        },
      ],
      counts: { sources: 1, drafts: 1, mutations: 1, blockedDrafts: 0, candidateRejections: 0, deduplications: 0 },
    };
    return flattenReview(data, new Map()).rows[0]!;
  }

  it("measures one string across the flag, the readline and the parts", () => {
    const m = makeMutation({
      kind: "update_section", sectionKey: "history", text: chars(3), section: section(chars(50)),
    });
    const row = flatten(m);
    expect(sectionTextOf(m)).toBe(chars(50));
    expect(row.text).toBe(chars(50));
    expect(row.parts).toEqual([{ key: "history", text: chars(50) }]);
    expect(contributionChars(row)).toBe(row.parts[0]!.text.length);
  });

  it("measures an append that carries its text only in section.text", () => {
    const m = makeMutation({ kind: "append_section", sectionKey: "history", section: section(chars(40)) });
    const row = flatten(m);
    expect(row.text).toBe(chars(40));
    expect(row.parts).toEqual([{ key: "history", text: chars(40) }]);
    expect(contributionChars(row)).toBe(40);
  });

  it("is undefined for kinds that write no section text", () => {
    // create_note carries a whole section map instead, which each reader takes
    // apart its own way.
    for (const kind of ["create_note", "add_link", "set_keywords", "set_status", "set_subjects"] as const) {
      expect(sectionTextOf(makeMutation({ kind, text: chars(9) }))).toBeUndefined();
    }
  });
});

describe("flagsOf — one branch at a time", () => {
  it("emits no flags for a row that trips nothing", () => {
    expect(flagsOf(cleanRow(), ctx())).toEqual([]);
  });

  it("flags conflicts as danger and counts them in the sentence", () => {
    const row = cleanRow({ conflicts: [{ field: "a" }, { field: "b" }] });
    expect(flagsOf(row, ctx())).toEqual([
      { label: FLAG.conflicts, severity: "danger", sentence: "memory.flag.conflictCount|count=2" },
    ]);
  });

  it("flags over-limit as danger, naming the section and its percent of cap", () => {
    const row = cleanRow({ targetId: "n1", parts: [{ key: "history", text: "x" }] });
    const c = ctx({ pressure: pressure([["n1", "history", 25000]]) });
    expect(flagsOf(row, c)).toEqual([
      {
        label: FLAG.overLimit,
        severity: "danger",
        sentence: `memory.flag.sectionOverCapNamed|key=history,pct=125,cap=${SECTION_CAP.toLocaleString()}`,
      },
    ]);
  });

  it("flags near-limit as warn", () => {
    const row = cleanRow({ targetId: "n1", parts: [{ key: "history", text: "x" }] });
    const c = ctx({ pressure: pressure([["n1", "history", NEAR_LIMIT]]) });
    expect(flagsOf(row, c)).toEqual([
      {
        label: FLAG.nearLimit,
        severity: "warn",
        sentence: `memory.flag.sectionNearCapNamed|key=history,pct=80,cap=${SECTION_CAP.toLocaleString()}`,
      },
    ]);
  });

  it("over-limit and near-limit are mutually exclusive", () => {
    const row = cleanRow({ targetId: "n1", parts: [{ key: "history", text: "x" }] });
    const c = ctx({ pressure: pressure([["n1", "history", 25000]]) });
    expect(labels(row, c)).toEqual([FLAG.overLimit]);
    expect(labels(row, c)).not.toContain(FLAG.nearLimit);
  });

  it("over-limit boundary is strictly greater than the cap", () => {
    const row = cleanRow({ targetId: "n1", parts: [{ key: "history", text: "x" }] });
    // Exactly at the cap is not over — it falls through to the near-limit test.
    expect(labels(row, ctx({ pressure: pressure([["n1", "history", SECTION_CAP]]) }))).toEqual([FLAG.nearLimit]);
    expect(labels(row, ctx({ pressure: pressure([["n1", "history", SECTION_CAP + 1]]) }))).toEqual([FLAG.overLimit]);
  });

  it("near-limit boundary is at-or-above 80% of the cap", () => {
    const row = cleanRow({ targetId: "n1", parts: [{ key: "history", text: "x" }] });
    expect(labels(row, ctx({ pressure: pressure([["n1", "history", NEAR_LIMIT - 1]]) }))).toEqual([]);
    expect(labels(row, ctx({ pressure: pressure([["n1", "history", NEAR_LIMIT]]) }))).toEqual([FLAG.nearLimit]);
  });

  it("names the worst section when the row writes several", () => {
    const row = cleanRow({
      targetId: "n1",
      parts: [{ key: "history", text: "x" }, { key: "items", text: "x" }, { key: "anchors", text: "x" }],
    });
    const c = ctx({
      pressure: pressure([["n1", "history", 21000], ["n1", "items", 30000], ["n1", "anchors", 22000]]),
    });
    expect(flagsOf(row, c)[0]!.sentence).toBe(
      `memory.flag.sectionOverCapNamed|key=items,pct=150,cap=${SECTION_CAP.toLocaleString()}`,
    );
  });

  it("ignores pressure recorded against another note's identically named section", () => {
    const row = cleanRow({ targetId: "n1", parts: [{ key: "history", text: "x" }] });
    expect(labels(row, ctx({ pressure: pressure([["n2", "history", 30000]]) }))).toEqual([]);
  });

  it("flags a rewrite disposition as warn", () => {
    expect(flagsOf(cleanRow({ disposition: "rewrite" }), ctx())).toEqual([
      { label: FLAG.rewrite, severity: "warn", sentence: "reviewqueue.acceptReplacesSavedMemory" },
    ]);
  });

  it("flags high risk as danger", () => {
    expect(flagsOf(cleanRow({ mutation: makeMutation({ risk: "high", confidence: 0.99 }) }), ctx())).toEqual([
      { label: FLAG.highRisk, severity: "danger", sentence: "memory.flag.highRiskSentence" },
    ]);
  });

  it("flags medium risk as warn", () => {
    expect(flagsOf(cleanRow({ mutation: makeMutation({ risk: "medium", confidence: 0.99 }) }), ctx())).toEqual([
      { label: FLAG.mediumRisk, severity: "warn", sentence: "memory.flag.mediumRiskSentence" },
    ]);
  });

  it("emits nothing for low risk — the common value gets no chip", () => {
    expect(labels(cleanRow({ mutation: makeMutation({ risk: "low", confidence: 0.99 }) }))).toEqual([]);
  });

  it("flags confidence below the threshold, with both percents rounded", () => {
    expect(flagsOf(cleanRow({ mutation: makeMutation({ confidence: 0.876 }) }), ctx())).toEqual([
      {
        label: FLAG.lowConfidence,
        severity: "warn",
        sentence: "memory.flag.confidenceSentence|pct=88,threshold=93",
      },
    ]);
  });

  it("does not flag confidence exactly at the threshold (strict <)", () => {
    expect(labels(cleanRow({ mutation: makeMutation({ confidence: LOW_CONFIDENCE }) }))).toEqual([]);
    expect(labels(cleanRow({ mutation: makeMutation({ confidence: LOW_CONFIDENCE - 0.01 }) }))).toEqual([
      FLAG.lowConfidence,
    ]);
  });

  it("flags a restatement, with the score at two decimals", () => {
    const row = cleanRow({ restates: { score: 0.9, line: "line", noteId: "n9" } });
    expect(flagsOf(row, ctx())).toEqual([
      { label: FLAG.restates, severity: "warn", sentence: "memory.flag.restatesSentence|score=0.90" },
    ]);
  });

  it("flags a duplicate within the batch, with the score at two decimals", () => {
    const row = cleanRow({ duplicateOf: { key: "other-row", score: 0.875 } });
    expect(flagsOf(row, ctx())).toEqual([
      { label: FLAG.duplicate, severity: "warn", sentence: "memory.flag.duplicateSentence|score=0.88" },
    ]);
  });

  it("flags a long contribution at-or-above the char threshold", () => {
    const row = cleanRow({ mutation: makeMutation({ kind: "append_section", text: chars(LONG_CHARS), confidence: 0.99 }) });
    expect(flagsOf(row, ctx())).toEqual([
      {
        label: FLAG.long,
        severity: "warn",
        sentence: `memory.flag.longSentence|chars=${LONG_CHARS.toLocaleString()}`,
      },
    ]);
  });

  it("does not flag a contribution one char below the threshold", () => {
    const mutation = makeMutation({ kind: "append_section", text: chars(LONG_CHARS - 1), confidence: 0.99 });
    expect(labels(cleanRow({ mutation }))).toEqual([]);
  });

  it("flags a timeline_event whose text carries no bracketed date", () => {
    const row = cleanRow({ targetType: "timeline_event", text: "Kael leaves the harbour" });
    expect(flagsOf(row, ctx())).toEqual([
      { label: FLAG.undated, severity: "warn", sentence: "memory.flag.undatedSentence" },
    ]);
  });

  it("accepts a bracketed ISO date anywhere in the text", () => {
    expect(labels(cleanRow({ targetType: "timeline_event", text: "[2024-03-05] Kael leaves" }))).toEqual([]);
    expect(labels(cleanRow({ targetType: "timeline_event", text: "Kael leaves [2024-03-05]" }))).toEqual([]);
  });

  it("rejects date-like text that is not bracketed ISO", () => {
    // The pattern is literally /\[\d{4}-\d{2}-\d{2}\]/ — brackets and zero
    // padding are both required, and no other order is understood.
    for (const text of ["2024-03-05 Kael leaves", "[03-05-2024]", "[2024-3-5]", "[2024/03/05]"]) {
      expect(labels(cleanRow({ targetType: "timeline_event", text }))).toEqual([FLAG.undated]);
    }
  });

  it("does not check dates on non-event targets", () => {
    expect(labels(cleanRow({ targetType: "character", text: "no date here" }))).toEqual([]);
  });

  it("flags a create_note with no keywords", () => {
    const mutation = makeMutation({ kind: "create_note", note: makeNote({ keywords: [] }), confidence: 0.99 });
    expect(flagsOf(cleanRow({ mutation }), ctx())).toEqual([
      { label: FLAG.noKeywords, severity: "warn", sentence: "memory.flag.noKeywordsSentence" },
    ]);
  });

  it("treats a create_note with a missing keywords field as having none", () => {
    const mutation = makeMutation({ kind: "create_note", note: makeNote(), confidence: 0.99 });
    expect(labels(cleanRow({ mutation }))).toEqual([FLAG.noKeywords]);
  });

  it("does not flag a create_note that has keywords", () => {
    const note = makeNote({ keywords: ["harbour"] });
    const mutation = makeMutation({ kind: "create_note", note, confidence: 0.99 });
    expect(labels(cleanRow({ mutation }))).toEqual([]);
  });

  it("does not check keywords on kinds other than create_note", () => {
    const mutation = makeMutation({ kind: "append_section", note: makeNote({ keywords: [] }), confidence: 0.99 });
    expect(labels(cleanRow({ mutation }))).toEqual([]);
  });

  it("does not flag a target note one keyword below the cap", () => {
    const keywords = Array.from({ length: KEYWORD_CAP - 1 }, (_, i) => `k${i}`);
    const notes = new Map([["n1", makeNote({ id: "n1", keywords })]]);
    expect(flagsOf(cleanRow({ targetId: "n1" }), ctx({ notesById: notes }))).toEqual([]);
  });

  it("says the target is AT the cap once it holds KEYWORD_CAP keywords", () => {
    const keywords = Array.from({ length: KEYWORD_CAP }, (_, i) => `k${i}`);
    const notes = new Map([["n1", makeNote({ id: "n1", keywords })]]);
    expect(flagsOf(cleanRow({ targetId: "n1" }), ctx({ notesById: notes }))).toEqual([
      {
        label: FLAG.keywordCapFull,
        severity: "warn",
        sentence: `memory.flag.keywordCapFullSentence|cap=${KEYWORD_CAP}`,
      },
    ]);
  });

  it("keeps the at-cap wording above the cap", () => {
    const keywords = Array.from({ length: KEYWORD_CAP + 5 }, (_, i) => `k${i}`);
    const notes = new Map([["n1", makeNote({ id: "n1", keywords })]]);
    expect(labels(cleanRow({ targetId: "n1" }), ctx({ notesById: notes }))).toEqual([FLAG.keywordCapFull]);
  });

  it("does not flag a target note well below the cap", () => {
    const notes = new Map([["n1", makeNote({ id: "n1", keywords: Array.from({ length: 24 }, (_, i) => `k${i}`) })]]);
    expect(labels(cleanRow({ targetId: "n1" }), ctx({ notesById: notes }))).toEqual([]);
  });

  it("does not flag when the target note is not in the vault map", () => {
    expect(labels(cleanRow({ targetId: "missing" }), ctx({ notesById: new Map() }))).toEqual([]);
  });
});

describe("the flags array itself", () => {
  // Emission order is a contract: the detail card's signals zone renders the
  // array as written, so a refactor that reorders these branches changes the
  // reading order of every flagged row.
  it("emits flags in a fixed order, not a set", () => {
    const note = makeNote({
      id: "n1",
      keywords: Array.from({ length: 30 }, (_, i) => `k${i}`),
      sections: {},
    });
    const row = makeRow({
      targetId: "n1",
      targetType: "timeline_event",
      text: "no date",
      disposition: "rewrite",
      conflicts: [{ field: "a" }],
      parts: [{ key: "history", text: "x" }],
      restates: { score: 0.81, line: "l", noteId: "n2" },
      duplicateOf: { key: "other", score: 0.77 },
      mutation: makeMutation({
        kind: "create_note",
        risk: "high",
        confidence: 0.4,
        note: makeNote({ keywords: [], sections: { a: section(chars(LONG_CHARS)) } }),
      }),
    });
    const c = ctx({ pressure: pressure([["n1", "history", 30000]]), notesById: new Map([["n1", note]]) });
    expect(flagsOf(row, c).map((f) => f.label)).toEqual([
      FLAG.conflicts,
      FLAG.overLimit,
      FLAG.rewrite,
      FLAG.highRisk,
      FLAG.lowConfidence,
      FLAG.restates,
      FLAG.duplicate,
      FLAG.long,
      FLAG.undated,
      FLAG.noKeywords,
      FLAG.keywordCapFull,
    ]);
  });

  it("returns an empty array — not null — for a clean row", () => {
    expect(flagsOf(cleanRow(), ctx())).toEqual([]);
  });
});

describe("worstSeverity", () => {
  const warn = { label: "w", severity: "warn" as const, sentence: "s" };
  const danger = { label: "d", severity: "danger" as const, sentence: "s" };

  it("is null for no flags", () => {
    expect(worstSeverity([])).toBeNull();
  });

  it("is warn when every flag is a warn", () => {
    expect(worstSeverity([warn, warn])).toBe("warn");
  });

  it("is danger wherever the danger sits in the array", () => {
    expect(worstSeverity([danger, warn])).toBe("danger");
    expect(worstSeverity([warn, warn, danger])).toBe("danger");
  });
});
