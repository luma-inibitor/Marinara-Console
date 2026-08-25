// Characterization of the three separate "is this section too full" answers.
//
// `computePressure` (data.ts), `rowOverflows` (store.ts) and `capFlag`
// (detail/model.ts) each decide fullness on their own terms, and a refactor
// that merges them would silently change which sections get flagged. These
// tests pin each answer so the merge has to argue with a failing test rather
// than with nobody. The last describe block states which of the three agree and
// which differ on purpose; the block before it guards the specific readings
// that a merge is most likely to flatten back out.

import { describe, expect, it, vi } from "vitest";

// model.ts renders its flag sentence through the copy catalog. Asserting on
// English would couple these tests to src/copy/memory.json, so the stub returns
// the catalog key and params instead. vi.mock is hoisted above the imports, so
// the factory must not close over anything imported here.
vi.mock("../../../copy", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params && Object.keys(params).length
      ? `${key}|${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(",")}`
      : key,
}));

import type { Note } from "../api/types";
import { SECTION_CAP } from "./caps";
import { capPercent, computePressure, rowOverflows, type SectionPressure } from "./pressure";
import { sectionViews } from "../detail/model";
import { chars, makeNote, makeRow, makeWrite, section } from "../test/factories";

/** No row is ever decided in these tests unless the test says so. */
const undecided = () => undefined;

function notes(...list: Note[]): Map<string, Note> {
  return new Map(list.map((n) => [n.id, n]));
}

/** The pressure map keyed the way store.ts and the badges index into it. */
function pressureMap(...entries: Array<Omit<SectionPressure, "additive"> & { additive?: boolean }>): Map<string, SectionPressure> {
  return new Map(entries.map((e) => [`${e.noteId} ${e.key}`, { additive: true, ...e }]));
}

