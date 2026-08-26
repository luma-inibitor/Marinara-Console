// Characterization of the faceted review queue: which rows survive a filter,
// what each facet's counts are computed over, and how rows fall into groups.
//
// These are the numbers a reviewer reads above the list, so the two rules that
// are easy to invert in a refactor are pinned by name here: filtering is OR
// WITHIN a facet and AND ACROSS facets, and a facet's counts are computed with
// its OWN filter excluded (so a count answers "what would I get if I toggled
// this") while every other facet's filter still applies.
//
// They pin CURRENT behavior, not desired behavior; where the two look like they
// disagree the test says so with `SUSPECT:` and still asserts what the code does.
//
// Copy is stubbed to `key|param=value` so an assertion names the catalog key
// rather than English — facet values and grouper labels are read from the
// catalog, and rewording src/copy/*.json must not fail these tests.

import { describe, expect, it, vi } from "vitest";

vi.mock("../../../copy", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params && Object.keys(params).length
      ? `${key}|${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(",")}`
      : key,
  // Pulled in transitively by the store/flags chain, which reads these off the
  // same module.
  tAny: (key: string) => key,
  joinList: (items: readonly string[]) => items.join(", "),
}));

import type { Mutation, Note } from "../api/types";
import type { Decision, Row } from "./review";
import type { SectionPressure } from "./pressure";
import { FLAG } from "./flags";
import { FACETS, GROUPERS, SORTERS, applyFilters, buildGroups, facetCounts } from "./facets";
import { makeMutation, makeRow } from "../test/factories";

interface CtxOver {
  decisions?: Map<string, Decision>;
  edited?: Map<string, Mutation>;
  pressure?: Map<string, SectionPressure>;
  notesById?: Map<string, Note>;
}

function ctx(over: CtxOver = {}) {
  return {
    decisions: over.decisions ?? new Map<string, Decision>(),
    edited: over.edited ?? new Map<string, Mutation>(),
    pressure: over.pressure ?? new Map<string, SectionPressure>(),
    notesById: over.notesById ?? new Map<string, Note>(),
  };
}

/** `active` is keyed by facet id; a set per facet. */
function active(entries: Array<[string, string[]]>): Map<string, Set<string>> {
  return new Map(entries.map(([id, vs]) => [id, new Set(vs)]));
}

const keys = (rows: Row[]) => rows.map((r) => r.key);

// A row built plainly carries no quality flags at all: risk low, confidence
// above the low-confidence threshold, no conflicts, no parts, no keywords.
// Tests that want a flag ask for one.
const plain = (over: Partial<Row> = {}) => makeRow(over);

describe("FACETS", () => {
  it("declares one facet per id, with provenance kept apart", () => {
    expect(FACETS.map((f) => f.id)).toEqual([
      "flags", "anyFlag", "disposition", "risk", "kind", "claimKind", "targetType", "source", "status",
    ]);
    expect(FACETS.map((f) => f.source)).toEqual([
      "computed", "computed", "model", "model", "model", "model", "model", "model", "yours",
    ]);
  });

  it("reads the source facet label from the catalog and the rest as literals", () => {
    expect(FACETS.find((f) => f.id === "source")!.label).toBe("reviewqueue.sources");
    expect(FACETS.find((f) => f.id === "status")!.label).toBe("decision");
  });

  // flags and anyFlag narrow the same set, so each has to count as if the
  // other were not applied. Without this, opening the flag list while "has
  // quality flags" is on would show every named flag counting only the rows
  // that filter already kept — a count that cannot answer "what would I get".
  it("pairs flags and anyFlag so neither counts through the other", () => {
    const flags = FACETS.find((f) => f.id === "flags")!;
    const any = FACETS.find((f) => f.id === "anyFlag")!;
    expect(flags.countsIgnore).toEqual(["anyFlag"]);
    expect(any.countsIgnore).toEqual(["flags"]);
  });
});

describe("applyFilters — no active facets", () => {
  it("returns the very same list, not a copy", () => {
    const list = [plain(), plain()];
    expect(applyFilters(list, new Map(), ctx())).toBe(list);
  });

  it("treats a facet with an empty set as not active at all", () => {
    const list = [plain()];
    expect(applyFilters(list, active([["risk", []]]), ctx())).toBe(list);
  });

  it("returns empty for an empty list", () => {
    expect(applyFilters([], active([["risk", ["low"]]]), ctx())).toEqual([]);
  });
});

