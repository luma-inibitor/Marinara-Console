// Review state: the tri-state decision ledger.
//
// The model follows the operator's review workbench (ltm-review study):
// judgment is separate from transmission. Every claim is undecided / keep /
// drop; decisions persist server-side (/console/state, keyed by engine
// target) so a review can span days and devices; undecided claims are never
// sent; Apply is a batch over everything decided. A draft with no decisions
// is never contacted, so an unfinished review resumes where it stopped.

import { signal, computed } from "@preact/signals";
import {
  type Row, type Note, type BlockedDraft, type Rejection, type ReviewResponse,
  type Mutation, type PreflightResponse, type SectionPressure,
  fetchReview, fetchNotes, preflightDraft, acceptDraft, skipMutations,
  flattenReview, computePressure, SECTION_CAP,
} from "./data";
import { vaultLines, computeDerived, type VaultLine } from "./derived";
import { t } from "./strings";
import { toast } from "../../shell/toast";

export type Decision = "keep" | "drop";

// ── core state ──────────────────────────────────────────────────────

export const loading = signal(true);
export const loadError = signal<string | null>(null);
export const review = signal<ReviewResponse | null>(null);
export const rows = signal<Row[]>([]);
export const blocked = signal<BlockedDraft[]>([]);
export const rejections = signal<Rejection[]>([]);
export const notesById = signal<Map<string, Note>>(new Map());
export const lines = signal<VaultLine[]>([]);

export const decisions = signal<Map<string, Decision>>(new Map());
export const edited = signal<Map<string, Mutation>>(new Map());
export const appliedThisSession = new Map<string, "applied" | "skipped">();

export const groupBy = signal<"target" | "source" | "disposition" | "kind" | "none">("target");
export const sortBy = signal<"risk" | "confidence" | "target">("risk");
export const sortDir = signal<1 | -1>(1);
export const activeFacets = signal<Map<string, Set<string>>>(new Map());
export const cursor = signal<string | null>(null);
export const detailKey = signal<string | null>(null); // open detail panel/screen
export const facetSheetOpen = signal(false);
export const saveState = signal<"saved" | "saving" | "failed">("saved");
export const applying = signal(false);
export const preflight = signal<{ ready: number; blockedN: number; auto: number; perDraft: Array<{ draftId: string; pf: PreflightResponse }>; error?: string } | null>(null);
export const preflightPending = signal(false);
export const applyProgress = signal<{ done: number; total: number } | null>(null);
export const lastFailures = signal<Array<{ title: string; fix: string; msg: string; n: number }>>([]);
export const pressure = signal<Map<string, SectionPressure>>(new Map());

const undoStack: Array<{ label: string; entries: Array<[string, Decision | null]> }> = [];

// ── derived ─────────────────────────────────────────────────────────