describe("computePressure — projected chars per written section", () => {
  it("keys entries as `${targetId} ${key}` with a single space", () => {
    // Load-bearing: rowOverflows and the row badges rebuild this string by hand.
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(10)) } });
    const p = computePressure([makeWrite("n1", "core", chars(5))], undecided, notes(note));
    expect([...p.keys()]).toEqual(["n1 core"]);
  });

  it("adds text length plus exactly 2 separator chars per part", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(100)) } });
    const p = computePressure([makeWrite("n1", "core", chars(30))], undecided, notes(note));
    expect(p.get("n1 core")).toEqual({ noteId: "n1", key: "core", current: 100, projected: 132, additive: true });
  });

  it("charges nothing at all for a claim whose text is empty", () => {
    // The separator joins an append to what is already there. A claim with
    // nothing to join contributes no text and buys no separator.
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(100)) } });
    const p = computePressure([makeWrite("n1", "core", "")], undecided, notes(note));
    expect(p.get("n1 core")).toEqual({ noteId: "n1", key: "core", current: 100, projected: 100, additive: true });
  });

  it("accumulates two rows on the same target and key into one entry", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(100)) } });
    const p = computePressure(
      [makeWrite("n1", "core", chars(30)), makeWrite("n1", "core", chars(40))],
      undecided,
      notes(note),
    );
    expect(p.size).toBe(1);
    // current counted once, both texts and both separators added.
    expect(p.get("n1 core")).toEqual({ noteId: "n1", key: "core", current: 100, projected: 174, additive: true });
  });

  it("keeps the entry for a row decided 'drop' and projects it unchanged", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(100)) } });
    const dropped = makeWrite("n1", "core", chars(30));
    const p = computePressure([dropped], (key) => (key === dropped.key ? "drop" : undefined), notes(note));
    // The section's stored size is a fact about the note, not about the claim,
    // so declining the claim must not take the reading down with it.
    expect(p.get("n1 core")).toEqual({ noteId: "n1", key: "core", current: 100, projected: 100, additive: true });
  });

  it("keeps a row decided 'keep' alongside undecided rows", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(100)) } });
    const kept = makeWrite("n1", "core", chars(30));
    const p = computePressure([kept], (key) => (key === kept.key ? "keep" : undefined), notes(note));
    expect(p.get("n1 core")!.projected).toBe(132);
  });

  it("projects a non-additive section as a REPLACE: the text's own length", () => {
    // character + "items" is non-additive per isAdditive.
    const note = makeNote({ id: "c1", type: "character", sections: { items: section(chars(19000)) } });
    const p = computePressure([makeWrite("c1", "items", chars(5000))], undecided, notes(note));
    expect(p.get("c1 items")).toEqual({
      noteId: "c1", key: "items", current: 19000, projected: 5000, additive: false,
    });
  });

  it("lets the LAST claim win when several replace the same non-additive section", () => {
    const note = makeNote({ id: "c1", type: "character", sections: { items: section(chars(100)) } });
    const p = computePressure(
      [makeWrite("c1", "items", chars(30)), makeWrite("c1", "items", chars(40))],
      undecided,
      notes(note),
    );
    // Not 30 + 40: two replaces of one section leave only the second one's text.
    expect(p.get("c1 items")).toEqual({ noteId: "c1", key: "items", current: 100, projected: 40, additive: false });
  });

  it("marks 'progression' non-additive on a character while its other sections accumulate", () => {
    const note = makeNote({
      id: "c1",
      type: "character",
      sections: { progression: section(chars(50)), voice: section(chars(50)) },
    });
    const p = computePressure(
      [makeWrite("c1", "progression", chars(10)), makeWrite("c1", "voice", chars(10))],
      undecided,
      notes(note),
    );
    expect([...p.keys()]).toEqual(["c1 progression", "c1 voice"]);
    expect(p.get("c1 progression")).toEqual({
      noteId: "c1", key: "progression", current: 50, projected: 10, additive: false,
    });
    expect(p.get("c1 voice")).toEqual({ noteId: "c1", key: "voice", current: 50, projected: 62, additive: true });
  });

  it("makes only 'history' additive on a relationship note", () => {
    const note = makeNote({
      id: "r1",
      type: "relationship",
      sections: { history: section(chars(10)), dynamic: section(chars(10)) },
    });
    const p = computePressure(
      [makeWrite("r1", "history", chars(4)), makeWrite("r1", "dynamic", chars(4))],
      undecided,
      notes(note),
    );
    expect(p.get("r1 history")).toEqual({ noteId: "r1", key: "history", current: 10, projected: 16, additive: true });
    expect(p.get("r1 dynamic")).toEqual({ noteId: "r1", key: "dynamic", current: 10, projected: 4, additive: false });
  });

  it("makes only 'observations' additive on a tone note", () => {
    const note = makeNote({
      id: "t1",
      type: "tone",
      sections: { observations: section(chars(10)), rules: section(chars(10)) },
    });
    const p = computePressure(
      [makeWrite("t1", "observations", chars(4)), makeWrite("t1", "rules", chars(4))],
      undecided,
      notes(note),
    );
    expect(p.get("t1 observations")).toEqual({
      noteId: "t1", key: "observations", current: 10, projected: 16, additive: true,
    });
    expect(p.get("t1 rules")).toEqual({ noteId: "t1", key: "rules", current: 10, projected: 4, additive: false });
  });

  it("treats every section of a timeline_event note as additive", () => {
    const note = makeNote({ id: "e1", type: "timeline_event", sections: { anything: section(chars(10)) } });
    const p = computePressure([makeWrite("e1", "anything", chars(4))], undecided, notes(note));
    expect(p.get("e1 anything")!.projected).toBe(16);
  });

  it("falls back to the anchor rule for types with no rule of their own", () => {
    const plain = makeNote({ id: "s1", type: "scene", sections: { beats: section(chars(10)) } });
    const anchored = makeNote({ id: "s2", type: "scene", tags: ["anchor"], sections: { beats: section(chars(10)) } });
    const byKey = makeNote({ id: "s3", type: "scene", sections: { anchors: section(chars(10)) } });
    const p = computePressure(
      [makeWrite("s1", "beats", chars(4)), makeWrite("s2", "beats", chars(4)), makeWrite("s3", "anchors", chars(4))],
      undecided,
      notes(plain, anchored, byKey),
    );
    expect([...p.keys()].sort()).toEqual(["s1 beats", "s2 beats", "s3 anchors"]);
    expect(p.get("s1 beats")!.additive).toBe(false);
    expect(p.get("s1 beats")!.projected).toBe(4);
    expect(p.get("s2 beats")!.additive).toBe(true);
    expect(p.get("s2 beats")!.projected).toBe(16);
    expect(p.get("s3 anchors")!.additive).toBe(true);
    expect(p.get("s3 anchors")!.projected).toBe(16);
  });

  it("reports current 0 for a not-yet-created target and classifies it by row.targetType", () => {
    // create_note: the target is absent from notesById, so row.targetType is the
    // only type on hand — and "world" is additive whatever the key.
    const row = makeWrite("new-1", "core", chars(25), { targetType: "world" });
    const p = computePressure([row], undecided, new Map());
    expect(p.get("new-1 core")).toEqual({ noteId: "new-1", key: "core", current: 0, projected: 27, additive: true });
  });

  it("applies a type's non-additive keys to a create too, so a character's 'items' is a replace", () => {
    const row = makeWrite("new-c", "items", chars(25), { targetType: "character" });
    const p = computePressure([row], undecided, new Map());
    expect(p.get("new-c items")).toEqual({
      noteId: "new-c", key: "items", current: 0, projected: 25, additive: false,
    });
  });

  it("can only reach the KEY half of the anchor rule for a create, never the tag half", () => {
    // A create's tags live on the mutation's draft note, not on Row, so a type
    // with no rule of its own falls to `key === "anchors"` alone. A create that
    // would carry the `anchor` tag still reads as non-additive here.
    const byKey = makeWrite("new-s", "anchors", chars(4), { targetType: "scene" });
    const byTag = makeWrite("new-s2", "beats", chars(4), { targetType: "scene" });
    const p = computePressure([byKey, byTag], undecided, new Map());
    expect(p.get("new-s anchors")!.additive).toBe(true);
    expect(p.get("new-s2 beats")!.additive).toBe(false);
  });

  it("reads current from the stored note, not from the row's own text", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(7)) } });
    const p = computePressure([makeWrite("n1", "core", chars(1000))], undecided, notes(note));
    expect(p.get("n1 core")!.current).toBe(7);
  });

  it("reports current 0 for a section the target note does not have yet", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { other: section(chars(500)) } });
    const p = computePressure([makeWrite("n1", "fresh", chars(10))], undecided, notes(note));
    expect(p.get("n1 fresh")).toEqual({ noteId: "n1", key: "fresh", current: 0, projected: 12, additive: true });
  });

  it("charges the separator once per part when one row writes several sections", () => {
    const note = makeNote({ id: "n1", type: "world", sections: {} });
    const row = makeRow({ targetId: "n1", parts: [{ key: "a", text: chars(3) }, { key: "b", text: chars(4) }] });
    const p = computePressure([row], undecided, notes(note));
    expect(p.get("n1 a")!.projected).toBe(5);
    expect(p.get("n1 b")!.projected).toBe(6);
  });

  it("returns an empty map for rows with no parts", () => {
    const p = computePressure([makeRow({ targetId: "n1", parts: [] })], undecided, new Map());
    expect(p.size).toBe(0);
  });
});

