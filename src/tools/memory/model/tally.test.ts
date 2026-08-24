// Characterization of the two figures the review surface quotes: the decision
// tally under the queue and the send count in the dock.
//
// The subtle pair is `willSend` / `stayPending`, and they are counted in
// DRAFTS while `keep` / `drop` / `undecided` are counted in CLAIMS — so every
// case here says which draft each row belongs to, because that is the input
// those two actually read. `stayPending` is the intersection: a draft holding
// both a decided claim and an undecided one is contacted and survives.
//
// These tests pin CURRENT behavior, not desired behavior; where the two look
// like they disagree the test says so with `SUSPECT:` and still asserts what
// the code does.

import { beforeEach, describe, expect, it } from "vitest";

import { type Decision, type Row } from "./review";
import { type ReadySets, countReadyToSend, countTally } from "./tally";
import { makeMutation, makeRow, resetIds } from "../test/factories";

beforeEach(resetIds);

/** A row placed in a named draft with a named mutation id — the three fields
 *  both counts read, and the ones makeRow otherwise generates per row. */
function row(draftId: string, mutationId: string, over: Partial<Row> = {}): Row {
  return makeRow({
    draftId,
    key: `${draftId}:${mutationId}`,
    ...over,
    mutation: makeMutation({ id: mutationId }),
  });
}

function ledger(...entries: Array<[string, Decision]>): Map<string, Decision> {
  return new Map(entries);
}

describe("countTally", () => {
  it("is all zeros for an empty queue", () => {
    expect(countTally([], new Map(), 0)).toEqual({
      keep: 0, drop: 0, undecided: 0, edited: 0, willSend: 0, stayPending: 0,
    });
  });

  it("counts keep, drop and undecided across one draft", () => {
    const rows = [row("d1", "m1"), row("d1", "m2"), row("d1", "m3"), row("d1", "m4")];
    const dec = ledger(["d1:m1", "keep"], ["d1:m2", "keep"], ["d1:m3", "drop"]);

    expect(countTally(rows, dec, 0)).toEqual({
      keep: 2, drop: 1, undecided: 1, edited: 0,
      // One draft carries a decision, and that same draft still holds m4.
      willSend: 1, stayPending: 1,
    });
  });

  it("clears stayPending once every claim in the touched draft is decided", () => {
    const rows = [row("d1", "m1"), row("d1", "m2")];
    const dec = ledger(["d1:m1", "keep"], ["d1:m2", "drop"]);

    expect(countTally(rows, dec, 0)).toMatchObject({ willSend: 1, stayPending: 0, undecided: 0 });
  });

  it("does not contact a draft with no decisions at all", () => {
    const rows = [row("d1", "m1"), row("d1", "m2")];

    expect(countTally(rows, new Map(), 0)).toMatchObject({
      keep: 0, drop: 0, undecided: 2, willSend: 0, stayPending: 0,
    });
  });

  it("counts drafts, not claims, in willSend and stayPending", () => {
    const rows = [
      row("d1", "m1"), row("d1", "m2"), // decided + undecided -> stays pending
      row("d2", "m3"), row("d2", "m4"), // both decided -> sent and finished
      row("d3", "m5"), // untouched -> not contacted
    ];
    const dec = ledger(
      ["d1:m1", "keep"],
      ["d2:m3", "keep"], ["d2:m4", "drop"],
    );

    expect(countTally(rows, dec, 0)).toEqual({
      keep: 2, drop: 1, undecided: 2, edited: 0, willSend: 2, stayPending: 1,
    });
  });

  it("ignores ledger entries for keys not in the queue", () => {
    const rows = [row("d1", "m1")];
    const dec = ledger(["d1:m1", "keep"], ["gone:m9", "drop"]);

    expect(countTally(rows, dec, 0)).toMatchObject({ keep: 1, drop: 0, undecided: 0, willSend: 1 });
  });

  it("reports the edit count as given, and an edit alone decides nothing", () => {
    const rows = [row("d1", "m1")];

    // The row is edited but undecided: it still counts as undecided, and its
    // draft is neither contacted nor pending.
    expect(countTally(rows, new Map(), 1)).toEqual({
      keep: 0, drop: 0, undecided: 1, edited: 1, willSend: 0, stayPending: 0,
    });
  });

  it("passes through an edit count larger than the queue", () => {
    // SUSPECT: `edited` is the raw size of the edit ledger, never intersected
    // with the rows on screen. An edit whose row has since left the queue is
    // still quoted to the reviewer as an edit they made to it.
    expect(countTally([], new Map(), 3).edited).toBe(3);
  });

  it("keeps keep and drop disjoint per claim", () => {
    const rows = [row("d1", "m1"), row("d2", "m2")];
    const dec = ledger(["d1:m1", "drop"], ["d2:m2", "drop"]);

    expect(countTally(rows, dec, 0)).toMatchObject({ keep: 0, drop: 2, undecided: 0, willSend: 2 });
  });
});

describe("countReadyToSend", () => {
  function pf(...drafts: Array<[string, string[] | undefined]>): ReadySets {
    return { perDraft: drafts.map(([draftId, ids]) => ({ draftId, pf: { readyMutationIds: ids } })) };
  }

  it("is zero before any preflight has landed", () => {
    const rows = [row("d1", "m1")];

    expect(countReadyToSend(null, rows, ledger(["d1:m1", "keep"]))).toBe(0);
  });

  it("sums the ready sets across drafts when nothing is dropped", () => {
    const rows = [row("d1", "m1"), row("d2", "m3")];

    expect(countReadyToSend(pf(["d1", ["m1", "m2"]], ["d2", ["m3"]]), rows, ledger(["d1:m1", "keep"]))).toBe(3);
  });

  it("subtracts a dropped id from its own draft's ready set", () => {
    const rows = [row("d1", "m1"), row("d1", "m2")];
    const dec = ledger(["d1:m1", "keep"], ["d1:m2", "drop"]);

    // m2 is ready only because preflight auto-included it as a dependency;
    // Apply filters it out, so the dock must not count it.
    expect(countReadyToSend(pf(["d1", ["m1", "m2"]]), rows, dec)).toBe(1);
  });

  it("scopes the subtraction to the draft the drop was made in", () => {
    // Same mutation id in two drafts: dropping it in d2 must not shrink d1.
    const rows = [row("d1", "m1"), row("d2", "m1")];
    const dec = ledger(["d2:m1", "drop"]);

    expect(countReadyToSend(pf(["d1", ["m1"]], ["d2", ["m1"]]), rows, dec)).toBe(1);
  });

  it("treats a draft with no ready set as contributing nothing", () => {
    expect(countReadyToSend(pf(["d1", undefined], ["d2", []]), [], new Map())).toBe(0);
  });

  it("counts a ready id that no longer has a row", () => {
    // SUSPECT: preflight is debounced, so between a queue change and the next
    // response the ready set can name mutations — or whole drafts — that are
    // no longer on screen, and every one of them is still quoted in the dock's
    // send count. Only DROPS are reconciled against the current rows here.
    expect(countReadyToSend(pf(["gone", ["m1", "m2"]]), [], new Map())).toBe(2);
  });

  it("counts a kept row's ready id once, and ignores a drop the engine never readied", () => {
    const rows = [row("d1", "m1"), row("d1", "m2")];
    const dec = ledger(["d1:m1", "keep"], ["d1:m2", "drop"]);

    expect(countReadyToSend(pf(["d1", ["m1"]]), rows, dec)).toBe(1);
  });
});
