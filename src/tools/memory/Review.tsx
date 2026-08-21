// Review Queue — the curation loop's triage surface (ltm-review J3).
//
// Console header (tally meter, quick chips, facet sheet) · audit rows grouped
// by target memory · tri-state decision rail · master-detail on desktop,
// stacked detail on mobile · apply dock. Keyboard: j/k move, a/d keep/drop,
// x undecide, space cycle, Enter opens, u undo (DESIGN.md §3, §6 triage).

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { toast } from "../../shell/toast";
import { type Row, backupExportUrl, extractNote, SECTION_CAP } from "./data";
import { t, OURS } from "./strings";
import {
  rows, blocked, rejections, loading, loadError, review,
  decisions, edited, cursor, detailKey, facetSheetOpen, saveState,
  activeFacets, groupBy, sortBy, tally, preflight, applying, lastFailures,
  droppedDependencyWarnings, canUndo, notesById, rowOverflows,
  refresh, setDecision, cycleDecision, bulkDecide, undo, applyDecided,
} from "./store";
import { FACETS, GROUPERS, SORTERS, applyFilters, facetCounts, buildGroups, type Group } from "./facets";
import { ClaimDetail } from "./ClaimDetail";
import { NoteRef } from "./NotePeek";

const RESTORE_POINT_THRESHOLD = 20;

