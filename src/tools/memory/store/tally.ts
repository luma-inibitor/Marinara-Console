// Owns the three read-only counts the review surface quotes back to the
// reviewer: the decision tally, how many mutations Apply will really send, and
// the dropped-dependency warnings preflight cannot raise. Nothing writes them —
// each is a `derived()` over the ledger and the queue.
//
// The import edge is one-way on purpose: this module reads `./decisions` and
// `./review`, and neither may read this one. Those modules install
// subscriptions at module scope and the stores derived from them compute
// eagerly at construction — a cycle would evaluate one of those `const`s
// before its initializer ran and throw at import time. Nothing else in
// `store/` may import this module either; its only consumer is the Review
// screen.

import { derived } from "../../../lib/store";
import { type Row } from "../model/review";
import { decisions, edited } from "./decisions";
import { rows } from "./review";
import { notesById } from "./notes";
import { preflight } from "./preflight";

/** How many mutations Apply will actually send: the engine's ready set for
 *  each draft, minus the ids the reviewer dropped in that same draft.
 *
 *  The subtraction is load-bearing: preflight can auto-include a dependency the
 *  reviewer explicitly dropped, and `applyDecided` filters those out before
 *  sending. Anything stating a send count must apply the same rule or it will
 *  quote a figure Apply does not honor. */
export const readyToSend = derived([preflight, rows, decisions], (pf, allRows, dec) => {
  if (!pf) return 0;
  const droppedByDraft = new Map<string, Set<string>>();
  for (const row of allRows) {
    if (dec.get(row.key) !== "drop") continue;
    let set = droppedByDraft.get(row.draftId);
    if (!set) droppedByDraft.set(row.draftId, (set = new Set()));
    set.add(row.mutation.id);
  }
  let n = 0;
  for (const { draftId, pf: draftPf } of pf.perDraft) {
    const dropped = droppedByDraft.get(draftId);
    for (const id of draftPf.readyMutationIds ?? []) {
      if (!dropped?.has(id)) n += 1;
    }
  }
  return n;
});

export const tally = derived([rows, decisions, edited], (allRows, dec, ed) => {
  let keep = 0, drop = 0;
  const touched = new Set<string>(), undecidedDrafts = new Set<string>();
  for (const row of allRows) {
    const d = dec.get(row.key);
    if (d === "keep") keep += 1;
    else if (d === "drop") drop += 1;
    if (d) touched.add(row.draftId); else undecidedDrafts.add(row.draftId);
  }
  return {
    keep, drop,
    undecided: allRows.length - keep - drop,
    edited: ed.size,
    willSend: touched.size,
    stayPending: [...undecidedDrafts].filter((id) => touched.has(id)).length,
  };
});

/** The server auto-includes UNDECIDED dependencies but cannot recover one
 *  explicitly DROPPED — drops are deleted from the draft before the accept.
 *  That asymmetry is the one structural failure preflight cannot see. */
export const droppedDependencyWarnings = derived([rows, decisions, notesById], (allRows, dec, notes) => {
  const out: Array<{ kept: Row; dropped: Row }> = [];
  const byDraft = new Map<string, Row[]>();
  for (const row of allRows) {
    let list = byDraft.get(row.draftId);
    if (!list) byDraft.set(row.draftId, (list = []));
    list.push(row);
  }
  for (const draftRows of byDraft.values()) {
    const droppedCreates = new Map<string, Row>();
    for (const r of draftRows) {
      if (dec.get(r.key) === "drop" && r.mutation.kind === "create_note") {
        droppedCreates.set(r.targetId, r);
      }
    }
    if (!droppedCreates.size) continue;
    for (const r of draftRows) {
      if (dec.get(r.key) !== "keep" || r.mutation.kind === "create_note") continue;
      // A kept claim depends on its target note AND on any note it links to.
      const needs = new Set<string>([r.targetId]);
      if (r.mutation.kind === "add_link" && r.mutation.link) needs.add(r.mutation.link.target);
      for (const id of needs) {
        if (droppedCreates.has(id) && !notes.has(id)) {
          out.push({ kept: r, dropped: droppedCreates.get(id)! });
          break;
        }
      }
    }
  }
  return out;
});
