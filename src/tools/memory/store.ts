// Review state: the tri-state decision ledger.
//
// Judgment is separate from transmission. Every claim is undecided / keep /
// drop; decisions persist server-side (/console/state, keyed by engine
// target) so a review can span days and devices; undecided claims are never
// sent; Apply is a batch over everything decided. A draft with no decisions
// is never contacted, so an unfinished review resumes where it stopped.

import { createStore } from "../../lib/store";
import { type Mutation, type ReviewResponse } from "./api/types";
import { fetchReview } from "./api/drafts";
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
  toast(`${list.length} → ${value ?? t("memory.undecided")}`, { actionLabel: t("memoryvault.undo"), onAction: undo });
}

export function setEdited(key: string, mutation: Mutation | null) {
  const next = new Map(edited.get());
  if (mutation == null) next.delete(key); else next.set(key, mutation);
  edited.set(next);
  persist();
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
