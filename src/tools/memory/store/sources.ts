// Owns the count the Sources screen publishes for the nav badge.
//
// The Sources screen writes this store directly, and that is legitimate: it is
// view state, a figure one screen computes for another to display, not entity
// state whose change has to reach the server and recompute anything. A layer
// check that forbids screens writing entity stores should not read this as a
// violation.

import { createStore } from "../../../lib/store";

/** Sources waiting to be imported, in the current scope. The nav badge reads
 *  this, and every nav badge must mean "waiting" — a badge counting work
 *  already done would give the same channel two opposite meanings. Null until
 *  the Sources screen has computed it once. */
export const pendingSources = createStore<number | null>(null);
