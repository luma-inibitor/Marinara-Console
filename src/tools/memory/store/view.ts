// The review queue's view state: how the list is arranged and what is open. A
// store rather than `useState` only so it outlives a trip to another screen.

import { createStore } from "../../../lib/store";

export const groupBy = createStore<"target" | "source" | "disposition" | "kind" | "none">("target");
export const sortBy = createStore<"risk" | "confidence" | "target">("risk");
export const sortDir = createStore<1 | -1>(1);
export const activeFacets = createStore<Map<string, Set<string>>>(new Map());
export const cursor = createStore<string | null>(null);
export const detailKey = createStore<string | null>(null); // open detail panel/screen
export const facetSheetOpen = createStore(false);
// Group and sort are one question — how the queue is arranged — so they share
// one sheet rather than the two Pickers they used to open separately.
export const viewSheetOpen = createStore(false);
// The dock states figures; this sheet explains them. Opened from the tally
// itself, so the control that shows the numbers is the one that expands them.
export const dockSheetOpen = createStore(false);
