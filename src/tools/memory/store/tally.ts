// Owns the three read-only counts the review surface quotes back to the
// reviewer: the decision tally, how many mutations Apply will really send, and
// the dropped-dependency warnings preflight cannot raise. Nothing writes them —
// each is a `derived()` over the ledger and the queue, and the arithmetic
// itself lives in `model/tally.ts` and `model/dependencies.ts`.
//
// Import edges in `store/` are one-way; see ARCHITECTURE.md, "Why `store/` is acyclic".
// Nothing else in `store/` may import this module either; its only consumer
// is the Review screen.

import { derived } from "../../../lib/store";
import { droppedDependencies } from "../model/dependencies";
import { countReadyToSend, countTally } from "../model/tally";
import { decisions, edited } from "./decisions";
import { rows } from "./review";
import { notesById } from "./notes";
import { preflight } from "./preflight";

export const readyToSend = derived([preflight, rows, decisions], (pf, allRows, dec) =>
  countReadyToSend(pf, allRows, dec),
);

export const tally = derived([rows, decisions, edited], (allRows, dec, ed) => countTally(allRows, dec, ed.size));

export const droppedDependencyWarnings = derived([rows, decisions, notesById], (allRows, dec, notes) =>
  droppedDependencies(allRows, dec, notes),
);
