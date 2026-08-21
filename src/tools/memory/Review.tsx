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
  activeFacets, groupBy, sortBy, sortDir, tally, preflight, applying, lastFailures,
  droppedDependencyWarnings, canUndo, notesById, rowOverflows,
  refresh, setDecision, cycleDecision, bulkDecide, undo, applyDecided,
} from "./store";
import { openOverlay, closeTopOverlay } from "./overlays";
import { signal } from "@preact/signals";
import { FACETS, GROUPERS, SORTERS, applyFilters, facetCounts, buildGroups, type Group } from "./facets";
import { ClaimDetail } from "./ClaimDetail";
import { NoteRef } from "./NotePeek";

const RESTORE_POINT_THRESHOLD = 20;

// Mobile choosers for group/sort (three-button rail).
const groupSheetOpen = signal(false);
const sortSheetOpen = signal(false);

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

  // Sticky group heads pin below the sticky console, not under it.
  useEffect(() => {
    const el = listRef.current?.querySelector(".console") as HTMLElement | null;
    if (!el) return;
    const set = () => listRef.current?.style.setProperty("--console-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  });

  const shown = useMemo(
    () => applyFilters(rows.value, activeFacets.value),
    [rows.value, activeFacets.value, decisions.value, edited.value],
  );
  const groups = useMemo(
    () => buildGroups(shown, groupBy.value, sortBy.value, sortDir.value),
    [shown, groupBy.value, sortBy.value, sortDir.value],
  );
  const visibleKeys = useMemo(() => groups.flatMap((g) => g.rows.map((r) => r.key)), [groups]);

  const focusRow = (key: string) => {
    cursor.value = key;
    detailKey.value = key; // mobile: opens the stacked detail; desktop: the pane
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

  // Only rows in the current filtered view are actionable from the keyboard —
  // otherwise a/d silently mutate rows the filter has hidden.
  const cursorRow = () => {
    const key = cursor.value;
    if (!key || !visibleKeys.includes(key)) return null;
    return rows.value.find((r) => r.key === key) ?? null;
  };

  const decideAndAdvance = (value: "keep" | "drop") => {
    const row = cursorRow();
    if (!row) return;
    // Pick the neighbor before deciding: the decision may filter this row out.
    const i = visibleKeys.indexOf(row.key);
    const nextKey = visibleKeys[i + 1] ?? visibleKeys[i - 1] ?? null;
    setDecision(row, value);
    if (nextKey) focusRow(nextKey);
    else cursor.value = null;
  };

  const onListKey = (ev: KeyboardEvent) => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const el = ev.target as HTMLElement;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
    // A focused button owns Space/Enter (and the letter keys would surprise);
    // only navigation keys pass through.
    const onButton = el.tagName === "BUTTON" || Boolean(el.closest("button"));
    if (onButton && !["j", "k", "ArrowDown", "ArrowUp", "Escape", "u", "?"].includes(ev.key)) return;
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
        // Overlays (sheet, peek, stacked detail) are closed by the document-
        // level overlay stack; here Escape only clears the pane/cursor.
        if (detailKey.value && desktop) { ev.preventDefault(); detailKey.value = null; }
        else if (cursor.value) { ev.preventDefault(); cursor.value = null; }
        break;
    }
  };

  if (loadError.value) {
    return <div class="screen"><div class="empty"><p class="t-label">Could not load</p><p class="t-data">{loadError.value}</p></div></div>;
  }
  if (loading.value) {
    return <div class="screen"><div class="empty">{t("reviewqueue.loadingPendingReviewDrafts")}</div></div>;
  }

  // The stacked detail participates in the overlay stack (back/Escape close it).
  const stackOpen = !desktop && Boolean(detailKey.value);
  useEffect(() => {
    if (stackOpen) openOverlay(() => { detailKey.value = null; });
  }, [stackOpen]);

  const c = tally.value;
  const total = rows.value.length;
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
            <a class="icon-btn" href={backupExportUrl()} download title={OURS.restorePoint} aria-label="Export backup">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1v9m0 0L4.5 6.5M8 10l3.5-3.5M2 12.5V14h12v-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>

          {/* decision meter: tally as data, one line */}
          <div class="meter">
            <span class="t-label t-label-s">Decided</span>
            <span class="mbar">
              <span class="m-keep" style={`width:${total ? (c.keep / total) * 100 : 0}%`} />
              <span class="m-drop" style={`width:${total ? (c.drop / total) * 100 : 0}%`} />
            </span>
            <span class="t-data mval">
              <b class="is-keep">✓{c.keep}</b> · <b class="is-drop">✗{c.drop}</b>
              <span class="of"> / {total}</span>
            </span>
          </div>

          <div class="chiprail">
            {desktop ? (
              <>
                <button class="chip" aria-pressed={facetSheetOpen.value} onClick={openFacetSheet}>
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
                    onClick={() => {
                      if (sortBy.value === id) sortDir.value = (sortDir.value === 1 ? -1 : 1);
                      else { sortBy.value = id as typeof sortBy.value; sortDir.value = 1; }
                    }}>
                    {sortDir.value === 1 || sortBy.value !== id ? "↓" : "↑"} {s.label}
                  </button>
                ))}
              </>
            ) : (
              <>
                <button class="chip ctl" aria-pressed={activeFacetCount() > 0} onClick={openFacetSheet}>
                  <span class="ctl-k">Filter</span><span class="ctl-v">{activeFacetCount() || "all"}</span>
                </button>
                <button class="chip ctl" onClick={() => { groupSheetOpen.value = true; openOverlay(() => { groupSheetOpen.value = false; }); }}>
                  <span class="ctl-k">Group</span><span class="ctl-v">{GROUPERS[groupBy.value].label}</span>
                </button>
                <button class="chip ctl" onClick={() => { sortSheetOpen.value = true; openOverlay(() => { sortSheetOpen.value = false; }); }}>
                  <span class="ctl-k">Sort</span><span class="ctl-v">{sortDir.value === 1 ? "↓" : "↑"} {SORTERS[sortBy.value].label}</span>
                </button>
                <QuickChip facet="status" value={OURS.undecided} label="Undecided" />
                <QuickChip facet="flags" value="restates vault" label="Restates" flag />
                <QuickChip facet="flags" value="duplicate incoming" label="Dupes" flag />
                <QuickChip facet="conflicts" value="has conflicts" label="Conflicts" flag />
              </>
            )}
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
            ? <ClaimDetail key={detailRow.key} row={detailRow} />
            : <div class="empty"><p class="t-label t-label-s">No claim open</p><p class="t-prose">j/k to move · a keep · d drop · Enter opens</p></div>}
        </aside>
      )}
      {showDetailStack && (
        <div class="stack-screen">
          <header class="console"><div class="hrow">
            <button class="icon-btn hit" aria-label="Back to queue" onClick={closeTopOverlay}>‹</button>
            <h1 class="console-title">{detailRow!.targetTitle}</h1>
          </div></header>
          <ClaimDetail key={detailRow!.key} row={detailRow!} />
        </div>
      )}

      <FacetSheet shown={shown} />
      <OptionSheet open={groupSheetOpen.value} label="Group by" current={groupBy.value}
        options={Object.entries(GROUPERS).map(([id, g]) => ({ id, label: g.label }))}
        onPick={(id) => { groupBy.value = id as typeof groupBy.value; }} />
      <OptionSheet open={sortSheetOpen.value} label="Sort by" current={sortBy.value}
        options={Object.entries(SORTERS).map(([id, sr]) => ({
          id, label: sr.label,
          hint: sortBy.value === id ? (sortDir.value === 1 ? "↓ tap to flip" : "↑ tap to flip") : undefined,
        }))}
        onPick={(id) => {
          if (sortBy.value === id) sortDir.value = (sortDir.value === 1 ? -1 : 1);
          else { sortBy.value = id as typeof sortBy.value; sortDir.value = 1; }
        }} />
      <ApplyDock />
    </div>
  );
}

