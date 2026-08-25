// Owns the tri-state decision ledger: what the reviewer decided about each
// claim, the edits made to those claims, the undo stack behind them, and the
// persistence that carries all of it across days and devices. Nothing else
// writes those stores.
//
// Judgment is separate from transmission. Every claim is undecided / keep /
// drop; decisions persist server-side (/console/state, keyed by engine
// target) so a review can span days and devices; undecided claims are never
// sent; Apply is a batch over everything decided. A draft with no decisions
// is never contacted, so an unfinished review resumes where it stopped.
//
// Persistence stays in this module rather than in one of its own. `persist` is
// called by every setter and reads exactly these two stores; splitting it out
// would need the ledger back and buy a cycle for nothing. The request itself is
// not this module's to own — `api/ledger.ts` knows the key and the record, and
// the transport under it knows that console state does not go through /api.
//
// This module imports NOTHING from `store/`. That is the edge that keeps the
// state layer acyclic: `store/review.ts` reads this module, and `derived()`
// computes eagerly at construction, so a cycle would evaluate a `const` before
// its initializer ran and throw at import time.
//
// The `visibilitychange` / `pagehide` flush listeners are registered when this
// module first runs, so the ledger is only flushed on page-hide while
// something imports it. They used to be unconditional in a module the screens
// always loaded; an import cleanup that dropped the last importer would now
// silently lose the last ~700ms of decisions on tab close, with no type error.

import { createStore } from "../../../lib/store";
import { fetchLedger, saveLedger } from "../api/ledger";
import { type Mutation } from "../api/types";
import { type Decision, type Row } from "../model/review";
import { t } from "../../../copy";
import { toast } from "../../../shell/toast";

export type { Decision };

export const decisions = createStore<Map<string, Decision>>(new Map());
export const edited = createStore<Map<string, Mutation>>(new Map());

export const saveState = createStore<"saved" | "saving" | "failed">("saved");
export const canUndo = createStore(false);

const undoStack: Array<{ label: string; entries: Array<[string, Decision | null]> }> = [];

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
    const ok = await saveLedger({
      dec: Object.fromEntries(decisions.get()),
      edited: Object.fromEntries(edited.get()),
      savedAt: new Date().toISOString(),
    }, keepalive);
    if (ok) ledgerDirty = false;
    saveState.set(ok ? "saved" : "failed");
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

export async function loadPersisted() {
  // Never clobber decisions that haven't been persisted yet (remount inside
  // the debounce window).
  if (ledgerDirty) return;
  try {
    const s = await fetchLedger();
    decisions.set(new Map(Object.entries(s.dec ?? {})));
    edited.set(new Map(Object.entries(s.edited ?? {})));
  } catch { /* fresh start */ }
}

/** Forget every decision and edit whose claim the last refresh no longer
 *  produced. The queue's owner calls this instead of writing these stores. */
export function pruneLedger(liveKeys: Set<string>) {
  let pruned = false;
  const dec = new Map(decisions.get());
  for (const k of [...dec.keys()]) if (!liveKeys.has(k)) { dec.delete(k); pruned = true; }
  const ed = new Map(edited.get());
  for (const k of [...ed.keys()]) if (!liveKeys.has(k)) { ed.delete(k); pruned = true; }
  if (pruned) { decisions.set(dec); edited.set(ed); persist(); }
}

// ── decisions ───────────────────────────────────────────────────────

function snapshot(label: string, keys: string[]) {
  undoStack.push({ label, entries: keys.map((k) => [k, decisions.get().get(k) ?? null]) });
  if (undoStack.length > 50) undoStack.shift();
}

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
