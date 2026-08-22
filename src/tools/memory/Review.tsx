// Review Queue — the curation loop's triage surface (ltm-review J3).
//
// Console header (tally meter, quick chips, facet sheet) · audit rows grouped
// by target memory · tri-state decision rail · master-detail on desktop,
// stacked detail on mobile · apply dock. Keyboard: j/k move, a/d keep/drop,
// x undecide, space cycle, Enter opens, u undo (DESIGN.md §3, §6 triage).

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { toast } from "../../shell/toast";
import { type Row, backupExportUrl, extractNote } from "./data";
import { t, OURS } from "./strings";
import {
  rows, blocked, rejections, loading, loadError, review,
  decisions, edited, cursor, detailKey, facetSheetOpen, saveState,
  activeFacets, groupBy, sortBy, sortDir, tally, preflight, preflightPending,
  preflightRowState, applying, applyProgress, lastFailures,
  droppedDependencyWarnings, canUndo, notesById, pressure,
  refresh, retryPersist, setDecision, cycleDecision, bulkDecide, undo, applyDecided,
} from "./store";
import { SECTION_CAP as CAP } from "./data";
import { refreshLtmStatus } from "./MemoryTool";
import { openOverlay, closeTopOverlay } from "./overlays";
import { signal } from "@preact/signals";
import { IconFlag, IconCircleCheck, IconCircleX, IconDotsVertical, IconWriting } from "@tabler/icons-preact";
import { DecisionIcon, OpIcon, TypeIcon } from "./icons";
import { Term, OP_TIP } from "./glossary";
import { flagsOf, worstSeverity, contributionChars } from "./flags";
import { FACETS, GROUPERS, SORTERS, applyFilters, facetCounts, buildGroups, type Group } from "./facets";
import { ClaimDetail } from "./ClaimDetail";
import { NoteRef, peekNote } from "./NotePeek";

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
    // A focused button OUTSIDE the rows (chips, header controls) owns its own
    // Space/Enter; buttons inside a row are part of the list composite, so
    // the triage keys keep working after tapping a row.
    const button = el.closest("button");
    if (button && !button.closest(".mem-row") && !["j", "k", "ArrowDown", "ArrowUp", "Escape", "u", "?"].includes(ev.key)) return;
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
              {saveState.value === "saving" ? "Autosaving…"
                : saveState.value === "failed"
                  ? <span class="is-drop">Save FAILED <button class="chip" onClick={retryPersist}>Retry</button></span>
                  : "Saved"}
            </span>
            <button class="icon-btn t-data" aria-label="Refresh queue" title="Refresh" onClick={() => void refresh()}>↻</button>
            <a class="icon-btn" href={backupExportUrl()} download title={OURS.restorePoint} aria-label="Export backup">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1v9m0 0L4.5 6.5M8 10l3.5-3.5M2 12.5V14h12v-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
          </div>

          {review.value && (
            <div class="gen-line t-data" data-contrast-exempt>
              generated {new Date(review.value.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {review.value.counts.deduplications > 0 && <> · {review.value.counts.deduplications} deduped upstream</>}
            </div>
          )}

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
                <QuickChip facet="flags" value="has conflicts" label="Conflicts" flag />
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
                <QuickChip facet="flags" value="has conflicts" label="Conflicts" flag />
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
            <p class="empty">{OURS.queueEmpty}</p>
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

// Group header v4 (owner-approved 2026-08-21): one line — identity · honest
// aggregates (sections touched, chars added) · cap flag only when real · bar
// tally · keep-all/drop-all as icon buttons (undecided rows only) · kebab for
// the rare object actions. Object affordances (type icon, dot, aggregates,
// pressure, open-note) exist only when the group key IS an object; enum lanes
// get label + count + tally + bulk and nothing else. At narrow width the
// header wraps to two lines and the aggregates drop (priority order, CSS).
function GroupBlock(props: { group: Group; showTarget: boolean; onActivate: (key: string) => void }) {
  const g = props.group;
  const isTarget = groupBy.value === "target";
  const kept = g.rows.filter((r) => decisions.value.get(r.key) === "keep").length;
  const dropped = g.rows.filter((r) => decisions.value.get(r.key) === "drop").length;
  const undecidedRows = g.rows.filter((r) => !decisions.value.get(r.key));
  const isNew = isTarget && !notesById.value.get(g.id) && g.rows.some((r) => r.mutation.kind === "create_note");
  const sections = isTarget ? new Set(g.rows.flatMap((r) => r.parts.map((p) => p.key))).size : 0;
  const chars = isTarget ? g.rows.reduce((n, r) => n + contributionChars(r), 0) : 0;
  return (
    <div>
      <div class={`grouphead ghead4 ${isTarget ? "is-object" : ""}`}>
        <span class="ghead-id">
          {isTarget && g.meta && <TypeIcon type={g.meta} />}
          {isNew && <span class="ndot" aria-label="will be created" />}
          <span class="gn t-prose">{g.label}</span>
        </span>
        <span class="ghead-agg t-data" data-contrast-exempt>
          {sections > 0 && <>{sections} section{sections === 1 ? "" : "s"}</>}
          {chars > 0 && <>{sections > 0 && " · "}+{chars.toLocaleString()}</>}
        </span>
        <GroupPressure groupId={g.id} isTarget={isTarget} />
        <span class="tbar-w" aria-label={`${kept + dropped} of ${g.rows.length} decided`}>
          <span class="tbar">
            <i class="tk" style={`width:${(kept / g.rows.length) * 100}%`} />
            <i class="td" style={`width:${(dropped / g.rows.length) * 100}%`} />
          </span>
          <span class="tbar-n t-data">{kept + dropped}/{g.rows.length}</span>
        </span>
        {undecidedRows.length > 0 && (
          <span class="ghead-acts">
            <button class="gib gk" title={`Keep ${undecidedRows.length} undecided`}
              aria-label={`Keep all ${undecidedRows.length} undecided in ${g.label}`}
              onClick={() => bulkDecide(undecidedRows, "keep", `keep ${g.label}`)}>
              <IconCircleCheck size={15} stroke={1.75} aria-hidden />
            </button>
            <button class="gib gd" title={`Drop ${undecidedRows.length} undecided`}
              aria-label={`Drop all ${undecidedRows.length} undecided in ${g.label}`}
              onClick={() => bulkDecide(undecidedRows, "drop", `drop ${g.label}`)}>
              <IconCircleX size={15} stroke={1.75} aria-hidden />
            </button>
          </span>
        )}
        {isTarget && <GroupMenu group={g} kept={kept} dropped={dropped} isNew={isNew} />}
      </div>
      {g.rows.map((r) => <ClaimRow key={r.key} row={r} showTarget={props.showTarget} onActivate={props.onActivate} />)}
    </div>
  );
}

/** The kebab: rare object actions only — open the note, clear this group's
 *  decisions. (Contents still under discussion; if it ends up with one item
 *  it dies and that item goes inline.) */
function GroupMenu(props: { group: Group; kept: number; dropped: number; isNew: boolean }) {
  const [open, setOpen] = useState(false);
  const g = props.group;
  return (
    <span class="gmenu-wrap">
      <button class="gib gmenu" aria-label={`Actions for ${g.label}`} aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <IconDotsVertical size={16} stroke={1.75} aria-hidden />
      </button>
      {open && (
        <>
          <span class="gmenu-scrim" onClick={() => setOpen(false)} />
          <div class="gmenu-pop" role="menu">
            {!props.isNew && (
              <button role="menuitem" onClick={() => { setOpen(false); peekNote(g.id); }}>Open note</button>
            )}
            {(props.kept > 0 || props.dropped > 0) && (
              <button role="menuitem" onClick={() => { setOpen(false); bulkDecide(g.rows, null, `reset ${g.label}`); }}>
                Clear decisions ({props.kept + props.dropped})
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
}

// Row v2 (owner-approved 2026-08-21): status icon that cycles on tap · fixed
// op-icon slot · one-line claim · quiet flags chip (worst severity tints it) ·
// contribution chars. No secondary line, no per-row confidence — the enums
// live in the detail card, their exceptions live in the flags.
function ClaimRow(props: { row: Row; showTarget: boolean; onActivate: (key: string) => void }) {
  const r = props.row;
  const d = decisions.value.get(r.key);
  const pfState = preflightRowState.value;
  const isAuto = pfState.auto.has(r.key) && d !== "keep";
  const blockedMsg = d === "keep" ? pfState.blockedRows.get(r.key) : undefined;
  const isFocused = cursor.value === r.key;
  const isOpen = detailKey.value === r.key;
  const flags = flagsOf(r);
  const sev = worstSeverity(flags);
  const chars = contributionChars(r);
  const isNew = r.mutation.kind === "create_note";
  return (
    <div class={`row mem-row ${isOpen ? "is-open" : ""} ${isFocused ? "is-focused" : ""}`} data-row={r.key} data-d={d ?? "undecided"}>
      <div class="row-summary mem-summary has-kslot">
        <button
          class="rail-cell tri hit"
          aria-label={`Decision: ${d ?? OURS.undecided}. Tap to cycle.`}
          onClick={(e) => { e.stopPropagation(); cycleDecision(r); }}
        >
          <DecisionIcon d={d} />
        </button>
        <span class="kslot">
          <Term tip={OP_TIP[r.mutation.kind]}><OpIcon kind={r.mutation.kind} /></Term>
        </span>
        <button class="mid mem-mid" onClick={() => props.onActivate(r.key)}>
          {props.showTarget && (
            <span class="a1-tgt t-data">
              <TypeIcon type={r.targetType} size={13} />
              {isNew && <span class="ndot" aria-label="will be created" />}
              {r.targetTitle}
            </span>
          )}
          <span class="claim-text t-prose">{r.text}</span>
          <span class="row-trail t-data">
            {edited.value.has(r.key) && (
              <Term tip="edited · you replaced this claim's proposed text — your version applies with the batch">
                <IconWriting size={14} stroke={1.75} class="edit-mark" aria-label={t("reviewqueue.editedChange")} />
              </Term>
            )}
            {isAuto && <span class="dep-tag">dependency</span>}
            {blockedMsg && <span class="is-drop" title={blockedMsg}>blocked</span>}
            {flags.length > 0 && (
              <span class="fq" data-sev={sev} title={flags.map((f) => f.label).join(" · ")}>
                <IconFlag size={13} stroke={1.75} aria-hidden />{flags.length}
              </span>
            )}
            <span class="chs">{chars > 0 ? `+${chars.toLocaleString()}` : ""}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

// Compact cap signal: flag glyph + percentage, tinted by severity; the full
// numbers live in the title and in the detail's computed-signals zone. At
// narrow width the percentage drops and the glyph alone carries it (CSS).
function GroupPressure(props: { groupId: string; isTarget: boolean }) {
  if (!props.isTarget) return null;
  let worst: { key: string; current: number; projected: number } | null = null;
  for (const [, p] of pressure.value) {
    if (p.noteId !== props.groupId) continue;
    if (!worst || p.projected > worst.projected) worst = p;
  }
  if (!worst || worst.projected < CAP * 0.8) return null;
  const over = worst.projected > CAP;
  const pct = Math.round((worst.projected / CAP) * 100);
  return (
    <span class="fq gcap" data-sev={over ? "danger" : "warn"}
      title={`§${worst.key}: stored ${worst.current.toLocaleString()} ch, ${worst.projected.toLocaleString()} after this batch, cap ${CAP.toLocaleString()}`}>
      <IconFlag size={12} stroke={1.75} aria-hidden /><span class="gcap-pct">cap {pct}%</span>
    </span>
  );
}

function Obligations() {
  const [extracting, setExtracting] = useState<string | null>(null); // "2/5" while running
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
    if (extracting) return;
    for (let i = 0; i < items.length; i++) {
      setExtracting(`${i + 1}/${items.length}`);
      try { await extractNote(items[i].sourceNoteId); } catch (error) { toast((error as Error).message, { kind: "error" }); }
    }
    setExtracting(null);
    await refresh();
  };
  return (
    <>
      {[...byCode.entries()].map(([code, { message, items }]) => (
        <div key={code} class="mem-card">
          <div class="t-data"><span class="fl">{code.replaceAll("_", " ")}</span> <b>{items.length}</b> draft{items.length === 1 ? "" : "s"} blocked · {items.reduce((n, b) => n + b.mutationCount, 0)} claims held</div>
          <p class="t-prose dim">{message}</p>
          <div class="blocked-srcs">
            {items.map((b) => (
              <span key={b.draftId} class="t-data blocked-src">
                <NoteRef id={b.sourceNoteId} label={b.sourceTitle} /> <span class="dim">· {b.mutationCount} claim{b.mutationCount === 1 ? "" : "s"}</span>
              </span>
            ))}
          </div>
          {["source_stale", "source_context_unbound"].includes(code) && (
            <>
              <button class="chip" disabled={Boolean(extracting)} onClick={() => void reextract(items)}>
                {extracting ? `Extracting ${extracting}…` : t("memoryvault.extractToReview")}
              </button>
              <p class="t-prose dim reex-note">Re-extracting calls the model once per source and replaces each blocked draft with a fresh one.</p>
            </>
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
  const checking = preflightPending.value;
  const progress = applyProgress.value;
  const warnings = droppedDependencyWarnings.value;
  const applyCount = (pf?.ready ?? 0) + c.drop;
  const offerRestore = c.keep + c.drop >= RESTORE_POINT_THRESHOLD;
  const rowByKey = new Map(rows.value.map((row) => [row.key, row]));
  const pfState = preflightRowState.value;
  const autoRows = [...pfState.auto.keys()].map((k) => rowByKey.get(k)).filter(Boolean) as Row[];
  const blockedRows = [...pfState.blockedRows.entries()]
    .map(([k, why]) => ({ row: rowByKey.get(k), why }))
    .filter((x) => x.row) as Array<{ row: Row; why: string }>;
  return (
    <div class="apply-dock">
      <div class="dock-info t-data">
        <b class="is-keep">{c.keep}</b> {OURS.keep} · <b class="is-drop">{c.drop}</b> {OURS.drop}
        {c.undecided > 0 && <span class="dim"> · {c.undecided} {OURS.undecided}</span>}
        {c.edited > 0 && <span> · {c.edited} edited</span>}
        <br />
        <span class="dim">
          {progress ? <>Applying draft {progress.done}/{progress.total}…</> : <>
            {c.willSend} draft{c.willSend === 1 ? "" : "s"} will be sent{c.stayPending ? ` (${c.stayPending} still hold undecided claims)` : ""}
            {pf?.error
              ? <span class="is-drop"> · {pf.error} <button class="chip" onClick={() => void refresh()}>Retry</button></span>
              : checking
                ? <> · checking with the engine…</>
                : pf
                  ? <> · {pf.ready} ready{pf.blockedN ? <span class="is-drop"> · {pf.blockedN} blocked</span> : null}</>
                  : null}
          </>}
        </span>
        {!checking && autoRows.length > 0 && (
          <details class="dock-detail"><summary>{OURS.autoIncluded(autoRows.length)}</summary>
            {autoRows.map((row) => <div key={row.key} class="dim dock-detail-row">→ {row.targetTitle}: {row.text.slice(0, 80)}</div>)}
          </details>
        )}
        {!checking && blockedRows.length > 0 && (
          <details class="dock-detail is-drop"><summary>{blockedRows.length} blocked — held back from Apply</summary>
            {blockedRows.map(({ row, why }) => <div key={row.key} class="dim dock-detail-row">→ {row.targetTitle}: {why}</div>)}
          </details>
        )}
        {warnings.length > 0 && <div class="is-drop">{warnings.length} kept claim{warnings.length === 1 ? "" : "s"} depend on a dropped create — they will fail; keep the create or drop them</div>}
        {offerRestore && <><br /><a class="t-data restore-link" href={backupExportUrl()} download onClick={() => toast(OURS.restorePointDone)}>{OURS.restorePoint}</a></>}
      </div>
      <button class="chip" disabled={!canUndo.value} onClick={undo}>Undo</button>
      <button class="dock-primary t-label" disabled={applying.value || checking || (c.keep > 0 && !pf) || Boolean(pf?.error)} onClick={() => void applyDecided()}>
        {applying.value ? (progress ? `Applying ${progress.done}/${progress.total}…` : t("reviewqueue.accepting"))
          : checking ? "Apply decided (…)"
          : `Apply decided (${applyCount})`}
      </button>
    </div>
  );
}
