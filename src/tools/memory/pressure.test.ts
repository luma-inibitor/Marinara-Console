// Characterization of the three separate "is this section too full" answers.
//
// `computePressure` (data.ts), `rowOverflows` (store.ts) and `capFlag`
// (detail/model.ts) each decide fullness on their own terms, and a refactor
// that merges them would silently change which sections get flagged. These
// tests pin today's answers — including the ones that look wrong, marked
// SUSPECT — so the merge has to argue with a failing test rather than with
// nobody. The last describe block states the divergences in its test names.

import { describe, expect, it, vi } from "vitest";

// model.ts renders its flag sentence through the copy catalog. Asserting on
// English would couple these tests to src/copy/memory.json, so the stub returns
// the catalog key and params instead. vi.mock is hoisted above the imports, so
// the factory must not close over anything imported here.
vi.mock("../../copy", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params && Object.keys(params).length
      ? `${key}|${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(",")}`
      : key,
}));

import { SECTION_CAP, computePressure, type Note, type SectionPressure } from "./data";
import { rowOverflows } from "./store";
import { sectionViews } from "./detail/model";
import { chars, makeNote, makeRow, makeWrite, section } from "./test/factories";

/** No row is ever decided in these tests unless the test says so. */
const undecided = () => undefined;

function notes(...list: Note[]): Map<string, Note> {
  return new Map(list.map((n) => [n.id, n]));
}

/** The pressure map keyed the way store.ts and the badges index into it. */
function pressureMap(...entries: SectionPressure[]): Map<string, SectionPressure> {
  return new Map(entries.map((e) => [`${e.noteId} ${e.key}`, e]));
}

describe("computePressure — projected chars for additive sections", () => {
  it("keys entries as `${targetId} ${key}` with a single space", () => {
    // Load-bearing: rowOverflows and the row badges rebuild this string by hand.
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(10)) } });
    const p = computePressure([makeWrite("n1", "core", chars(5))], undecided, notes(note));
    expect([...p.keys()]).toEqual(["n1 core"]);
  });

  it("adds text length plus exactly 2 separator chars per part", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(100)) } });
    const p = computePressure([makeWrite("n1", "core", chars(30))], undecided, notes(note));
    expect(p.get("n1 core")).toMatchObject({ noteId: "n1", key: "core", current: 100, projected: 132 });
  });

  it("charges the 2 separator chars even for empty text", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(100)) } });
    const p = computePressure([makeWrite("n1", "core", "")], undecided, notes(note));
    // SUSPECT: a claim that writes nothing still grows the projection by 2. The
    // engine's projector joins parts with a separator, so an empty append should
    // cost 0, not 2 — but the constant is unconditional here.
    expect(p.get("n1 core")!.projected).toBe(102);
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
    expect(p.get("n1 core")).toMatchObject({ current: 100, projected: 174 });
  });

  it("contributes nothing for a row decided 'drop'", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(100)) } });
    const dropped = makeWrite("n1", "core", chars(30));
    const p = computePressure([dropped], (key) => (key === dropped.key ? "drop" : undefined), notes(note));
    // The section is not merely unchanged — it is absent, so nothing downstream
    // can read its current size either.
    expect(p.has("n1 core")).toBe(false);
    expect(p.size).toBe(0);
  });

  it("keeps a row decided 'keep' alongside undecided rows", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(100)) } });
    const kept = makeWrite("n1", "core", chars(30));
    const p = computePressure([kept], (key) => (key === kept.key ? "keep" : undefined), notes(note));
    expect(p.get("n1 core")!.projected).toBe(132);
  });

  it("OMITS a non-additive section entirely rather than returning it unchanged", () => {
    // character + "items" is non-additive per isAdditive.
    const note = makeNote({ id: "c1", type: "character", sections: { items: section(chars(19000)) } });
    const p = computePressure([makeWrite("c1", "items", chars(5000))], undecided, notes(note));
    expect(p.has("c1 items")).toBe(false);
    expect(p.size).toBe(0);
    // SUSPECT: omission and "no pressure" are the same value downstream. A
    // non-additive section already at 19,000 chars being rewritten to 24,000
    // reports zero pressure, so no badge can ever warn about it.
  });

  it("omits 'progression' on a character but keeps its other sections", () => {
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
    expect([...p.keys()]).toEqual(["c1 voice"]);
  });

  it("keeps only 'history' on a relationship note", () => {
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
    expect([...p.keys()]).toEqual(["r1 history"]);
  });

  it("keeps only 'observations' on a tone note", () => {
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
    expect([...p.keys()]).toEqual(["t1 observations"]);
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
    expect([...p.keys()].sort()).toEqual(["s2 beats", "s3 anchors"]);
  });

  it("reports current 0 and treats a not-yet-created target as additive", () => {
    // create_note: the target is absent from notesById, so there is no type to
    // consult and `!existing` short-circuits the additivity test.
    const row = makeWrite("new-1", "core", chars(25));
    const p = computePressure([row], undecided, new Map());
    expect(p.get("new-1 core")).toMatchObject({ noteId: "new-1", key: "core", current: 0, projected: 27 });
  });

  it("treats a missing target as additive even for a key its type would refuse", () => {
    const row = makeWrite("new-c", "items", chars(25), { targetType: "character" });
    const p = computePressure([row], undecided, new Map());
    // SUSPECT: row.targetType says "character" and "items" is non-additive for a
    // character, but `!existing` wins before targetType is ever consulted. The
    // same claim flips to non-additive the moment the note exists.
    expect(p.get("new-c items")!.projected).toBe(27);
  });

  it("reads current from the stored note, not from the row's own text", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(7)) } });
    const p = computePressure([makeWrite("n1", "core", chars(1000))], undecided, notes(note));
    expect(p.get("n1 core")!.current).toBe(7);
  });

  it("reports current 0 for a section the target note does not have yet", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { other: section(chars(500)) } });
    const p = computePressure([makeWrite("n1", "fresh", chars(10))], undecided, notes(note));
    expect(p.get("n1 fresh")).toMatchObject({ current: 0, projected: 12 });
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
    // The ?? 0 fallback. Combined with computePressure omitting non-additive
    // sections, an over-cap non-additive rewrite reads as "no overflow".
    expect(rowOverflows(row, new Map())).toBe(false);
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

  it("flags near-cap one char below the cap itself", () => {
    // pct rounds to 100 while the copy still says "near" — the two thresholds
    // are read off different numbers.
    expect(view(SECTION_CAP - 1).flag!.sentence).toBe(
      `memory.detail.sectionNearCap|key=core,pct=100,cap=${SECTION_CAP.toLocaleString()}`,
    );
  });

  it("switches to over-cap at EXACTLY the cap", () => {
    const flag = view(SECTION_CAP).flag!;
    expect(flag.ratio).toBe(1);
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
    // character + "items" is non-additive, which computePressure treats as
    // reason to say nothing at all. capFlag has no such notion.
    const [v] = sectionViews(makeNote({ type: "character", sections: { items: section(chars(SECTION_CAP)) } }));
    expect(v!.flag!.sentence).toContain("memory.detail.sectionOverCap");
  });
});