/** row key -> preflight outcome, for row badges and dock enumeration. */
export const preflightRowState = computed(() => {
  const auto = new Map<string, true>();
  const blockedRows = new Map<string, string>(); // key -> first blocker message
  const pf = preflight.value;
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

export const tally = computed(() => {
  let keep = 0, drop = 0;
  const touched = new Set<string>(), undecidedDrafts = new Set<string>();
  for (const row of rows.value) {
    const d = decisions.value.get(row.key);
    if (d === "keep") keep += 1;
    else if (d === "drop") drop += 1;
    if (d) touched.add(row.draftId); else undecidedDrafts.add(row.draftId);
  }
  return {
    keep, drop,
    undecided: rows.value.length - keep - drop,
    edited: edited.value.size,
    willSend: touched.size,
    stayPending: [...undecidedDrafts].filter((id) => touched.has(id)).length,
  };
});

export function rowOverflows(row: Row): boolean {
  return row.parts.some((p) => (pressure.value.get(`${row.targetId} ${p.key}`)?.projected ?? 0) > SECTION_CAP);
}

/** The server auto-includes UNDECIDED dependencies but cannot recover one
 *  explicitly DROPPED — drops are deleted from the draft before the accept.
 *  That asymmetry is the one structural failure preflight cannot see. */
export const droppedDependencyWarnings = computed(() => {
  const out: Array<{ kept: Row; dropped: Row }> = [];
  const byDraft = new Map<string, Row[]>();
  for (const row of rows.value) {
    let list = byDraft.get(row.draftId);
    if (!list) byDraft.set(row.draftId, (list = []));
    list.push(row);
  }
  for (const draftRows of byDraft.values()) {
    const droppedCreates = new Map<string, Row>();
    for (const r of draftRows) {
      if (decisions.value.get(r.key) === "drop" && r.mutation.kind === "create_note") {
        droppedCreates.set(r.targetId, r);
      }
    }
    if (!droppedCreates.size) continue;
    for (const r of draftRows) {
      if (decisions.value.get(r.key) !== "keep" || r.mutation.kind === "create_note") continue;
      // A kept claim depends on its target note AND on any note it links to.
      const needs = new Set<string>([r.targetId]);
      if (r.mutation.kind === "add_link" && r.mutation.link) needs.add(r.mutation.link.target);
      for (const id of needs) {
        if (droppedCreates.has(id) && !notesById.value.has(id)) {
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
        dec: Object.fromEntries(decisions.value),
        edited: Object.fromEntries(edited.value),
        savedAt: new Date().toISOString(),
      }),
    });
    if (res.ok) ledgerDirty = false;
    saveState.value = res.ok ? "saved" : "failed";
  } catch {
    saveState.value = "failed";
  }
}

export function persist() {
  ledgerDirty = true;
  saveState.value = "saving";
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
    decisions.value = new Map(Object.entries(s.dec ?? {}));
    edited.value = new Map(Object.entries(s.edited ?? {}));
  } catch { /* fresh start */ }
}

// ── decisions ───────────────────────────────────────────────────────

function snapshot(label: string, keys: string[]) {
  undoStack.push({ label, entries: keys.map((k) => [k, decisions.value.get(k) ?? null]) });
  if (undoStack.length > 50) undoStack.shift();
}

export const canUndo = signal(false);

export function undo() {
  const snap = undoStack.pop();
  canUndo.value = undoStack.length > 0;
  if (!snap) return;
  const next = new Map(decisions.value);
  for (const [k, v] of snap.entries) {
    if (v == null) next.delete(k); else next.set(k, v);
  }
  decisions.value = next;
  persist();
  recomputePressure();
  schedulePreflight();
  toast(`Undid ${snap.label}`);
}

export function setDecision(row: Row, value: Decision | null) {
  if ((decisions.value.get(row.key) ?? null) === value) return; // no-op
  snapshot(value ?? "undecide", [row.key]);
  canUndo.value = true;
  const next = new Map(decisions.value);
  if (value == null) next.delete(row.key); else next.set(row.key, value);
  decisions.value = next;
  persist();
  recomputePressure();
  schedulePreflight();
}

/** undecided → keep → drop → undecided */
export function cycleDecision(row: Row) {
  const cur = decisions.value.get(row.key);
  setDecision(row, cur === "keep" ? "drop" : cur === "drop" ? null : "keep");
}

export function bulkDecide(list: Row[], value: Decision | null, label: string) {
  list = list.filter((r) => (decisions.value.get(r.key) ?? null) !== value);
  if (!list.length) return;
  snapshot(label, list.map((r) => r.key));
  canUndo.value = true;
  const next = new Map(decisions.value);
  for (const r of list) {
    if (value == null) next.delete(r.key); else next.set(r.key, value);
  }
  decisions.value = next;
  persist();
  recomputePressure();
  schedulePreflight();
  toast(`${list.length} → ${value ?? "undecided"}`, { actionLabel: "Undo", onAction: undo });
}

export function setEdited(key: string, mutation: Mutation | null) {
  const next = new Map(edited.value);
  if (mutation == null) next.delete(key); else next.set(key, mutation);
  edited.value = next;
  persist();
  schedulePreflight();
}

// ── loading ─────────────────────────────────────────────────────────

function recomputePressure() {
  pressure.value = computePressure(rows.value, (k) => decisions.value.get(k), notesById.value);
}

export async function refresh(first = false) {
  const focus = sessionStorage.getItem("mc-ltm-focus-source");
  if (focus) sessionStorage.removeItem("mc-ltm-focus-source");
  if (first) {
    loading.value = true;
    await loadPersisted();
  }
  try {
    const [data, allNotes] = await Promise.all([
      fetchReview(),
      fetchNotes({ limit: 500 }).catch(() => [] as Note[]),
    ]);
    review.value = data;
    notesById.value = new Map(allNotes.map((n) => [n.id, n]));
    const sourceTitles = new Map(allNotes.filter((n) => n.type === "source").map((n) => [n.id, n.title ?? n.id]));
    lines.value = vaultLines(allNotes);
    const flat = flattenReview(data, sourceTitles);
    const live = flat.rows.filter((r) => !appliedThisSession.has(r.key));
    computeDerived(live, lines.value);
    rows.value = live;
    blocked.value = flat.blocked;
    rejections.value = flat.rejections;
    // prune decisions for claims that no longer exist
    const liveKeys = new Set(live.map((r) => r.key));
    let pruned = false;
    const dec = new Map(decisions.value);
    for (const k of [...dec.keys()]) if (!liveKeys.has(k)) { dec.delete(k); pruned = true; }
    const ed = new Map(edited.value);
    for (const k of [...ed.keys()]) if (!liveKeys.has(k)) { ed.delete(k); pruned = true; }
    if (pruned) { decisions.value = dec; edited.value = ed; persist(); }
    recomputePressure();
    // Sources → Review handoff: pre-filter to the just-imported source.
    if (focus) {
      const title = sourceTitles.get(focus) ?? focus;
      const next = new Map(activeFacets.value);
      next.set("source", new Set([title]));
      activeFacets.value = next;
    }
    loadError.value = null;
  } catch (error) {
    loadError.value = (error as Error).message;
  }
  loading.value = false;
  schedulePreflight();
}

// ── preflight ───────────────────────────────────────────────────────

let preflightTimer: ReturnType<typeof setTimeout> | undefined;
let preflightSeq = 0;

function keepsByDraft() {
  const byDraft = new Map<string, Row[]>();
  for (const row of rows.value) {
    if (decisions.value.get(row.key) !== "keep") continue;
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
  const ed = list.map((r) => edited.value.get(r.key)).filter(Boolean) as Mutation[];
  if (ed.length) body.editedMutations = ed;
  return body;
}

export function schedulePreflight() {
  clearTimeout(preflightTimer);
  preflightPending.value = true;
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
    preflight.value = null;
    preflightPending.value = false;
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
    preflight.value = { ready, blockedN, auto, perDraft: results };
  } catch (error) {
    if (seq !== preflightSeq) return;
    preflight.value = { ready: 0, blockedN: 0, auto: 0, perDraft: [], error: (error as Error).message };
  }
  if (seq === preflightSeq) preflightPending.value = false;
}

// ── apply ───────────────────────────────────────────────────────────
// Drops first (skip removes exactly those), then accept the keeps.
// Undecided claims are never sent. Failures classify with the fix named.

const ERROR_KINDS: Array<{ match: RegExp; title: string; fix: string }> = [
  { match: /exceeds its storage contract|20,000-character|contribution limit/i,
    title: "A note hit a storage cap",
    fix: "Open the target note in the Memory Vault and prune the named field (Dedupe lines helps), then retry. Failed drafts stay pending — nothing was lost." },
  { match: /not pending|superseded|already applied/i,
    title: "Draft moved on",
    fix: "Reload — it is probably already resolved." },
  { match: /source or extraction context changed/i,
    title: "The source changed since extraction",
    fix: "Re-extract the source, then review the new draft." },
  { match: /edited mutation/i,
    title: "An edit was rejected",
    fix: "Open the claim, revert or fix the edit, then retry." },
  { match: /fetch failed|timeout|aborted|network|50\d\b/i,
    title: "Upstream hiccup",
    fix: "Safe to retry — each mutation applies at most once." },
];

function classify(msg: string) {
  return ERROR_KINDS.find((k) => k.match.test(msg)) ?? { title: "Apply failed", fix: msg.slice(0, 200) };
}

export async function applyDecided() {
  if (applying.value) return;
  applying.value = true;
  await preflightNow();
  const pf = preflight.value;
  if (pf?.error) { applying.value = false; return; }
  const dropsByDraft = new Map<string, Row[]>();
  for (const row of rows.value) {
    if (decisions.value.get(row.key) !== "drop") continue;
    let list = dropsByDraft.get(row.draftId);
    if (!list) dropsByDraft.set(row.draftId, (list = []));
    list.push(row);
  }
  const keeps = keepsByDraft();
  if (!dropsByDraft.size && !keeps.size) { applying.value = false; return; }

  let applied = 0, dropped = 0;
  const failures = new Map<string, { title: string; fix: string; msg: string; n: number }>();
  const fail = (msg: string) => {
    const k = classify(msg);
    const cur = failures.get(k.title) ?? { ...k, msg, n: 0 };
    cur.n += 1;
    failures.set(k.title, cur);
  };

  const dec = new Map(decisions.value);
  const ed = new Map(edited.value);
  const draftIds = new Set([...dropsByDraft.keys(), ...keeps.keys()]);
  let draftIndex = 0;
  applyProgress.value = { done: 0, total: draftIds.size };
  for (const draftId of draftIds) {
    draftIndex += 1;
    applyProgress.value = { done: draftIndex, total: draftIds.size };
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
      const editedMuts = keepRows.map((r) => edited.value.get(r.key)).filter(Boolean) as Mutation[];
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

  decisions.value = dec;
  edited.value = ed;
  applying.value = false;
  applyProgress.value = null;
  preflight.value = null;
  undoStack.length = 0; // snapshots reference applied keys; undoing them would lie
  canUndo.value = false;
  lastFailures.value = [...failures.values()];
  persist();
  const failed = lastFailures.value.reduce((n, f) => n + f.n, 0);
  toast(
    `${t("reviewqueue.applied")}: ${applied} · ${t("reviewqueue.skipped")}: ${dropped}${failed ? ` · ${failed} failed` : ""}`,
    failed ? { kind: "error" } : {},
  );
  await refresh();
}