function openFacetSheet() {
  if (facetSheetOpen.value) { closeTopOverlay(); return; }
  facetSheetOpen.value = true;
  openOverlay(() => { facetSheetOpen.value = false; });
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
  // Actively-selected values must stay listed even at count 0, or they become
  // un-clearable and the sheet can render blank.
  for (const [facetId, set] of activeFacets.value) {
    const m = counts.get(facetId);
    if (!m) continue;
    for (const v of set) if (!m.has(v)) m.set(v, 0);
  }
  const bySource: Record<string, typeof FACETS> = { computed: [], model: [], yours: [] };
  for (const f of FACETS) bySource[f.source].push(f);
  const anyValues = [...counts.values()].some((m) => m.size > 0);
  return (
    <div class="peek-scrim" onClick={closeTopOverlay}>
      <aside class="facet-sheet" role="dialog" aria-modal="true" aria-label="Facets" onClick={(e) => e.stopPropagation()}>
        <header class="peek-head sheet-head">
          <span class="t-label t-label-s">Facets</span>
          <button class="chip" onClick={() => { activeFacets.value = new Map(); }}>Clear</button>
          <button class="hit peek-x" aria-label="Close" onClick={closeTopOverlay}>×</button>
        </header>
        {!anyValues && <p class="t-prose dim">No facet values in this slice.</p>}
        {(["computed", "model", "yours"] as const).map((src) => {
          const defs = bySource[src].filter((f) => (counts.get(f.id)?.size ?? 0) > 0);
          if (!defs.length) return null;
          return (
            <div key={src} class="facet-block">
              <h3 class="t-label t-label-s facet-src">{OURS[src === "computed" ? "facetsComputed" : src === "model" ? "facetsFromModel" : "facetsYours"]}</h3>
              {defs.map((f) => (
                <div key={f.id} class="facet-line">
                  <span class="flabel t-label t-label-s">{f.label}</span>
                  {[...counts.get(f.id)!.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => {
                    const on = activeFacets.value.get(f.id)?.has(value) ?? false;
                    return (
                      <button key={value} class="facet-chip t-data" aria-pressed={on}
                        onClick={() => toggleFacet(f.id, value)}>
                        <span class="fv">{value}</span>
                        <span class="fc">{n}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </aside>
    </div>
  );
}

/** Bottom-sheet chooser for the mobile three-button rail. */
function OptionSheet(props: {
  open: boolean; label: string;
  options: Array<{ id: string; label: string; hint?: string }>;
  current: string;
  onPick: (id: string) => void;
}) {
  if (!props.open) return null;
  return (
    <div class="peek-scrim" onClick={closeTopOverlay}>
      <aside class="facet-sheet option-sheet" role="dialog" aria-modal="true" aria-label={props.label} onClick={(e) => e.stopPropagation()}>
        <header class="peek-head sheet-head">
          <span class="t-label t-label-s">{props.label}</span>
          <button class="hit peek-x" aria-label="Close" onClick={closeTopOverlay}>×</button>
        </header>
        {props.options.map((o) => (
          <button key={o.id} class={`facet-row ${props.current === o.id ? "is-on" : ""}`}
            onClick={() => { props.onPick(o.id); closeTopOverlay(); }}>
            <span class="fv t-data">{o.label}</span>
            {o.hint && <span class="fc t-data">{o.hint}</span>}
          </button>
        ))}
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
            {kept > 0 && <b class="is-keep">✓{kept}</b>}{kept > 0 && dropped > 0 && " "}
            {dropped > 0 && <b class="is-drop">✗{dropped}</b>}
          </span>
        )}
        {storedSections.length > 0 && (
          <button class="chip" aria-pressed={showStored} onClick={() => setShowStored(!showStored)}>
            stored · {storedSections.length}
          </button>
        )}
        {g.rows.length > 1 && (
          <span class="ghead-acts">
            <button class="chip gk" aria-label={`Keep all ${g.rows.length} in ${g.label}`}
              onClick={() => bulkDecide(g.rows, "keep", `keep ${g.label}`)}>✓ all</button>
            <button class="chip gd" aria-label={`Drop all ${g.rows.length} in ${g.label}`}
              onClick={() => bulkDecide(g.rows, "drop", `drop ${g.label}`)}>✗ all</button>
          </span>
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
    </div>
  );
}

function ClaimRow(props: { row: Row; showTarget: boolean; onActivate: (key: string) => void }) {
  const r = props.row;
  const d = decisions.value.get(r.key);
  const isFocused = cursor.value === r.key;
  const isOpen = detailKey.value === r.key;
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
  // Stays mounted while undo is available so touch users can undo a bulk
  // reset (the keyboard has `u`; the dock is the only touch path).
  if (!c.keep && !c.drop && !canUndo.value) return null;
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
