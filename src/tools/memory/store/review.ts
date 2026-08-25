// Owns the review queue: the load state, the engine's response, the rows the
// screen works through, and the blocked drafts and rejections beside them.
// Nothing else writes those.
//
// The import edge is one-way: this module reads `./decisions.ts` for the
// ledger, and `./decisions.ts` reads nothing from `store/`. Pruning after a
// refresh goes through `pruneLedger`, so the queue never writes the ledger's
// stores itself. Modules that derive from the queue — pressure, preflight,
// tally, apply — read this one and must never be read by it: `derived()`
// computes eagerly at construction, so a cycle would evaluate a `const` before
// its initializer ran and throw at import time.
//
// The two `scope*.subscribe(applyScope)` calls at the bottom are what make
// scope a location rather than a filter. They are installed when this module
// first runs, so scope only narrows the queue while something imports this
// module — an import cleanup that dropped the last importer would silently
// stop scope filtering, with no type error.

import { createStore } from "../../../lib/store";
import { type ReviewResponse } from "../api/types";
import { fetchReview } from "../api/drafts";
import { type BlockedDraft, flattenReview, type Rejection, type Row } from "../model/review";
import { vaultLines, computeDerived } from "../model/derived";
import { isScoped, rowInScope } from "../model/scope";
import { currentScope, scopeCharacterId, scopeChatId } from "./scope";
import { lines, loadAllNotes, notesById } from "./notes";
import { activeFacets } from "./view";
import { decisions, loadPersisted, pruneLedger } from "./decisions";
import { consumeFocusSource } from "./sources";

export const loading = createStore(true);
export const loadError = createStore<string | null>(null);
export const review = createStore<ReviewResponse | null>(null);
export const rows = createStore<Row[]>([]);
export const blocked = createStore<BlockedDraft[]>([]);
export const rejections = createStore<Rejection[]>([]);

const appliedThisSession = new Map<string, "applied" | "skipped">();

/** Record the outcome of one mutation so the next refresh drops its row. */
export function markApplied(key: string, outcome: "applied" | "skipped") {
  appliedThisSession.set(key, outcome);
}

// Every live row the last refresh produced, before scope narrows them. `rows`
// holds only what the current scope shows, so the tally, the facets, the
// groups and the apply dock all speak about the same set — scoping the list
// but not the counts beside it is how a header ends up contradicting its rows.
let rowsBeforeScope: Row[] = [];

function applyScope() {
  const scope = currentScope();
  const byId = notesById.get();
  rows.set(isScoped(scope) ? rowsBeforeScope.filter((r) => rowInScope(r, byId, scope)) : rowsBeforeScope);
}

export async function refresh(first = false) {
  const focus = consumeFocusSource();
  if (first) {
    loading.set(true);
    await loadPersisted();
  }
  try {
    const [data, allNotes] = await Promise.all([
      fetchReview(),
      loadAllNotes(),
    ]);
    review.set(data);
    notesById.set(new Map(allNotes.map((n) => [n.id, n])));
    const sourceNotes = new Map(allNotes.filter((n) => n.type === "source").map((n) => [n.id, n]));
    lines.set(vaultLines(allNotes));
    const flat = flattenReview(data, sourceNotes);
    const live = flat.rows.filter((r) => !appliedThisSession.has(r.key));
    computeDerived(live, lines.get());
    rowsBeforeScope = live;
    applyScope();
    blocked.set(flat.blocked);
    rejections.set(flat.rejections);
    // prune decisions for claims that no longer exist
    pruneLedger(new Set(live.map((r) => r.key)));
    // Sources → Review handoff: pre-filter to the just-imported source.
    if (focus) {
      const title = sourceNotes.get(focus)?.title ?? focus;
      const next = new Map(activeFacets.get());
      next.set("source", new Set([title]));
      activeFacets.set(next);
    }
    loadError.set(null);
  } catch (error) {
    loadError.set((error as Error).message);
  }
  loading.set(false);
}

export function keepsByDraft() {
  const byDraft = new Map<string, Row[]>();
  for (const row of rows.get()) {
    if (decisions.get().get(row.key) !== "keep") continue;
    let list = byDraft.get(row.draftId);
    if (!list) byDraft.set(row.draftId, (list = []));
    list.push(row);
  }
  return byDraft;
}

// Scope is a location, not a filter you re-apply by hand: changing it changes
// what the queue is, immediately and everywhere.
scopeCharacterId.subscribe(applyScope);
scopeChatId.subscribe(applyScope);
