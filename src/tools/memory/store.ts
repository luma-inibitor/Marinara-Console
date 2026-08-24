// Review state: the tri-state decision ledger.
//
// Judgment is separate from transmission. Every claim is undecided / keep /
// drop; decisions persist server-side (/console/state, keyed by engine
// target) so a review can span days and devices; undecided claims are never
// sent; Apply is a batch over everything decided. A draft with no decisions
// is never contacted, so an unfinished review resumes where it stopped.

import { createStore, derived } from "../../lib/store";
import {
  type Row, type Note, type BlockedDraft, type Rejection, type ReviewResponse,
  type Mutation, type PreflightResponse, type SectionPressure,
  fetchReview, fetchNotes, preflightDraft, acceptDraft, skipMutations,
  flattenReview, computePressure, SECTION_CAP,
} from "./data";
import { vaultLines, computeDerived, type VaultLine } from "./derived";
import { currentScope, isScoped, rowInScope, scopeCharacterId, scopeChatId } from "./scope";
import { t, tAny } from "../../copy";
import { toast } from "../../shell/toast";

export type Decision = "keep" | "drop";

// ── core state ──────────────────────────────────────────────────────

export const loading = createStore(true);
export const loadError = createStore<string | null>(null);
export const review = createStore<ReviewResponse | null>(null);
export const rows = createStore<Row[]>([]);
export const blocked = createStore<BlockedDraft[]>([]);
export const rejections = createStore<Rejection[]>([]);
export const notesById = createStore<Map<string, Note>>(new Map());
export const lines = createStore<VaultLine[]>([]);

export const decisions = createStore<Map<string, Decision>>(new Map());
export const edited = createStore<Map<string, Mutation>>(new Map());
export const appliedThisSession = new Map<string, "applied" | "skipped">();

export const groupBy = createStore<"target" | "source" | "disposition" | "kind" | "none">("target");
export const sortBy = createStore<"risk" | "confidence" | "target">("risk");
export const sortDir = createStore<1 | -1>(1);
export const activeFacets = createStore<Map<string, Set<string>>>(new Map());
export const cursor = createStore<string | null>(null);
export const detailKey = createStore<string | null>(null); // open detail panel/screen
export const facetSheetOpen = createStore(false);
export const saveState = createStore<"saved" | "saving" | "failed">("saved");
export const applying = createStore(false);
export const preflight = createStore<{ ready: number; blockedN: number; auto: number; perDraft: Array<{ draftId: string; pf: PreflightResponse }>; error?: string } | null>(null);
export const preflightPending = createStore(false);
export const applyProgress = createStore<{ done: number; total: number } | null>(null);
export const lastFailures = createStore<Array<{ title: string; fix: string; msg: string; n: number }>>([]);
export const pressure = createStore<Map<string, SectionPressure>>(new Map());

const undoStack: Array<{ label: string; entries: Array<[string, Decision | null]> }> = [];

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
 *  quote a figure Apply does not honour. */
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

/** The pressure map is a PARAMETER, not a read: this is called from render, and
 *  a store read there would not subscribe the caller — the badge would freeze
 *  at whatever pressure held when the row first painted. */
export function rowOverflows(row: Row, sectionPressure: Map<string, SectionPressure>): boolean {
  return row.parts.some((p) => (sectionPressure.get(`${row.targetId} ${p.key}`)?.projected ?? 0) > SECTION_CAP);
}

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

/** Sources waiting to be imported, in the current scope. The nav badge reads
 *  this, and every nav badge must mean "waiting" — a badge counting work
 *  already done would give the same channel two opposite meanings. Null until
 *  the Sources screen has computed it once. */
export const pendingSources = createStore<number | null>(null);

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
  recomputePressure();
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
  recomputePressure();
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
  recomputePressure();
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

