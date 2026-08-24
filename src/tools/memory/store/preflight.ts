// Owns the preflight pass: the engine's per-draft verdict on the kept set, the
// pending flag while one is debounced or in flight, and the row-level index the
// badges read off it. Nothing else writes those three.
//
// It is kept current by SUBSCRIBING to its three inputs rather than by being
// called from each site that changes one. The subscriptions are set up when
// this module first runs, so preflight only tracks its inputs while something
// imports this module — an import cleanup that drops the last importer would
// silently stop the queue from ever being preflighted, with no type error.
//
// The import edge is one-way on purpose: this module reads `../store`, and
// `../store` must never read this one. `../store` computes `derived()` stores
// and installs subscriptions at module scope, and `derived()` computes eagerly
// at construction — a cycle would evaluate one of those `const`s before its
// initializer ran and throw at import time.

import { createStore, derived } from "../../../lib/store";
import { type Mutation, type PreflightResponse } from "../api/types";
import { preflightDraft } from "../api/drafts";
import { type Row } from "../model/review";
import { decisions, edited, keepsByDraft, rows } from "../store";

export const preflight = createStore<{ ready: number; blockedN: number; auto: number; perDraft: Array<{ draftId: string; pf: PreflightResponse }>; error?: string } | null>(null);
export const preflightPending = createStore(false);

/** row key -> preflight outcome, for row badges and dock enumeration. */
export const preflightRowState = derived([preflight], (pf) => {
  const auto = new Map<string, true>();
  const blockedRows = new Map<string, string>(); // key -> first blocker message
  if (pf) {
    for (const { draftId, pf: draftPf } of pf.perDraft) {
      for (const row of draftPf.rows) {
        const key = `${draftId}:${row.mutationId}`;
        if (row.autoIncluded) auto.set(key, true);
        if (row.status === "blocked") blockedRows.set(key, row.blockers[0]?.message ?? "blocked");
      }
    }
  }
  return { auto, blockedRows };
});

export function clearPreflight() {
  preflight.set(null);
}

let preflightTimer: ReturnType<typeof setTimeout> | undefined;
let preflightSeq = 0;

function preflightBody(list: Row[]) {
  const body: { mutationIds: string[]; editedMutations?: Mutation[] } = {
    mutationIds: list.map((r) => r.mutation.id),
  };
  const ed = list.map((r) => edited.get().get(r.key)).filter(Boolean) as Mutation[];
  if (ed.length) body.editedMutations = ed;
  return body;
}

function schedulePreflight() {
  clearTimeout(preflightTimer);
  preflightPending.set(true);
  preflightTimer = setTimeout(() => void runPreflight(), 500);
}

/** Cancel the debounce and run a preflight right now. */
export async function preflightNow() {
  clearTimeout(preflightTimer);
  preflightTimer = undefined;
  await runPreflight();
}

async function runPreflight() {
  const seq = ++preflightSeq;
  const byDraft = keepsByDraft();
  if (!byDraft.size) {
    preflight.set(null);
    preflightPending.set(false);
    return;
  }
  try {
    const results = await Promise.all(
      [...byDraft.entries()].map(([draftId, list]) =>
        preflightDraft(draftId, preflightBody(list)).then((pf) => ({ draftId, pf })),
      ),
    );
    if (seq !== preflightSeq) return;
    let ready = 0, blockedN = 0, auto = 0;
    for (const { pf } of results) {
      ready += pf.readyMutationIds.length;
      blockedN += pf.blockedMutationIds.length;
      auto += pf.autoIncludedMutationIds.length;
    }
    preflight.set({ ready, blockedN, auto, perDraft: results });
  } catch (error) {
    if (seq !== preflightSeq) return;
    preflight.set({ ready: 0, blockedN: 0, auto: 0, perDraft: [], error: (error as Error).message });
  }
  if (seq === preflightSeq) preflightPending.set(false);
}

function onInputChanged() {
  // An empty queue has no kept rows, so the request would always resolve to the
  // same empty verdict: settle it here instead of holding `pending` true for
  // half a second on first load and on a scope that matches nothing.
  if (!rows.get().length) {
    clearTimeout(preflightTimer);
    preflightTimer = undefined;
    preflightPending.set(false);
    preflight.set(null);
    return;
  }
  schedulePreflight();
}

// Exactly the three values a preflight body is built from. `rows` narrows to
// the current scope, so a scope change re-preflights the set the dock actually
// speaks about.
//
// One refresh writes several of these in a row; the debounce coalesces that
// into a single request, which is why subscribing does not multiply requests.
rows.subscribe(onInputChanged);
decisions.subscribe(onInputChanged);
edited.subscribe(onInputChanged);
