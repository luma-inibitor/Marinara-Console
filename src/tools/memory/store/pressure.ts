// Owns the cap-pressure map: how full every section the queue writes to would
// be if the queue were applied. Nothing else writes it.
//
// Kept current by SUBSCRIBING to its three inputs, not by a call from each site
// that changes one. Drop the last importer and the map silently freezes.
//
// Import edges in `store/` are one-way; see ARCHITECTURE.md, "Why `store/` is acyclic".

import { createStore } from "../../../lib/store";
import { computePressure, type SectionPressure } from "../model/pressure";
import { decisions } from "./decisions";
import { rows } from "./review";
import { notesById } from "./notes";

function compute() {
  return computePressure(rows.get(), (k) => decisions.get().get(k), notesById.get());
}

/** Section key (`${noteId} ${sectionKey}`) -> projected size. */
export const pressure = createStore<Map<string, SectionPressure>>(compute());

function recompute() {
  pressure.set(compute());
}

// Exactly the three values computePressure reads. `rows` narrows to the current
// scope, which is the set the badges are drawn against.
//
// `rows.set()` short-circuits on Object.is, so re-setting the identical array
// does not fire this. That is only reachable when scoping resolves to the
// unfiltered array twice in a row — nothing about the queue changed, so the
// pressure it would recompute is the pressure already held.
rows.subscribe(recompute);
decisions.subscribe(recompute);
notesById.subscribe(recompute);
