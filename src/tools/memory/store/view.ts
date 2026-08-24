// Owns the review queue's view state: how the list is arranged and what is
// open. Nothing else has to happen when one of these changes, so the screen
// writing it is the screen describing itself — a store rather than `useState`
// only so the arrangement outlives a trip to another screen.

import { createStore } from "../../../lib/store";

export const groupBy = createStore<"target" | "source" | "disposition" | "kind" | "none">("target");
export const sortBy = createStore<"risk" | "confidence" | "target">("risk");
export const sortDir = createStore<1 | -1>(1);
export const activeFacets = createStore<Map<string, Set<string>>>(new Map());
export const cursor = createStore<string | null>(null);
export const detailKey = createStore<string | null>(null); // open detail panel/screen
export const facetSheetOpen = createStore(false);