function useIsDesktop(): boolean {
  const [is, setIs] = useState(() => window.matchMedia("(min-width: 900px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const fn = () => setIs(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return is;
}

export function Review() {
  const desktop = useIsDesktop();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void refresh(true); }, []);

  const shown = useMemo(
    () => applyFilters(rows.value, activeFacets.value),
    [rows.value, activeFacets.value, decisions.value, edited.value],
  );
  const groups = useMemo(
    () => buildGroups(shown, groupBy.value, sortBy.value),
    [shown, groupBy.value, sortBy.value],
  );
  const visibleKeys = useMemo(() => groups.flatMap((g) => g.rows.map((r) => r.key)), [groups]);

  const focusRow = (key: string) => {
    cursor.value = key;
    if (desktop) detailKey.value = key;
    requestAnimationFrame(() => {
      (listRef.current?.querySelector(`[data-row="${CSS.escape(key)}"]`) as HTMLElement | null)
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  const move = (delta: number) => {
    if (!visibleKeys.length) return;
    const i = cursor.value ? visibleKeys.indexOf(cursor.value) : -1;
    const next = i === -1 ? (delta > 0 ? 0 : visibleKeys.length - 1) : Math.max(0, Math.min(visibleKeys.length - 1, i + delta));
    focusRow(visibleKeys[next]);
  };

  const cursorRow = () => rows.value.find((r) => r.key === cursor.value) ?? null;

  const decideAndAdvance = (value: "keep" | "drop") => {
    const row = cursorRow();
    if (!row) return;
    setDecision(row, value);
    move(1);
  };

  const onListKey = (ev: KeyboardEvent) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const el = ev.target as HTMLElement;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
    switch (ev.key) {
      case "j": case "ArrowDown": ev.preventDefault(); move(1); break;
      case "k": case "ArrowUp": ev.preventDefault(); move(-1); break;
      case "a": ev.preventDefault(); decideAndAdvance("keep"); break;
      case "d": ev.preventDefault(); decideAndAdvance("drop"); break;
      case "x": { ev.preventDefault(); const r = cursorRow(); if (r) setDecision(r, null); break; }
      case " ": { ev.preventDefault(); const r = cursorRow(); if (r) cycleDecision(r); break; }
      case "Enter": case "o": case "e": {
        ev.preventDefault();
        if (cursor.value) detailKey.value = cursor.value;
        break;
      }
      case "u": ev.preventDefault(); undo(); break;
      case "Escape":
        if (facetSheetOpen.value) { ev.preventDefault(); facetSheetOpen.value = false; }
        else if (detailKey.value && !desktop) { ev.preventDefault(); detailKey.value = null; }
        break;
    }
  };

  if (loadError.value) {
    return <div class="screen"><div class="empty"><p class="t-label">Could not load</p><p class="t-data">{loadError.value}</p></div></div>;
  }
  if (loading.value) {
    return <div class="screen"><div class="empty">{t("reviewqueue.loadingPendingReviewDrafts")}</div></div>;
  }

  const c = tally.value;
  const total = review.value?.counts.mutations ?? 0;
  const detailRow = detailKey.value ? rows.value.find((r) => r.key === detailKey.value) ?? null : null;
  const showDetailPane = desktop;
  const showDetailStack = !desktop && detailRow;

  return (
    <div class={`audit ${desktop ? "is-desktop" : ""}`}>
      <div class="audit-list" ref={listRef} tabIndex={0} onKeyDown={onListKey}>
        <header class="console">
          <div class="hrow">
            <h1 class="console-title">{t("reviewqueue.reviewQueue")}</h1>
            <span class="t-data mem-save" data-contrast-exempt>
              {saveState.value === "saving" ? "Autosaving…" : saveState.value === "failed" ? "Save FAILED" : ""}
            </span>
            <a class="icon-btn t-data" href={backupExportUrl()} download title={OURS.restorePoint} aria-label="Export backup">⭳</a>
          </div>

          {/* decision meter: tally as data, one line */}
          <div class="meter">
            <span class="t-label t-label-s">Decided</span>
            <span class="mbar">
              <span class="m-keep" style={`width:${total ? (c.keep / total) * 100 : 0}%`} />
              <span class="m-drop" style={`width:${total ? (c.drop / total) * 100 : 0}%`} />
            </span>
            <span class="t-data mval">
              <b class="is-keep">{c.keep}</b> · <b class="is-drop">{c.drop}</b>
              <span class="of"> / {total}</span>
            </span>
          </div>

          <div class="chiprail">
            <button class="chip" aria-pressed={facetSheetOpen.value} onClick={() => { facetSheetOpen.value = !facetSheetOpen.value; }}>
              Facets{activeFacetCount() > 0 && <b class="ar">{activeFacetCount()}</b>}
            </button>
            <QuickChip facet="status" value={OURS.undecided} label="Undecided" />
            <QuickChip facet="flags" value="restates vault" label="Restates" flag />
            <QuickChip facet="flags" value="duplicate incoming" label="Dupes" flag />
            <QuickChip facet="conflicts" value="has conflicts" label="Conflicts" flag />
            <span class="rail-gap" />
            {Object.entries(GROUPERS).map(([id, g]) => (
              <button key={id} class="chip" aria-pressed={groupBy.value === id}
                onClick={() => { groupBy.value = id as typeof groupBy.value; }}>
                {g.label}
              </button>
            ))}
            <span class="rail-gap" />
            {Object.entries(SORTERS).map(([id, s]) => (
              <button key={id} class="chip" aria-pressed={sortBy.value === id}
                onClick={() => { sortBy.value = id as typeof sortBy.value; }}>
                ↓ {s.label}
              </button>
            ))}
          </div>

          {activeFacetCount() > 0 && (
            <div class="chiprail">
              <span class="t-data selcount">{shown.length} of {rows.value.length}</span>
              <button class="chip" onClick={() => bulkDecide(shown, "keep", "keep shown")}>Keep shown</button>
              <button class="chip" onClick={() => bulkDecide(shown, "drop", "drop shown")}>Drop shown</button>
              <button class="chip" onClick={() => bulkDecide(shown, null, "reset shown")}>Reset</button>
              <button class="chip" onClick={() => { activeFacets.value = new Map(); }}>Clear filters</button>
            </div>
          )}
        </header>

        <main class="rows mem-rows">
          <Obligations />
          <Failures />
          {shown.length === 0 && rows.value.length === 0 && !blocked.value.length && (
            <p class="empty">{t("sourcesworkspace.noNewOrRetryableSourcesAreReadyToImport")}</p>
          )}
          {shown.length === 0 && rows.value.length > 0 && (
            <p class="empty">No proposals match the active facets.</p>
          )}
          {groups.map((g) => <GroupBlock key={g.id} group={g} showTarget={groupBy.value !== "target"} onActivate={focusRow} />)}
          <Rejections />
        </main>
      </div>

      {showDetailPane && (
        <aside class="audit-detail">
          {detailRow
            ? <ClaimDetail row={detailRow} />
            : <div class="empty"><p class="t-label t-label-s">No claim open</p><p class="t-prose">j/k to move · a keep · d drop · Enter opens</p></div>}
        </aside>
      )}
      {showDetailStack && (
        <div class="stack-screen">
          <header class="console"><div class="hrow">
            <button class="icon-btn" aria-label="Back to queue" onClick={() => { detailKey.value = null; }}>‹</button>
            <h1 class="console-title">{detailRow!.targetTitle}</h1>
          </div></header>
          <ClaimDetail row={detailRow!} />
        </div>
      )}

      <FacetSheet shown={shown} />
      <ApplyDock />
    </div>
  );
}

function activeFacetCount(): number {
  let n = 0;
  for (const set of activeFacets.value.values()) n += set.size;
  return n;
}

function toggleFacet(facetId: string, value: string) {
  const next = new Map(activeFacets.value);
  const set = new Set(next.get(facetId) ?? []);
  set.has(value) ? set.delete(value) : set.add(value);
  next.set(facetId, set);
  activeFacets.value = next;
}

function QuickChip(props: { facet: string; value: string; label: string; flag?: boolean }) {
  const on = activeFacets.value.get(props.facet)?.has(props.value) ?? false;
  return (
    <button class={`chip ${props.flag ? "is-flag" : ""}`} aria-pressed={on}
      onClick={() => toggleFacet(props.facet, props.value)}>
      {props.label}
    </button>
  );
}

function FacetSheet(props: { shown: Row[] }) {
  if (!facetSheetOpen.value) return null;
  const counts = facetCounts(rows.value, activeFacets.value);
  const bySource: Record<string, typeof FACETS> = { computed: [], model: [], yours: [] };
  for (const f of FACETS) bySource[f.source].push(f);
  return (
    <div class="peek-scrim" onClick={() => { facetSheetOpen.value = false; }}>
      <aside class="facet-sheet" role="dialog" aria-label="Facets" onClick={(e) => e.stopPropagation()}>
        <header class="peek-head">
          <span class="t-label t-label-s">Facets</span>
          <button class="chip" onClick={() => { activeFacets.value = new Map(); }}>Clear</button>
          <button class="hit peek-x" aria-label="Close" onClick={() => { facetSheetOpen.value = false; }}>×</button>
        </header>
        <div class="facet-cols">
          {(["computed", "model", "yours"] as const).map((src) => {
            const defs = bySource[src].filter((f) => (counts.get(f.id)?.size ?? 0) > 0);
            if (!defs.length) return null;
            return (
              <div key={src}>
                <h3 class="t-label t-label-s facet-src">{OURS[src === "computed" ? "facetsComputed" : src === "model" ? "facetsFromModel" : "facetsYours"]}</h3>
                {defs.map((f) => (
                  <div key={f.id} class="facet-group">
                    <h4 class="t-label t-label-s">{f.label}</h4>
                    {[...counts.get(f.id)!.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => {
                      const on = activeFacets.value.get(f.id)?.has(value) ?? false;
                      return (
                        <button key={value} class={`facet-row ${on ? "is-on" : ""}`} aria-pressed={on}
                          onClick={() => toggleFacet(f.id, value)}>
                          <span class="fv t-prose">{value}</span>
                          <span class="fc t-data">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function GroupBlock(props: { group: Group; showTarget: boolean; onActivate: (key: string) => void }) {
  const g = props.group;
  const kept = g.rows.filter((r) => decisions.value.get(r.key) === "keep").length;
  const dropped = g.rows.filter((r) => decisions.value.get(r.key) === "drop").length;
  const stored = groupBy.value === "target" ? notesById.value.get(g.id) : undefined;
  const storedSections = stored && stored.type !== "source" ? Object.entries(stored.sections ?? {}) : [];
  const [showStored, setShowStored] = useState(false);
  return (
    <div>
      <div class="grouphead">
        <span class="gn t-prose">{g.label}</span>
        {g.meta && <span class={`chip t-data type-${g.meta}`}>{g.meta.replaceAll("_", " ")}</span>}
        <span class="t-data dim">{g.rows.length}</span>
        {(kept > 0 || dropped > 0) && (
          <span class="t-data">
            {kept > 0 && <b class="is-keep">{kept}✓</b>}{kept > 0 && dropped > 0 && " "}
            {dropped > 0 && <b class="is-drop">{dropped}✗</b>}
          </span>
        )}
        {storedSections.length > 0 && (
          <button class="chip" aria-pressed={showStored} onClick={() => setShowStored(!showStored)}>
            stored · {storedSections.length}
          </button>
        )}
      </div>
      {showStored && (
        <div class="stored-block">
          {storedSections.map(([key, s]) => (
            <div key={key} class="stored-section">
              <span class="t-label t-label-s">{key}</span>
              <div class="t-prose dim">{s.text}</div>
            </div>
          ))}
          <NoteRef id={g.id} label="open note" />
        </div>
      )}
      {g.rows.map((r) => <ClaimRow key={r.key} row={r} showTarget={props.showTarget} onActivate={props.onActivate} />)}
      <div class="group-actions">
        <button class="chip" onClick={() => bulkDecide(g.rows, "keep", `keep ${g.label}`)}>Keep group</button>
        <button class="chip" onClick={() => bulkDecide(g.rows, "drop", `drop ${g.label}`)}>Drop group</button>
      </div>
    </div>
  );
}

function ClaimRow(props: { row: Row; showTarget: boolean; onActivate: (key: string) => void }) {
  const r = props.row;
  const d = decisions.value.get(r.key);
  const isFocused = cursor.value === r.key;
  const isOpen = detailKey.value === r.key;
  const overwrites = r.changes.some((c) => c.before !== undefined && c.before !== "");
  return (
    <div class={`row mem-row ${isOpen ? "is-open" : ""} ${isFocused ? "is-focused" : ""}`} data-row={r.key} data-d={d ?? "undecided"}>
      <div class="row-summary mem-summary">
        <button
          class="rail-cell tri hit"
          aria-label={`Decision: ${d ?? OURS.undecided}. Tap to cycle.`}
          onClick={(e) => { e.stopPropagation(); cycleDecision(r); }}
        >
          <span class="tri-dot" aria-hidden="true">{d === "keep" ? "✓" : d === "drop" ? "✗" : ""}</span>
        </button>
        <button class="mid mem-mid" onClick={() => props.onActivate(r.key)}>
          <span class="claim-text t-prose">{r.text}</span>
          <span class="metaline t-data">
            <span class={`disp disp-${r.disposition}`}>{OURS.disposition[r.disposition]}</span>
            <i class="sep" data-contrast-exempt>·</i>{r.mutation.risk}
            {props.showTarget && <><i class="sep" data-contrast-exempt>·</i><span class="dim">→ {r.targetTitle}</span></>}
            {r.conflicts.length > 0 && <><i class="sep" data-contrast-exempt>·</i><span class="fl">{r.conflicts.length} conflict{r.conflicts.length === 1 ? "" : "s"}</span></>}
            {overwrites && <><i class="sep" data-contrast-exempt>·</i><span class="fl">diff</span></>}
            {r.restates && <><i class="sep" data-contrast-exempt>·</i><span class="fl">restates {r.restates.score.toFixed(2)}</span></>}
            {r.duplicateOf && <><i class="sep" data-contrast-exempt>·</i><span class="fl">dupe</span></>}
            {rowOverflows(r) && <><i class="sep" data-contrast-exempt>·</i><span class="fl">{OURS.overLimit}</span></>}
            {edited.value.has(r.key) && <><i class="sep" data-contrast-exempt>·</i><span class="is-keep">{t("reviewqueue.editedChange")}</span></>}
          </span>
        </button>
        <span class="num">
          <span class={`tok ${r.mutation.risk === "high" ? "is-hot" : ""}`}>{Math.round(r.mutation.confidence * 100)}</span>
          <span class="unit">% conf</span>
        </span>
      </div>
    </div>
  );
}

function Obligations() {
  if (!blocked.value.length) return null;
  const byCode = new Map<string, { message: string; items: typeof blocked.value }>();
  for (const b of blocked.value) {
    for (const reason of b.reasons) {
      let bucket = byCode.get(reason.code);
      if (!bucket) byCode.set(reason.code, (bucket = { message: reason.message, items: [] }));
      bucket.items.push(b);
    }
  }
  const reextract = async (items: typeof blocked.value) => {
    for (const b of items) {
      try { await extractNote(b.sourceNoteId); } catch (error) { toast((error as Error).message, { kind: "error" }); }
    }
    await refresh();
  };
  return (
    <>
      {[...byCode.entries()].map(([code, { message, items }]) => (
        <div key={code} class="mem-card">
          <div class="t-data"><span class="fl">{code.replaceAll("_", " ")}</span> <b>{items.length}</b> draft{items.length === 1 ? "" : "s"} blocked · {items.reduce((n, b) => n + b.mutationCount, 0)} claims held</div>
          <p class="t-prose dim">{message}</p>
          {["source_stale", "source_context_unbound"].includes(code) && (
            <button class="chip" onClick={() => void reextract(items)}>{t("memoryvault.extractToReview")}</button>
          )}
        </div>
      ))}
    </>
  );
}

function Failures() {
  if (!lastFailures.value.length) return null;
  return (
    <>
      {lastFailures.value.map((f) => (
        <div key={f.title} class="mem-card is-danger">
          <div class="t-data"><span class="fl">apply failed</span> <b>{f.n}</b> · {f.title}</div>
          <p class="t-prose dim">{f.fix}</p>
          <details><summary class="t-data dim">raw</summary><p class="t-data dim">{f.msg.slice(0, 400)}</p></details>
        </div>
      ))}
      <div class="group-actions"><button class="chip" onClick={() => { lastFailures.value = []; }}>Dismiss</button></div>
    </>
  );
}

function Rejections() {
  if (!rejections.value.length) return null;
  const byReason = new Map<string, typeof rejections.value>();
  for (const item of rejections.value) {
    byReason.set(item.reason, [...(byReason.get(item.reason) ?? []), item]);
  }
  return (
    <div class="mem-rejections">
      <div class="grouphead"><span class="gn t-prose">{t("reviewqueue.suggestionsThatWerentSaved")}</span>
        <span class="t-data dim">{rejections.value.length}</span></div>
      {[...byReason.entries()].map(([reason, items]) => (
        <details key={reason} class="mem-card">
          <summary class="t-data"><span class="fl">{reason.replaceAll("_", " ")}</span> <b>{items.length}</b> · <span class="dim">{items[0].message ?? ""}</span></summary>
          {items.map((i, idx) => <p key={idx} class="t-prose dim rej-snippet">{i.snippet}</p>)}
        </details>
      ))}
    </div>
  );
}

function ApplyDock() {
  const c = tally.value;
  if (!c.keep && !c.drop) return null;
  const pf = preflight.value;
  const warnings = droppedDependencyWarnings.value;
  const applyCount = (pf?.ready ?? 0) + c.drop;
  const offerRestore = c.keep + c.drop >= RESTORE_POINT_THRESHOLD;
  return (
    <div class="apply-dock">
      <div class="dock-info t-data">
        <b class="is-keep">{c.keep}</b> {OURS.keep} · <b class="is-drop">{c.drop}</b> {OURS.drop}
        {c.undecided > 0 && <span class="dim"> · {c.undecided} {OURS.undecided}</span>}
        {c.edited > 0 && <span> · {c.edited} edited</span>}
        <br />
        <span class="dim">
          {c.willSend} draft{c.willSend === 1 ? "" : "s"} will be sent{c.stayPending ? ` · ${c.stayPending} stay pending` : ""}
          {pf?.error ? <span class="is-drop"> · {pf.error}</span> : pf ? <> · {pf.ready} ready{pf.blockedN ? <span class="is-drop"> · {pf.blockedN} blocked</span> : null}{pf.auto ? ` · ${OURS.autoIncluded(pf.auto)}` : ""}</> : null}
          {warnings.length > 0 && <span class="is-drop"> · {warnings.length} kept claim{warnings.length === 1 ? "" : "s"} depend on a dropped create</span>}
        </span>
        {offerRestore && <><br /><a class="t-data restore-link" href={backupExportUrl()} download>{OURS.restorePoint}</a></>}
      </div>
      <button class="chip" disabled={!canUndo.value} onClick={undo}>Undo</button>
      <button class="dock-primary t-label" disabled={applying.value || (c.keep > 0 && !pf) || Boolean(pf?.error)} onClick={() => void applyDecided()}>
        {applying.value ? t("reviewqueue.accepting") : `Apply decided (${applyCount})`}
      </button>
    </div>
  );
}