describe("capPercent — floored at or below the cap, rounded above it", () => {
  it("reports 99 one char below the cap", () => {
    // The reading a near-cap sentence quotes. Rounding here would let a section
    // that is not yet full be described as "at 100% of its cap".
    expect(capPercent(SECTION_CAP - 1)).toBe(99);
  });

  it("reports 100 at EXACTLY the cap", () => {
    expect(capPercent(SECTION_CAP)).toBe(100);
  });

  it("floors rather than rounds at the halfway mark below the cap", () => {
    // 19,900 / 20,000 is 99.5%, which rounding would show as 100%.
    expect(capPercent(SECTION_CAP * 0.995)).toBe(99);
  });

  it("rounds above the cap, where 100 would understate", () => {
    // 22,500 / 20,000 is 112.5%, which flooring would show as 112%.
    expect(capPercent(SECTION_CAP * 1.125)).toBe(113);
    expect(capPercent(SECTION_CAP * 1.25)).toBe(125);
  });

  it("reports a fraction of a percent as 0 well below the cap", () => {
    expect(capPercent(SECTION_CAP * 0.25)).toBe(25);
    expect(capPercent(100)).toBe(0);
  });
});

describe("rowOverflows — STRICT > against SECTION_CAP on the projection", () => {
  const row = makeWrite("n1", "core", chars(10));

  it("is false one char below the cap", () => {
    const map = pressureMap({ noteId: "n1", key: "core", current: 0, projected: SECTION_CAP - 1 });
    expect(rowOverflows(row, map)).toBe(false);
  });

  it("is false at EXACTLY the cap", () => {
    const map = pressureMap({ noteId: "n1", key: "core", current: 0, projected: SECTION_CAP });
    expect(rowOverflows(row, map)).toBe(false);
  });

  it("is true one char above the cap", () => {
    const map = pressureMap({ noteId: "n1", key: "core", current: 0, projected: SECTION_CAP + 1 });
    expect(rowOverflows(row, map)).toBe(true);
  });

  it("is false when the section is missing from the pressure map", () => {
    // The ?? 0 fallback. Only reachable for a section computePressure never
    // wrote an entry for, which for a row in the queue means no part at all.
    expect(rowOverflows(row, new Map())).toBe(false);
  });

  it("reads the projection, not additivity: a replace under the cap does not overflow", () => {
    const map = pressureMap({ noteId: "n1", key: "core", current: SECTION_CAP * 2, projected: 10, additive: false });
    expect(rowOverflows(row, map)).toBe(false);
  });

  it("is true for a non-additive entry whose projection is over the cap", () => {
    const map = pressureMap({ noteId: "n1", key: "core", current: 10, projected: SECTION_CAP + 1, additive: false });
    expect(rowOverflows(row, map)).toBe(true);
  });

  it("is true when ANY part of a multi-section row overflows", () => {
    const multi = makeRow({ targetId: "n1", parts: [{ key: "a", text: "" }, { key: "b", text: "" }] });
    const map = pressureMap(
      { noteId: "n1", key: "a", current: 0, projected: 10 },
      { noteId: "n1", key: "b", current: 0, projected: SECTION_CAP + 1 },
    );
    expect(rowOverflows(multi, map)).toBe(true);
  });

  it("is false for a row with no parts, whatever the map holds", () => {
    const empty = makeRow({ targetId: "n1", parts: [] });
    const map = pressureMap({ noteId: "n1", key: "core", current: 0, projected: SECTION_CAP * 10 });
    expect(rowOverflows(empty, map)).toBe(false);
  });

  it("ignores an entry belonging to a different target id", () => {
    const map = pressureMap({ noteId: "other", key: "core", current: 0, projected: SECTION_CAP + 1 });
    expect(rowOverflows(row, map)).toBe(false);
  });
});