describe("applyFilters — one facet", () => {
  const low = plain({ mutation: makeMutation({ risk: "low" }) });
  const high = plain({ mutation: makeMutation({ risk: "high" }) });
  const list = [low, high];

  it("keeps only rows whose value is in the set", () => {
    expect(keys(applyFilters(list, active([["risk", ["high"]]]), ctx()))).toEqual([high.key]);
  });

  it("yields an empty list — not everything — when nothing matches", () => {
    expect(applyFilters(list, active([["risk", ["medium"]]]), ctx())).toEqual([]);
  });

  it("drops rows whose facet value is null rather than keeping them", () => {
    // `plain` has no quality flags, so the flags facet returns null for it.
    const flagged = plain({ mutation: makeMutation({ risk: "high" }) });
    const rows = [plain(), flagged];
    expect(keys(applyFilters(rows, active([["flags", [FLAG.highRisk]]]), ctx()))).toEqual([flagged.key]);
  });

  it("filters everything out when the facet id is not a known facet", () => {
    // SUSPECT: an unknown id makes `byId.get(id)` undefined, which reads as a
    // null value and rejects every row. A stale filter id in persisted UI state
    // therefore empties the queue rather than being ignored.
    expect(applyFilters(list, active([["nope", ["high"]]]), ctx())).toEqual([]);
  });
});

describe("applyFilters — OR within a facet, AND across facets", () => {
  const a = plain({ mutation: makeMutation({ risk: "high" }), disposition: "new" });
  const b = plain({ mutation: makeMutation({ risk: "medium" }), disposition: "merge" });
  const c = plain({ mutation: makeMutation({ risk: "low" }), disposition: "new" });
  const list = [a, b, c];

  it("ORs two values inside the same facet", () => {
    const got = applyFilters(list, active([["risk", ["high", "low"]]]), ctx());
    expect(keys(got)).toEqual([a.key, c.key]);
  });

  it("ANDs two different facets", () => {
    const got = applyFilters(list, active([["risk", ["high", "low"]], ["disposition", ["new"]]]), ctx());
    expect(keys(got)).toEqual([a.key, c.key]);
  });

  it("lets one facet exclude what the other admitted", () => {
    const got = applyFilters(list, active([["risk", ["high", "medium"]], ["disposition", ["merge"]]]), ctx());
    expect(keys(got)).toEqual([b.key]);
  });

  it("returns empty when two facets have no row in common", () => {
    const got = applyFilters(list, active([["risk", ["high"]], ["disposition", ["merge"]]]), ctx());
    expect(got).toEqual([]);
  });

  it("matches a multi-valued facet if ANY of the row's values is in the set", () => {
    // The status facet emits the decision plus "edited" when the row is edited.
    const edited = plain();
    const c1 = ctx({
      decisions: new Map([[edited.key, "keep"]]),
      edited: new Map([[edited.key, makeMutation()]]),
    });
    expect(keys(applyFilters([edited], active([["status", ["keep"]]]), c1))).toEqual([edited.key]);
    expect(keys(applyFilters([edited], active([["status", ["edited"]]]), c1))).toEqual([edited.key]);
    expect(applyFilters([edited], active([["status", ["drop"]]]), c1)).toEqual([]);
  });

  it("calls an undecided row by the catalog's undecided value", () => {
    const row = plain();
    expect(keys(applyFilters([row], active([["status", ["memory.undecided"]]]), ctx()))).toEqual([row.key]);
  });

  it("preserves input order among the survivors", () => {
    const got = applyFilters(list, active([["disposition", ["new", "merge"]]]), ctx());
    expect(keys(got)).toEqual([a.key, b.key, c.key]);
  });
});

