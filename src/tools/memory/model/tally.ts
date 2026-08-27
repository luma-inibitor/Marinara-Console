// The two read-only figures the review surface quotes back to the reviewer:
// the decision tally under the queue, and the single send count in the dock.
// Both are pure functions of the ledger and the queue; `store/tally.ts` is the
// only thing that wires them to stores.

import { type Decision, type Row } from "./review";

interface Tally {
  keep: number;
  drop: number;
  undecided: number;
  edited: number;
  /** Drafts Apply will contact — a draft with at least one decision. */
  willSend: number;
  /** Drafts that will still be pending after Apply, because they hold both a
   *  decided claim and an undecided one. Undecided claims are never sent, so
   *  such a draft is contacted and survives. */
  stayPending: number;
}

/** `editedCount` rather than the ledger itself: the tally reads nothing from
 *  the edit map but its size. */
export function countTally(rows: Row[], decisions: ReadonlyMap<string, Decision>, editedCount: number): Tally {
  let keep = 0,
    drop = 0;
  const touched = new Set<string>(),
    undecidedDrafts = new Set<string>();
  for (const row of rows) {
    const d = decisions.get(row.key);
    if (d === "keep") keep += 1;
    else if (d === "drop") drop += 1;
    if (d) touched.add(row.draftId);
    else undecidedDrafts.add(row.draftId);
  }
  return {
    keep,
    drop,
    undecided: rows.length - keep - drop,
    edited: editedCount,
    willSend: touched.size,
    stayPending: [...undecidedDrafts].filter((id) => touched.has(id)).length,
  };
}

/** The slice of the preflight result the send count reads. Structural on
 *  purpose: the full store value satisfies it, and nothing here needs the rest
 *  of the per-draft verdict. */
export interface ReadySets {
  perDraft: Array<{ draftId: string; pf: { readyMutationIds?: string[] } }>;
}

/** How many mutations Apply will actually send: the engine's ready set for
 *  each draft, minus the ids the reviewer dropped in that same draft.
 *
 *  The subtraction is load-bearing: preflight can auto-include a dependency the
 *  reviewer explicitly dropped, and `applyDecided` filters those out before
 *  sending. Anything stating a send count must apply the same rule or it will
 *  quote a figure Apply does not honor. */
export function countReadyToSend(
  preflight: ReadySets | null,
  rows: Row[],
  decisions: ReadonlyMap<string, Decision>,
): number {
  if (!preflight) return 0;
  const droppedByDraft = new Map<string, Set<string>>();
  for (const row of rows) {
    if (decisions.get(row.key) !== "drop") continue;
    let set = droppedByDraft.get(row.draftId);
    if (!set) droppedByDraft.set(row.draftId, (set = new Set()));
    set.add(row.mutation.id);
  }
  let n = 0;
  for (const { draftId, pf: draftPf } of preflight.perDraft) {
    const dropped = droppedByDraft.get(draftId);
    for (const id of draftPf.readyMutationIds ?? []) {
      if (!dropped?.has(id)) n += 1;
    }
  }
  return n;
}