describe("capFlag via sectionViews — NON-STRICT >= 0.8 on the note's CURRENT chars", () => {
  const NEAR = SECTION_CAP * 0.8;
  const view = (n: number) => sectionViews(makeNote({ sections: { core: section(chars(n)) } }))[0]!;

  it("flags null well under the threshold", () => {
    expect(view(100).flag).toBe(null);
  });

  it("flags null one char below 0.8 of the cap", () => {
    expect(view(NEAR - 1).flag).toBe(null);
  });

  it("flags near-cap at EXACTLY 0.8 of the cap", () => {
    const flag = view(NEAR).flag!;
    expect(flag.ratio).toBe(0.8);
    expect(flag.sentence).toBe(
      `memory.detail.sectionNearCap|key=core,pct=80,cap=${SECTION_CAP.toLocaleString()}`,
    );
  });

  it("flags near-cap one char above 0.8 of the cap", () => {
    expect(view(NEAR + 1).flag!.sentence).toContain("memory.detail.sectionNearCap");
  });

  it("flags near-cap at 99% one char below the cap itself", () => {
    // The sentence and the percentage have to agree: a section called "near"
    // cannot quote a figure that says it is already full.
    expect(view(SECTION_CAP - 1).flag!.sentence).toBe(
      `memory.detail.sectionNearCap|key=core,pct=99,cap=${SECTION_CAP.toLocaleString()}`,
    );
  });

  it("stays near-cap at EXACTLY the cap, quoting 100%", () => {
    // SECTION_CAP is the schema's maximum, so sitting on it is full, not past.
    const flag = view(SECTION_CAP).flag!;
    expect(flag.ratio).toBe(1);
    expect(flag.sentence).toBe(
      `memory.detail.sectionNearCap|key=core,pct=100,cap=${SECTION_CAP.toLocaleString()}`,
    );
  });

  it("switches to over-cap one char above the cap", () => {
    const flag = view(SECTION_CAP + 1).flag!;
    expect(flag.ratio).toBeGreaterThan(1);
    expect(flag.sentence).toBe(
      `memory.detail.sectionOverCap|key=core,pct=100,cap=${SECTION_CAP.toLocaleString()}`,
    );
  });

  it("stays over-cap above the cap, with a ratio past 1", () => {
    const flag = view(SECTION_CAP + 4000).flag!;
    expect(flag.ratio).toBe(1.2);
    expect(flag.sentence).toBe(
      `memory.detail.sectionOverCap|key=core,pct=120,cap=${SECTION_CAP.toLocaleString()}`,
    );
  });

  it("flags each section independently and in payload order", () => {
    const views = sectionViews(makeNote({
      sections: { core: section(chars(10)), swollen: section(chars(SECTION_CAP)), mid: section(chars(NEAR)) },
    }));
    expect(views.map((v) => v.key)).toEqual(["core", "swollen", "mid"]);
    expect(views.map((v) => v.flag === null)).toEqual([true, false, false]);
  });

  it("flags on the note's type-blind stored size — additivity is never consulted", () => {
    // computePressure would call this section a replace and project the
    // incoming text's length. capFlag has no such notion: it reads what the
    // note holds right now, whatever writing to it would do.
    const [v] = sectionViews(makeNote({ type: "character", sections: { items: section(chars(SECTION_CAP + 1)) } }));
    expect(v!.flag!.sentence).toContain("memory.detail.sectionOverCap");
  });
});