describe("facetCounts", () => {
  const a = plain({ mutation: makeMutation({ risk: "high" }), disposition: "new" });
  const b = plain({ mutation: makeMutation({ risk: "high" }), disposition: "merge" });
  const c = plain({ mutation: makeMutation({ risk: "low" }), disposition: "new" });
  const list = [a, b, c];

  it("returns one map per facet, every facet id present", () => {
    const counts = facetCounts(list, new Map(), ctx());
    expect([...counts.keys()]).toEqual(FACETS.map((f) => f.id));
  });

  it("counts over the whole list when nothing is active", () => {
    const counts = facetCounts(list, new Map(), ctx());
    // "medium" is in risk's declared domain and absent from these rows, so it
    // is listed at zero rather than dropped.
    expect(counts.get("risk")).toEqual(new Map([["high", 2], ["medium", 0], ["low", 1]]));
    expect(counts.get("disposition")).toEqual(new Map([["new", 2], ["merge", 1]]));
  });

  it("EXCLUDES a facet's own filter from its own counts", () => {
    // This is what makes a count read as "what would I get if I toggled this":
    // with risk=high active, the risk counts still show the low rows.
    const counts = facetCounts(list, active([["risk", ["high"]]]), ctx());
    expect(counts.get("risk")).toEqual(new Map([["high", 2], ["medium", 0], ["low", 1]]));
  });

  it("APPLIES every other facet's filter to a facet's counts", () => {
    const counts = facetCounts(list, active([["risk", ["high"]]]), ctx());
    expect(counts.get("disposition")).toEqual(new Map([["new", 1], ["merge", 1]]));
  });

  it("excludes only its own facet when several are active", () => {
    const counts = facetCounts(list, active([["risk", ["high"]], ["disposition", ["new"]]]), ctx());
    // risk counts: disposition=new applied, risk not → a and c.
    expect(counts.get("risk")).toEqual(new Map([["high", 1], ["medium", 0], ["low", 1]]));
    // disposition counts: risk=high applied, disposition not → a and b.
    expect(counts.get("disposition")).toEqual(new Map([["new", 1], ["merge", 1]]));
  });

  // Changed deliberately (owner-asked): a value the slice does not contain is
  // still one of the choices the facet offers, and dropping it made the axis
  // look smaller than it is. The vocabulary comes from the declared domain or
  // the UNFILTERED rows — never from the pool being narrowed.
  it("keeps a value at zero rather than omitting it", () => {
    const counts = facetCounts(list, active([["disposition", ["merge"]]]), ctx());
    expect(counts.get("risk")!.get("low")).toBe(0);
    expect(counts.get("risk")).toEqual(new Map([["high", 1], ["medium", 0], ["low", 0]]));
  });

  it("keeps an undeclared value discovered on a filtered-out row", () => {
    // targetType declares no domain, so its vocabulary is learned. "character"
    // must survive a filter on ANOTHER facet that hides every row carrying it
    // — otherwise the memory-type axis silently shrinks as you narrow.
    const ch = plain({ targetType: "character", disposition: "new" });
    const wo = plain({ targetType: "world", disposition: "merge" });
    const counts = facetCounts([ch, wo], active([["disposition", ["merge"]]]), ctx());
    expect(counts.get("targetType")).toEqual(new Map([["character", 0], ["world", 1]]));
  });

  it("counts a multi-valued facet once per value", () => {
    const row = plain();
    const counts = facetCounts([row], new Map(), ctx({
      decisions: new Map([[row.key, "keep"]]),
      edited: new Map([[row.key, makeMutation()]]),
    }));
    // keep/drop/undecided are status's declared domain, so the axis shows all
    // three however this one row landed.
    expect(counts.get("status")).toEqual(
      new Map([["keep", 1], ["drop", 0], ["memory.undecided", 0], ["edited", 1]]),
    );
  });

  it("counts every flag a row carries, and nothing for a row with none", () => {
    const flagged = plain({ mutation: makeMutation({ risk: "high", confidence: 0.5 }) });
    const counts = facetCounts([flagged, plain()], new Map(), ctx());
    expect(counts.get("flags")).toEqual(new Map([
      [FLAG.highRisk, 1],
      [FLAG.lowConfidence, 1],
    ]));
  });

  it("gives an empty list nothing but the declared domains, at zero", () => {
    const counts = facetCounts([], active([["risk", ["high"]]]), ctx());
    expect(counts.get("risk")).toEqual(new Map([["high", 0], ["medium", 0], ["low", 0]]));
    expect(counts.get("status")).toEqual(new Map([["keep", 0], ["drop", 0], ["memory.undecided", 0]]));
    // Facets with no declared domain learn theirs from the rows, and there
    // are none.
    expect(counts.get("source")!.size).toBe(0);
    expect(counts.get("flags")!.size).toBe(0);
  });
});

