// Review state: the tri-state decision ledger.
//
// Judgment is separate from transmission. Every claim is undecided / keep /
// drop; decisions persist server-side (/console/state, keyed by engine
// target) so a review can span days and devices; undecided claims are never
// sent; Apply is a batch over everything decided. A draft with no decisions
// is never contacted, so an unfinished review resumes where it stopped.

import { createStore, derived } from "../../lib/store";
import { type Mutation, type PreflightResponse, type ReviewResponse } from "./api/types";
import { fetchReview, preflightDraft } from "./api/drafts";
import { type BlockedDraft, type Decision, flattenReview, type Rejection, type Row } from "./model/review";
import { vaultLines, computeDerived } from "./model/derived";
import { isScoped, rowInScope } from "./model/scope";
import { currentScope, scopeCharacterId, scopeChatId } from "./store/scope";
import { lines, loadAllNotes, notesById } from "./store/notes";
import { activeFacets } from "./store/view";
import { t } from "../../copy";
import { toast } from "../../shell/toast";

export type { Decision };
export { lines, loadAllNotes, notesById } from "./store/notes";
export { pendingSources } from "./store/sources";
export { activeFacets, cursor, detailKey, facetSheetOpen, groupBy, sortBy, sortDir } from "./store/view";

// ── core state ──────────────────────────────────────────────────────

export const loading = createStore(true);
export const loadError = createStore<string | null>(null);
export const review = createStore<ReviewResponse | null>(null);
export const rows = createStore<Row[]>([]);
export const blocked = createStore<BlockedDraft[]>([]);
export const rejections = createStore<Rejection[]>([]);

export const decisions = createStore<Map<string, Decision>>(new Map());
export const edited = createStore<Map<string, Mutation>>(new Map());
export const appliedThisSession = new Map<string, "applied" | "skipped">();

export const saveState = createStore<"saved" | "saving" | "failed">("saved");
export const preflight = createStore<{ ready: number; blockedN: number; auto: number; perDraft: Array<{ draftId: string; pf: PreflightResponse }>; error?: string } | null>(null);
export const preflightPending = createStore(false);

const undoStack: Array<{ label: string; entries: Array<[string, Decision | null]> }> = [];

/** Record the outcome of one mutation so the next refresh drops its row. */
export function markApplied(key: string, outcome: "applied" | "skipped") {
  appliedThisSession.set(key, outcome);
}

/** Replace the whole ledger in one write, for a batch that resolved many keys. */
export function commitLedger(dec: Map<string, Decision>, ed: Map<string, Mutation>) {
  decisions.set(dec);
  edited.set(ed);
}

export function clearUndo() {
  undoStack.length = 0; // snapshots reference applied keys; undoing them would lie
  canUndo.set(false);
}

export function clearPreflight() {
  preflight.set(null);
}

// ── derived ─────────────────────────────────────────────────────────

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

// ── persistence ─────────────────────────────────────────────────────

let persistTimer: ReturnType<typeof setTimeout> | undefined;
let ledgerDirty = false;

async function persistNow(keepalive = false) {
  clearTimeout(persistTimer);
  persistTimer = undefined;
  try {
    const res = await fetch("/console/state/ltm-review", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      keepalive,
      body: JSON.stringify({
        dec: Object.fromEntries(decisions.get()),
        edited: Object.fromEntries(edited.get()),
        savedAt: new Date().toISOString(),
      }),
    });
    if (res.ok) ledgerDirty = false;
    saveState.set(res.ok ? "saved" : "failed");
  } catch {
    saveState.set("failed");
  }
}

export function persist() {
  ledgerDirty = true;
  saveState.set("saving");
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => void persistNow(), 700);
}

// A trailing debounce alone loses the last ~700ms of decisions on tab close;
// flush whenever the page goes hidden (DESIGN §2: "flush on blur").
function flushLedger() {
  if (ledgerDirty) void persistNow(true);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushLedger();
});
window.addEventListener("pagehide", flushLedger);

export function retryPersist() {
  void persistNow();
}

async function loadPersisted() {
  // Never clobber decisions that haven't been persisted yet (remount inside
  // the debounce window).
  if (ledgerDirty) return;
  try {
    const s = await (await fetch("/console/state/ltm-review")).json();
    decisions.set(new Map(Object.entries(s.dec ?? {})));
    edited.set(new Map(Object.entries(s.edited ?? {})));
  } catch { /* fresh start */ }
}

// ── decisions ───────────────────────────────────────────────────────

