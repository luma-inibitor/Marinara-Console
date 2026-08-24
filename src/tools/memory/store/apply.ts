// Owns the apply pass: the in-flight flag, its per-draft progress, the
// failure summary the dock shows afterwards, and the classifier that turns an
// upstream message into a named fix. Nothing else writes those four.
//
// Drops first (skip removes exactly those), then accept the keeps. Undecided
// claims are never sent. Failures classify with the fix named.
//
// The import edge is one-way on purpose: this module reads `../store`, and
// `../store` must never read this one. `../store` computes four `derived()`
// stores and installs two subscriptions at module scope, and `derived()`
// computes eagerly at construction — a cycle would evaluate one of those
// `const`s before its initializer ran and throw at import time. That is also
// why the entity state this pass touches is reached through `../store`'s named
// actions rather than by writing its stores from here.

import { createStore } from "../../../lib/store";
import { type Mutation } from "../api/types";
import { acceptDraft, skipMutations } from "../api/drafts";
import { type Row } from "../model/review";
import {
  clearPreflight,
  clearUndo,
  commitLedger,
  decisions,
  edited,
  keepsByDraft,
  markApplied,
  persist,
  preflight,
  preflightNow,
  refresh,
  rows,
} from "../store";
import { t, tAny } from "../../../copy";
import { toast } from "../../../shell/toast";

export const applying = createStore(false);
export const applyProgress = createStore<{ done: number; total: number } | null>(null);
export const lastFailures = createStore<Array<{ title: string; fix: string; msg: string; n: number }>>([]);

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
  // Cancel the debounce and run a preflight right now — Apply must never use a
  // stale snapshot: a keep→drop flip inside the debounce would send a
  // just-skipped id to accept.
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
          markApplied(key, "skipped");
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
        markApplied(key, "applied");
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

  commitLedger(dec, ed);
  applying.set(false);
  applyProgress.set(null);
  clearPreflight();
  clearUndo();
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
