// Characterization of the dropped-dependency pass: the warning preflight
// cannot raise, because the reviewer's drop is deleted from the draft before
// the engine ever sees the accept.
//
// The two branches worth the most are drop-create detection (a warning needs a
// DROPPED create_note, and the dependent must be KEPT and not itself a create)
// and the link-target dependency (an add_link depends on two notes, not one).
// Every case names its draft explicitly, because the pass is scoped per draft.
//
// These tests pin CURRENT behavior, not desired behavior; where the two look
// like they disagree the test says so with `SUSPECT:` and still asserts what
// the code does.

import { beforeEach, describe, expect, it } from "vitest";

import type { Mutation, Note } from "../api/types";
import { type Decision, type Row } from "./review";
import { droppedDependencies } from "./dependencies";
import { makeMutation, makeNote, makeRow, resetIds } from "../test/factories";

beforeEach(resetIds);

function row(draftId: string, mutationId: string, targetId: string, mut: Partial<Mutation> = {}): Row {
  return makeRow({
    draftId,
    key: `${draftId}:${mutationId}`,
    targetId,
    mutation: makeMutation({ id: mutationId, ...mut }),
  });
}

function create(draftId: string, mutationId: string, targetId: string): Row {
  return row(draftId, mutationId, targetId, { kind: "create_note" });
}

function ledger(...entries: Array<[string, Decision]>): Map<string, Decision> {
  return new Map(entries);
}

const NO_NOTES = new Map<string, Note>();

describe("droppedDependencies", () => {
  it("warns when a kept claim writes into a note whose create was dropped", () => {
    const dropped = create("d1", "m1", "new-note");
    const kept = row("d1", "m2", "new-note");
    const dec = ledger(["d1:m1", "drop"], ["d1:m2", "keep"]);

    expect(droppedDependencies([dropped, kept], dec, NO_NOTES)).toEqual([{ kept, dropped }]);
  });

  it("raises nothing when the create is kept and the dependent is dropped", () => {
    const dec = ledger(["d1:m1", "keep"], ["d1:m2", "drop"]);

    expect(droppedDependencies([create("d1", "m1", "new-note"), row("d1", "m2", "new-note")], dec, NO_NOTES)).toEqual(
      [],
    );
  });

  it("raises nothing when the dependent is dropped alongside the create", () => {
    const dec = ledger(["d1:m1", "drop"], ["d1:m2", "drop"]);

    expect(droppedDependencies([create("d1", "m1", "new-note"), row("d1", "m2", "new-note")], dec, NO_NOTES)).toEqual(
      [],
    );
  });

  it("raises nothing when no create was dropped at all", () => {
    const dec = ledger(["d1:m1", "keep"], ["d1:m2", "keep"]);

    expect(droppedDependencies([create("d1", "m1", "new-note"), row("d1", "m2", "new-note")], dec, NO_NOTES)).toEqual(
      [],
    );
  });

  it("leaves an undecided dependent alone", () => {
    // Undecided claims are never sent, so nothing depends on the dropped
    // create resolving.
    const dec = ledger(["d1:m1", "drop"]);

    expect(droppedDependencies([create("d1", "m1", "new-note"), row("d1", "m2", "new-note")], dec, NO_NOTES)).toEqual(
      [],
    );
  });

  it("warns on a kept add_link whose link target's create was dropped", () => {
    const dropped = create("d1", "m1", "new-note");
    // Its own target is an existing note; only the LINK reaches the dropped one.
    const kept = row("d1", "m2", "old-note", {
      kind: "add_link",
      link: { target: "new-note", relation: "relates_to" },
    });
    const dec = ledger(["d1:m1", "drop"], ["d1:m2", "keep"]);
    const notes = new Map<string, Note>([["old-note", makeNote({ id: "old-note" })]]);

    expect(droppedDependencies([dropped, kept], dec, notes)).toEqual([{ kept, dropped }]);
  });

  it("ignores an add_link carrying no link", () => {
    const dec = ledger(["d1:m1", "drop"], ["d1:m2", "keep"]);

    expect(
      droppedDependencies(
        [create("d1", "m1", "new-note"), row("d1", "m2", "old-note", { kind: "add_link" })],
        dec,
        NO_NOTES,
      ),
    ).toEqual([]);
  });

  it("warns once for a claim whose target and link target are both dropped creates", () => {
    const droppedTarget = create("d1", "m1", "new-a");
    const kept = row("d1", "m3", "new-a", {
      kind: "add_link",
      link: { target: "new-b", relation: "relates_to" },
    });
    const dec = ledger(["d1:m1", "drop"], ["d1:m2", "drop"], ["d1:m3", "keep"]);

    const out = droppedDependencies([droppedTarget, create("d1", "m2", "new-b"), kept], dec, NO_NOTES);
    // The scan stops at the first unmet need, which is the row's own target.
    expect(out).toEqual([{ kept, dropped: droppedTarget }]);
  });

  it("raises nothing when the note already exists in the vault", () => {
    const dec = ledger(["d1:m1", "drop"], ["d1:m2", "keep"]);
    const notes = new Map<string, Note>([["new-note", makeNote({ id: "new-note" })]]);

    // The create was redundant, so dropping it breaks nothing.
    expect(droppedDependencies([create("d1", "m1", "new-note"), row("d1", "m2", "new-note")], dec, notes)).toEqual([]);
  });

  it("never pairs a kept claim with a dropped create in another draft", () => {
    // SUSPECT: the pass is scoped per draft, so a kept claim in d2 that targets
    // a note only created by a dropped create in d1 raises no warning — and
    // Apply sends both drafts in the same batch.
    const dec = ledger(["d1:m1", "drop"], ["d2:m2", "keep"]);

    expect(droppedDependencies([create("d1", "m1", "new-note"), row("d2", "m2", "new-note")], dec, NO_NOTES)).toEqual(
      [],
    );
  });

  it("does not warn about a kept create that shares the dropped create's target", () => {
    const dec = ledger(["d1:m1", "drop"], ["d1:m2", "keep"]);

    // create_note rows are skipped as dependents: a create does not need the
    // note to exist first.
    expect(
      droppedDependencies([create("d1", "m1", "new-note"), create("d1", "m2", "new-note")], dec, NO_NOTES),
    ).toEqual([]);
  });

  it("collects one warning per kept dependent across drafts", () => {
    const droppedA = create("d1", "m1", "new-a");
    const keptA1 = row("d1", "m2", "new-a");
    const keptA2 = row("d1", "m3", "new-a");
    const droppedB = create("d2", "m4", "new-b");
    const keptB = row("d2", "m5", "new-b");
    const dec = ledger(["d1:m1", "drop"], ["d1:m2", "keep"], ["d1:m3", "keep"], ["d2:m4", "drop"], ["d2:m5", "keep"]);

    expect(droppedDependencies([droppedA, keptA1, keptA2, droppedB, keptB], dec, NO_NOTES)).toEqual([
      { kept: keptA1, dropped: droppedA },
      { kept: keptA2, dropped: droppedA },
      { kept: keptB, dropped: droppedB },
    ]);
  });
});