// Each of these guards one reading that a "simplification" would plausibly undo,
// and each one has been wrong in shipped code.
describe("readings that must not be flattened back out", () => {
  it("REPORTS a non-additive section that is over the cap rather than omitting it", () => {
    // Omission and "no pressure" are indistinguishable downstream, so dropping
    // the entry hides a 24,000-char replacement behind a silent badge.
    const note = makeNote({ id: "c1", type: "character", sections: { items: section(chars(19000)) } });
    const row = makeWrite("c1", "items", chars(24000));
    const map = computePressure([row], undecided, notes(note));
    expect(map.size).toBe(1);
    expect(map.get("c1 items")).toEqual({
      noteId: "c1", key: "items", current: 19000, projected: 24000, additive: false,
    });
    expect(rowOverflows(row, map)).toBe(true);
  });

  it("KEEPS a dropped row's section entry, current size intact", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(SECTION_CAP + 1)) } });
    const dropped = makeWrite("n1", "core", chars(10));
    const map = computePressure([dropped], (k) => (k === dropped.key ? "drop" : undefined), notes(note));
    expect(map.get("n1 core")).toEqual({
      noteId: "n1", key: "core", current: SECTION_CAP + 1, projected: SECTION_CAP + 1, additive: true,
    });
    // An already-over-cap note stays over cap when its last claim is declined.
    expect(rowOverflows(dropped, map)).toBe(true);
  });

  it("ADDS ZERO for an empty-text claim, separator included", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(500)) } });
    const empty = computePressure([makeWrite("n1", "core", "")], undecided, notes(note));
    const none = computePressure([makeRow({ targetId: "n1", parts: [] })], undecided, notes(note));
    expect(empty.get("n1 core")!.projected).toBe(500);
    expect(none.size).toBe(0);
  });

  it("CLASSIFIES a create_note exactly as the same claim against an existing note", () => {
    const existing = makeNote({ id: "c1", type: "character", sections: {} });
    const againstExisting = computePressure(
      [makeWrite("c1", "items", chars(25))],
      undecided,
      notes(existing),
    ).get("c1 items")!;
    const asCreate = computePressure(
      [makeWrite("new-c", "items", chars(25), { targetType: "character" })],
      undecided,
      new Map(),
    ).get("new-c items")!;
    expect(asCreate.additive).toBe(againstExisting.additive);
    expect(asCreate.projected).toBe(againstExisting.projected);
    expect(asCreate.additive).toBe(false);
  });
});