function snapshot(label: string, keys: string[]) {
  undoStack.push({ label, entries: keys.map((k) => [k, decisions.get().get(k) ?? null]) });
  if (undoStack.length > 50) undoStack.shift();
}

export const canUndo = createStore(false);

export function undo() {
  const snap = undoStack.pop();
  canUndo.set(undoStack.length > 0);
  if (!snap) return;
  const next = new Map(decisions.get());
  for (const [k, v] of snap.entries) {
    if (v == null) next.delete(k); else next.set(k, v);
  }
  decisions.set(next);
  persist();
  schedulePreflight();
  toast(t("memory.toast.undid", { action: snap.label }));
}

export function setDecision(row: Row, value: Decision | null) {
  if ((decisions.get().get(row.key) ?? null) === value) return; // no-op
  snapshot(value ?? "undecide", [row.key]);
  canUndo.set(true);
  const next = new Map(decisions.get());
  if (value == null) next.delete(row.key); else next.set(row.key, value);
  decisions.set(next);
  persist();
  schedulePreflight();
}

/** undecided → keep → drop → undecided */
export function cycleDecision(row: Row) {
  const cur = decisions.get().get(row.key);
  setDecision(row, cur === "keep" ? "drop" : cur === "drop" ? null : "keep");
}

export function bulkDecide(list: Row[], value: Decision | null, label: string) {
  list = list.filter((r) => (decisions.get().get(r.key) ?? null) !== value);
  if (!list.length) return;
  snapshot(label, list.map((r) => r.key));
  canUndo.set(true);
  const next = new Map(decisions.get());
  for (const r of list) {
    if (value == null) next.delete(r.key); else next.set(r.key, value);
  }
  decisions.set(next);
  persist();
  schedulePreflight();
  toast(`${list.length} → ${value ?? t("memory.undecided")}`, { actionLabel: t("memoryvault.undo"), onAction: undo });
}

export function setEdited(key: string, mutation: Mutation | null) {
  const next = new Map(edited.get());
  if (mutation == null) next.delete(key); else next.set(key, mutation);
  edited.set(next);
  persist();
  schedulePreflight();
}

// ── loading ─────────────────────────────────────────────────────────

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

// Scope is a location, not a filter you re-apply by hand: changing it changes
// what the queue is, immediately and everywhere.
scopeCharacterId.subscribe(applyScope);
scopeChatId.subscribe(applyScope);

export async function refresh(first = false) {
  const focus = sessionStorage.getItem("mc-ltm-focus-source");
  if (focus) sessionStorage.removeItem("mc-ltm-focus-source");
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
    const sourceTitles = new Map(allNotes.filter((n) => n.type === "source").map((n) => [n.id, n.title ?? n.id]));
    lines.set(vaultLines(allNotes));
    const flat = flattenReview(data, sourceTitles);
    const live = flat.rows.filter((r) => !appliedThisSession.has(r.key));
    computeDerived(live, lines.get());
    rowsBeforeScope = live;
    applyScope();
    blocked.set(flat.blocked);
    rejections.set(flat.rejections);
    // prune decisions for claims that no longer exist
    const liveKeys = new Set(live.map((r) => r.key));
    let pruned = false;
    const dec = new Map(decisions.get());
    for (const k of [...dec.keys()]) if (!liveKeys.has(k)) { dec.delete(k); pruned = true; }
    const ed = new Map(edited.get());
    for (const k of [...ed.keys()]) if (!liveKeys.has(k)) { ed.delete(k); pruned = true; }
    if (pruned) { decisions.set(dec); edited.set(ed); persist(); }
    // Sources → Review handoff: pre-filter to the just-imported source.
    if (focus) {
      const title = sourceTitles.get(focus) ?? focus;
      const next = new Map(activeFacets.get());
      next.set("source", new Set([title]));
      activeFacets.set(next);
    }
    loadError.set(null);
  } catch (error) {
    loadError.set((error as Error).message);
  }
  loading.set(false);
  schedulePreflight();
}

// ── preflight ───────────────────────────────────────────────────────

let preflightTimer: ReturnType<typeof setTimeout> | undefined;
let preflightSeq = 0;

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

function preflightBody(list: Row[]) {
  const body: { mutationIds: string[]; editedMutations?: Mutation[] } = {
    mutationIds: list.map((r) => r.mutation.id),
  };
  const ed = list.map((r) => edited.get().get(r.key)).filter(Boolean) as Mutation[];
  if (ed.length) body.editedMutations = ed;
  return body;
}

export function schedulePreflight() {
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