function recomputePressure() {
  pressure.set(computePressure(rows.get(), (k) => decisions.get().get(k), notesById.get()));
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
  recomputePressure();
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
      fetchNotes({ limit: 500 }).catch(() => [] as Note[]),
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
    recomputePressure();
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

function keepsByDraft() {
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

/** Cancel the debounce and run a preflight right now (Apply must never use a
 *  stale snapshot: a keep→drop flip inside the debounce would send a
 *  just-skipped id to accept). */
async function preflightNow() {
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

// ── apply ───────────────────────────────────────────────────────────
// Drops first (skip removes exactly those), then accept the keeps.
// Undecided claims are never sent. Failures classify with the fix named.

// The table pairs a matcher with a copy KEY pair; the prose lives in
// src/copy/memory.json, so the shape here stays a classifier.
const ERROR_KINDS: Array<{ match: RegExp; key: string }> = [
  { match: /exceeds its storage contract|20,000-character|contribution limit/i, key: "storageCap" },
  { match: /not pending|superseded|already applied/i, key: "draftMoved" },
  { match: /source or extraction context changed/i, key: "sourceChanged" },
  { match: /edited mutation/i, key: "editRejected" },
  { match: /fetch failed|timeout|aborted|network|50\d\b/i, key: "upstream" },
];

function classify(msg: string): { title: string; fix: string } {
  const hit = ERROR_KINDS.find((k) => k.match.test(msg));
  if (!hit) return { title: t("memory.error.applyFailed"), fix: msg.slice(0, 200) };
  return { title: tAny(`memory.error.${hit.key}.title`), fix: tAny(`memory.error.${hit.key}.fix`) };
}

export async function applyDecided() {
  if (applying.get()) return;
  applying.set(true);
  await preflightNow();
  const pf = preflight.get();
  if (pf?.error) { applying.set(false); return; }
  const dropsByDraft = new Map<string, Row[]>();
  for (const row of rows.get()) {
    if (decisions.get().get(row.key) !== "drop") continue;
    let list = dropsByDraft.get(row.draftId);
    if (!list) dropsByDraft.set(row.draftId, (list = []));
    list.push(row);
  }
  const keeps = keepsByDraft();
  if (!dropsByDraft.size && !keeps.size) { applying.set(false); return; }

  let applied = 0, dropped = 0;
  const failures = new Map<string, { title: string; fix: string; msg: string; n: number }>();
  const fail = (msg: string) => {
    const k = classify(msg);
    const cur = failures.get(k.title) ?? { ...k, msg, n: 0 };
    cur.n += 1;
    failures.set(k.title, cur);
  };

  const dec = new Map(decisions.get());
  const ed = new Map(edited.get());
  const draftIds = new Set([...dropsByDraft.keys(), ...keeps.keys()]);
  let draftIndex = 0;
  applyProgress.set({ done: 0, total: draftIds.size });
  for (const draftId of draftIds) {
    draftIndex += 1;
    applyProgress.set({ done: draftIndex, total: draftIds.size });
    const drops = dropsByDraft.get(draftId) ?? [];
    if (drops.length) {
      try {
        const res = await skipMutations(draftId, drops.map((r) => r.mutation.id));
        for (const id of res.mutationIds ?? []) {
          const key = `${draftId}:${id}`;
          appliedThisSession.set(key, "skipped");
          dec.delete(key);
          dropped += 1;
        }
      } catch (error) {
        const msg = String((error as Error).message ?? error);
        if (!/not pending|superseded|not found/i.test(msg)) {
          fail(msg);
          continue; // don't accept into a draft whose drops failed
        }
      }
    }
    const keepRows = keeps.get(draftId) ?? [];
    if (!keepRows.length) continue;
    const draftPf = pf?.perDraft.find((x) => x.draftId === draftId)?.pf;
    // Preflight may auto-include a dependency the user explicitly dropped;
    // those ids were just deleted by the skip above — never send them.
    const dropIds = new Set(drops.map((r) => r.mutation.id));
    const ids = (draftPf?.readyMutationIds ?? keepRows.map((r) => r.mutation.id))
      .filter((id) => !dropIds.has(id));
    if (!ids.length) continue;
    try {
      const body: { mutationIds: string[]; editedMutations?: Mutation[] } = { mutationIds: ids };
      const editedMuts = keepRows.map((r) => edited.get().get(r.key)).filter(Boolean) as Mutation[];
      if (editedMuts.length) body.editedMutations = editedMuts;
      const res = await acceptDraft(draftId, body);
      const serverSkipped = new Set(res.skippedMutationIds ?? []);
      const appliedIds = res.appliedMutationIds ?? ids.filter((id) => !serverSkipped.has(id));
      for (const id of appliedIds) {
        const key = `${draftId}:${id}`;
        appliedThisSession.set(key, "applied");
        dec.delete(key);
        ed.delete(key);
        applied += 1;
      }
      if (res.draft?.indexRebuildStatus === "failed") {
        toast(t("memoryvault.savedButRecallIsStale", { error: res.draft.indexRebuildError ?? "" }), { kind: "error" });
      }
    } catch (error) {
      fail(String((error as Error).message ?? error));
    }
  }

  decisions.set(dec);
  edited.set(ed);
  applying.set(false);
  applyProgress.set(null);
  preflight.set(null);
  undoStack.length = 0; // snapshots reference applied keys; undoing them would lie
  canUndo.set(false);
  lastFailures.set([...failures.values()]);
  persist();
  const failed = lastFailures.get().reduce((n, f) => n + f.n, 0);
  toast(
    `${t("reviewqueue.applied")}: ${applied} · ${t("memory.dropped")}: ${dropped}` +
      (failed ? ` ${t("memory.apply.failedCount", { count: failed })}` : ""),
    failed ? { kind: "error" } : {},
  );
  await refresh();
}