// Documentation for the merge: where the three readings line up, and where they
// differ because they are answering different questions.
describe("relationship between the three cap-pressure computations", () => {
  const row = makeWrite("n1", "core", chars(10));

  it("AGREE at exactly SECTION_CAP: rowOverflows says no, capFlag says near rather than over", () => {
    const map = pressureMap({ noteId: "n1", key: "core", current: 0, projected: SECTION_CAP });
    expect(rowOverflows(row, map)).toBe(false);
    const [v] = sectionViews(makeNote({ sections: { core: section(chars(SECTION_CAP)) } }));
    expect(v!.flag!.sentence).toContain("memory.detail.sectionNearCap");
  });

  it("AGREE that a non-additive section has a size: computePressure reports it, capFlag flags it", () => {
    const note = makeNote({ id: "c1", type: "character", sections: { items: section(chars(SECTION_CAP + 5000)) } });
    const itemsRow = makeWrite("c1", "items", chars(SECTION_CAP + 1000));
    const map = computePressure([itemsRow], undecided, notes(note));
    expect(map.get("c1 items")!.projected).toBe(SECTION_CAP + 1000);
    expect(rowOverflows(itemsRow, map)).toBe(true);
    const [v] = sectionViews(note);
    expect(v!.flag!.sentence).toContain("memory.detail.sectionOverCap");
  });

  it("AGREE that a dropped claim leaves an over-cap note over cap", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(SECTION_CAP + 1)) } });
    const dropped = makeWrite("n1", "core", chars(10));
    const map = computePressure([dropped], (k) => (k === dropped.key ? "drop" : undefined), notes(note));
    expect(rowOverflows(dropped, map)).toBe(true);
    const [v] = sectionViews(note);
    expect(v!.flag!.sentence).toContain("memory.detail.sectionOverCap");
  });

  it("DIFFER on the near-cap band: capFlag warns at 0.8 where rowOverflows has nothing to say", () => {
    // Deliberate. rowOverflows drives a per-row overflow badge, which is a
    // binary "this write does not fit"; the near band is advice on a stored
    // section, with no row to attach to.
    const map = pressureMap({ noteId: "n1", key: "core", current: 0, projected: SECTION_CAP * 0.8 });
    expect(rowOverflows(row, map)).toBe(false);
    const [v] = sectionViews(makeNote({ sections: { core: section(chars(SECTION_CAP * 0.8)) } }));
    expect(v!.flag).not.toBe(null);
  });

  it("DIFFER on PROJECTED vs CURRENT: a queue that pushes a note over flags in rowOverflows only", () => {
    // Deliberate. capFlag describes the note as stored; the queue is not applied
    // and may never be.
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(SECTION_CAP - 100)) } });
    const map = computePressure([makeWrite("n1", "core", chars(500))], undecided, notes(note));
    expect(map.get("n1 core")).toEqual({
      noteId: "n1", key: "core", current: SECTION_CAP - 100, projected: SECTION_CAP + 402, additive: true,
    });
    expect(rowOverflows(row, map)).toBe(true);
    const [v] = sectionViews(note);
    expect(v!.flag!.sentence).toContain("memory.detail.sectionNearCap");
  });

  it("DIFFER on a shrinking replace: an over-cap note whose replacement fits reads as no overflow", () => {
    // Deliberate, and the point of tracking additivity: replacing a bloated
    // section with a short text genuinely relieves it, so the row is not the
    // one to warn about even though the note is over cap today.
    const note = makeNote({ id: "c1", type: "character", sections: { items: section(chars(SECTION_CAP + 5000)) } });
    const itemsRow = makeWrite("c1", "items", chars(1000));
    const map = computePressure([itemsRow], undecided, notes(note));
    expect(map.get("c1 items")).toEqual({
      noteId: "c1", key: "items", current: SECTION_CAP + 5000, projected: 1000, additive: false,
    });
    expect(rowOverflows(itemsRow, map)).toBe(false);
    const [v] = sectionViews(note);
    expect(v!.flag!.sentence).toContain("memory.detail.sectionOverCap");
  });
});