// Documentation for the merge: these are the observable differences between the
// three implementations, each stated as a case where two of them disagree.
describe("divergence between the three cap-pressure computations", () => {
  const row = makeWrite("n1", "core", chars(10));

  it("at exactly SECTION_CAP: rowOverflows says NO (strict >), capFlag says over-cap (non-strict >=)", () => {
    const map = pressureMap({ noteId: "n1", key: "core", current: 0, projected: SECTION_CAP });
    expect(rowOverflows(row, map)).toBe(false);
    const [v] = sectionViews(makeNote({ sections: { core: section(chars(SECTION_CAP)) } }));
    expect(v!.flag!.sentence).toContain("memory.detail.sectionOverCap");
  });

  it("capFlag has no near-cap band equivalent: rowOverflows is silent at 0.8 where capFlag flags", () => {
    const map = pressureMap({ noteId: "n1", key: "core", current: 0, projected: SECTION_CAP * 0.8 });
    expect(rowOverflows(row, map)).toBe(false);
    const [v] = sectionViews(makeNote({ sections: { core: section(chars(SECTION_CAP * 0.8)) } }));
    expect(v!.flag).not.toBe(null);
  });

  it("PROJECTED vs CURRENT: a note under cap whose queue pushes it over flags in rowOverflows but not capFlag", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(SECTION_CAP - 100)) } });
    const map = computePressure([makeWrite("n1", "core", chars(500))], undecided, notes(note));
    expect(map.get("n1 core")).toMatchObject({ current: SECTION_CAP - 100, projected: SECTION_CAP + 402 });
    expect(rowOverflows(row, map)).toBe(true);
    const [v] = sectionViews(note);
    expect(v!.flag!.sentence).toContain("memory.detail.sectionNearCap");
  });

  it("ADDITIVITY: computePressure and rowOverflows go blind on a non-additive section, capFlag does not", () => {
    const note = makeNote({ id: "c1", type: "character", sections: { items: section(chars(SECTION_CAP + 5000)) } });
    const itemsRow = makeWrite("c1", "items", chars(1000));
    const map = computePressure([itemsRow], undecided, notes(note));
    expect(map.size).toBe(0);
    expect(rowOverflows(itemsRow, map)).toBe(false);
    const [v] = sectionViews(note);
    expect(v!.flag!.sentence).toContain("memory.detail.sectionOverCap");
  });

  it("DECISIONS: a dropped row erases pressure for rowOverflows; capFlag never sees decisions at all", () => {
    const note = makeNote({ id: "n1", type: "world", sections: { core: section(chars(SECTION_CAP + 1)) } });
    const dropped = makeWrite("n1", "core", chars(10));
    const map = computePressure([dropped], (k) => (k === dropped.key ? "drop" : undefined), notes(note));
    expect(rowOverflows(dropped, map)).toBe(false);
    const [v] = sectionViews(note);
    expect(v!.flag!.sentence).toContain("memory.detail.sectionOverCap");
  });
});