describe("buildGroups — groupers", () => {
  const row = (over: Partial<Row>) => plain(over);

  it("groups by target, carrying the note type as the icon", () => {
    const a = row({ targetId: "n1", targetTitle: "Alice", targetType: "character" });
    const b = row({ targetId: "n1", targetTitle: "Alice", targetType: "character" });
    const c = row({ targetId: "n2", targetTitle: "Vale", targetType: "world" });
    const groups = buildGroups([a, b, c], "target", "risk");
    expect(groups.map((g) => [g.id, g.label, g.icon])).toEqual([
      ["n1", "Alice", { family: "type", value: "character" }],
      ["n2", "Vale", { family: "type", value: "world" }],
    ]);
    expect(keys(groups[0].rows)).toEqual([a.key, b.key]);
  });

  it("groups by source, carrying the source kind as the icon", () => {
    const a = row({ sourceNoteId: "s1", sourceTitle: "Chat A", sourceKind: "chat_summary" });
    const b = row({ sourceNoteId: "s2", sourceTitle: "The Vale", sourceKind: "lorebook" });
    const groups = buildGroups([a, b], "source", "risk");
    expect(groups.map((g) => [g.id, g.label, g.icon])).toEqual([
      ["s1", "Chat A", { family: "sourceKind", value: "chat_summary" }],
      ["s2", "The Vale", { family: "sourceKind", value: "lorebook" }],
    ]);
  });

  it("leaves a source whose note recorded no provenance without an icon", () => {
    const groups = buildGroups([row({ sourceNoteId: "s1", sourceTitle: "Chat A" })], "source", "risk");
    expect(groups[0].icon).toBeUndefined();
  });

  it("groups by disposition, using the raw value as both id and label", () => {
    const groups = buildGroups(
      [row({ disposition: "merge" }), row({ disposition: "new" })],
      "disposition",
      "risk",
    );
    expect(groups.map((g) => [g.id, g.label])).toEqual([["merge", "merge"], ["new", "new"]]);
  });

  it("gives disposition and the `none` bucket no icon", () => {
    expect(buildGroups([row({ disposition: "merge" })], "disposition", "risk")[0].icon).toBeUndefined();
    expect(buildGroups([row({})], "none", "risk")[0].icon).toBeUndefined();
  });

  it("groups by change kind, spacing the underscores out of the label only", () => {
    const a = row({ mutation: makeMutation({ kind: "append_section" }) });
    const b = row({ mutation: makeMutation({ kind: "create_note" }) });
    const groups = buildGroups([a, b], "kind", "risk");
    expect(groups.map((g) => [g.id, g.label, g.icon])).toEqual([
      ["append_section", "append section", { family: "op", value: "append_section" }],
      ["create_note", "create note", { family: "op", value: "create_note" }],
    ]);
  });

  it("puts everything in one group under the `none` grouper", () => {
    const groups = buildGroups([row({ targetId: "n1" }), row({ targetId: "n2" })], "none", "risk");
    expect(groups).toHaveLength(1);
    expect([groups[0].id, groups[0].label]).toEqual(["all", "all proposals"]);
    expect(groups[0].rows).toHaveLength(2);
  });

  it("falls back to the target grouper for an unknown grouper id", () => {
    const groups = buildGroups([row({ targetId: "n1", targetTitle: "Alice" })], "nope", "risk");
    expect(groups.map((g) => g.id)).toEqual(["n1"]);
  });

  it("names the groupers the queue offers", () => {
    expect(Object.entries(GROUPERS).map(([id, g]) => [id, g.label])).toEqual([
      ["target", "target memory"],
      ["source", "reviewqueue.sources"],
      ["disposition", "disposition"],
      ["kind", "change kind"],
      ["none", "nothing"],
    ]);
  });
});

describe("buildGroups — a missing group key", () => {
  it("collects rows with an empty target id into one empty-id group", () => {
    // SUSPECT: no grouper guards against a blank key. A row whose target id is
    // missing gets a group keyed "" and labelled with whatever the title was,
    // rather than being routed to an "ungrouped" bucket.
    const a = plain({ targetId: "", targetTitle: "" });
    const b = plain({ targetId: "", targetTitle: "" });
    const c = plain({ targetId: "n1", targetTitle: "Alice" });
    const groups = buildGroups([a, b, c], "target", "risk");
    expect(groups.map((g) => [g.id, g.label])).toEqual([["", ""], ["n1", "Alice"]]);
    expect(groups[0].rows).toHaveLength(2);
  });

  it("keeps the first row's label when later rows in the group disagree", () => {
    const a = plain({ targetId: "n1", targetTitle: "Alice" });
    const b = plain({ targetId: "n1", targetTitle: "Alice (renamed)" });
    const groups = buildGroups([a, b], "target", "risk");
    expect(groups.map((g) => g.label)).toEqual(["Alice"]);
  });
});

