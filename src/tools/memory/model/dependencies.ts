// The one structural failure preflight cannot raise: a kept claim whose target
// note only exists because of a create the reviewer dropped in the same draft.

import { type Note } from "../api/types";
import { type Decision, type Row } from "./review";

export interface DroppedDependency {
  kept: Row;
  dropped: Row;
}

/** The server auto-includes UNDECIDED dependencies but cannot recover one
 *  explicitly DROPPED — drops are deleted from the draft before the accept.
 *  That asymmetry is the one structural failure preflight cannot see, which is
 *  why this pass exists at all rather than being read off the preflight rows.
 *
 *  `notes` is the vault index: a create can be dropped for a note that already
 *  exists, and then nothing depends on the create to resolve. */
export function droppedDependencies(
  rows: Row[],
  decisions: ReadonlyMap<string, Decision>,
  notes: ReadonlyMap<string, Note>,
): DroppedDependency[] {
  const out: DroppedDependency[] = [];
  const byDraft = new Map<string, Row[]>();
  for (const row of rows) {
    let list = byDraft.get(row.draftId);
    if (!list) byDraft.set(row.draftId, (list = []));
    list.push(row);
  }
  for (const draftRows of byDraft.values()) {
    const droppedCreates = new Map<string, Row>();
    for (const r of draftRows) {
      if (decisions.get(r.key) === "drop" && r.mutation.kind === "create_note") {
        droppedCreates.set(r.targetId, r);
      }
    }
    if (!droppedCreates.size) continue;
    for (const r of draftRows) {
      if (decisions.get(r.key) !== "keep" || r.mutation.kind === "create_note") continue;
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
}