describe("buildGroups — sorting", () => {
  const at = (risk: "low" | "medium" | "high", title: string, confidence = 0.99) =>
    plain({ targetTitle: title, targetId: title, mutation: makeMutation({ risk, confidence }) });

  it("sorts by risk high → medium → low with dir 1", () => {
    const low = at("low", "a");
    const high = at("high", "b");
    const med = at("medium", "c");
    const groups = buildGroups([low, high, med], "none", "risk", 1);
    expect(groups[0].rows.map((r) => r.mutation.risk)).toEqual(["high", "medium", "low"]);
  });

  it("reverses the comparator with dir -1", () => {
    const low = at("low", "a");
    const high = at("high", "b");
    const med = at("medium", "c");
    const groups = buildGroups([low, high, med], "none", "risk", -1);
    expect(groups[0].rows.map((r) => r.mutation.risk)).toEqual(["low", "medium", "high"]);
  });

  it("defaults dir to 1 when it is not passed", () => {
    const groups = buildGroups([at("low", "a"), at("high", "b")], "none", "risk");
    expect(groups[0].rows.map((r) => r.mutation.risk)).toEqual(["high", "low"]);
  });

  it("sorts an unrecognised risk last, behind low", () => {
    // riskRank has no entry for it, so it scores 9.
    const weird = plain({ mutation: makeMutation({ risk: "unknown" as "low" }) });
    const low = at("low", "a");
    const groups = buildGroups([weird, low], "none", "risk");
    expect(groups[0].rows.map((r) => r.mutation.risk)).toEqual(["low", "unknown"]);
  });

  it("keeps input order among equal rows (the sort is stable)", () => {
    const a = at("low", "a");
    const b = at("low", "b");
    const c = at("low", "c");
    expect(keys(buildGroups([c, a, b], "none", "risk")[0].rows)).toEqual([c.key, a.key, b.key]);
    // dir -1 negates the comparator, which leaves ties in input order too —
    // it is not a reversal of the sorted list.
    expect(keys(buildGroups([c, a, b], "none", "risk", -1)[0].rows)).toEqual([c.key, a.key, b.key]);
  });

  it("sorts by confidence ascending — least confident first", () => {
    const hi = at("low", "a", 0.99);
    const lo = at("low", "b", 0.2);
    expect(buildGroups([hi, lo], "none", "confidence")[0].rows.map((r) => r.mutation.confidence))
      .toEqual([0.2, 0.99]);
  });

  it("sorts by target title with localeCompare", () => {
    const groups = buildGroups([at("low", "beta"), at("low", "Alpha")], "none", "target");
    expect(groups[0].rows.map((r) => r.targetTitle)).toEqual(["Alpha", "beta"]);
  });

  it("falls back to the risk sorter for an unknown sorter id", () => {
    const groups = buildGroups([at("low", "a"), at("high", "b")], "none", "nope");
    expect(groups[0].rows.map((r) => r.mutation.risk)).toEqual(["high", "low"]);
  });

  it("names the sorters the queue offers", () => {
    expect(Object.entries(SORTERS).map(([id, s]) => [id, s.label])).toEqual([
      ["risk", "risk"],
      ["confidence", "confidence"],
      ["target", "target memory"],
    ]);
  });
});

describe("buildGroups — group order and input", () => {
  it("orders groups by first appearance in the SORTED list, not the input list", () => {
    const lowFirst = plain({ targetId: "n1", targetTitle: "n1", mutation: makeMutation({ risk: "low" }) });
    const highLater = plain({ targetId: "n2", targetTitle: "n2", mutation: makeMutation({ risk: "high" }) });
    const groups = buildGroups([lowFirst, highLater], "target", "risk");
    expect(groups.map((g) => g.id)).toEqual(["n2", "n1"]);
  });

  it("does not mutate or reorder the caller's list", () => {
    const a = plain({ mutation: makeMutation({ risk: "low" }) });
    const b = plain({ mutation: makeMutation({ risk: "high" }) });
    const list = [a, b];
    buildGroups(list, "none", "risk");
    expect(keys(list)).toEqual([a.key, b.key]);
  });

  it("returns no groups at all for an empty list", () => {
    expect(buildGroups([], "target", "risk")).toEqual([]);
    expect(buildGroups([], "none", "risk")).toEqual([]);
  });
});
