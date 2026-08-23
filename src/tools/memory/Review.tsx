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
  activeFacets, applyDecided, applying, applyProgress, blocked, bulkDecide, canUndo, cursor, cycleDecision, decisions, detailKey, droppedDependencyWarnings, edited, facetSheetOpen, groupBy, lastFailures, loadError, loading, notesById, preflight, preflightPending, preflightRowState, pressure, readyToSend, refresh, rejections, retryPersist, review, rows, saveState, setDecision, sortBy, sortDir, tally, undo,
} from "./store";
import { SECTION_CAP as CAP } from "./data";
import { refreshLtmStatus } from "./MemoryTool";
import { openOverlay, closeTopOverlay } from "../../shell/overlays";
import { signal } from "@preact/signals";
import { Flag, AllClear, NoMatches, DECISION_ICON, More, EditedMark, Back, Refresh, Download } from "../../ui/icons";
import { DecisionIcon, OpIcon, TypeIcon } from "./icons";
import { Term, OP_TIP } from "./glossary";
import { flagsOf, worstSeverity, contributionChars } from "./flags";
import { FACETS, GROUPERS, SORTERS, applyFilters, facetCounts, buildGroups, type Group } from "./facets";
import { ClaimDetail } from "./ClaimDetail";
import { NoteRef, peekNote } from "./NotePeek";
import { Chip, collapsedGroups, EmptyState, ErrorState, FacetDrawer, IconButton, ListGroup, Loading, Picker, useIsDesktop, useRovingFocus } from "../../ui";

const RESTORE_POINT_THRESHOLD = 20;

// Mobile choosers for group/sort (three-button rail).
const groupSheetOpen = signal(false);
const sortSheetOpen = signal(false);

// Collapsed groups. Not persisted: a queue you are working through should
// start open every visit, unlike the sources inventory.
const collapse = collapsedGroups();

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
  // Collapsed groups' rows leave the keyboard order too, or j/k would focus
  // rows the collapse has hidden.
  const visibleKeys = useMemo(
    () => groups.flatMap((g) => (collapse.has(g.id) ? [] : g.rows.map((r) => r.key))),
    [groups, collapse.ids.value],
  );

  // Triage keys that keep working when a chip or header control has focus —
  // everything else defers to the focused control.
  const NAV_KEYS = ["j", "k", "ArrowDown", "ArrowUp", "Escape", "u", "?"];
  const roving = useRovingFocus({
    listRef, keys: visibleKeys, current: cursor.value,
    rowSelector: ".mem-row", navKeys: NAV_KEYS,
    onFocus: (key) => {
      cursor.value = key;
      detailKey.value = key; // mobile: opens the stacked detail; desktop: the pane
    },
  });
  const focusRow = roving.reveal;
  const move = roving.move;

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
    if (roving.ignore(ev)) return;
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
    return <div className="screen"><ErrorState title="Could not load" message={loadError.value} /></div>;
  }
  if (loading.value) {
    return <div className="screen"><Loading label={t("reviewqueue.loadingPendingReviewDrafts")} /></div>;
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
    <div className={`audit ${desktop ? "is-desktop" : ""}`}>
      <div className="audit-list" ref={listRef} tabIndex={0} onKeyDown={onListKey}>
        <header className="console">
          <div className="hrow">
            <h1 className="console-title">{t("reviewqueue.reviewQueue")}</h1>
            <span className="t-data mem-save" data-contrast-exempt>
              {saveState.value === "saving" ? "Autosaving…"
                : saveState.value === "failed"
                  ? <span className="is-drop">Save FAILED <Chip onClick={retryPersist}>Retry</Chip></span>
                  : "Saved"}
            </span>
            <IconButton label="Refresh queue" onClick={() => void refresh()}><Refresh size={15} stroke={1.75} aria-hidden /></IconButton>
            <IconButton href={backupExportUrl()} download label={OURS.restorePoint}>
              <Download size={16} stroke={1.5} aria-hidden />
            </IconButton>
          </div>

          {review.value && (
            <div className="gen-line t-data" data-contrast-exempt>
              generated {new Date(review.value.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {review.value.counts.deduplications > 0 && <> · {review.value.counts.deduplications} deduped upstream</>}
            </div>
          )}

          {/* decision meter: tally as data, one line */}
          <div className="meter">
            <span className="t-label t-label-s">Decided</span>
            <span className="mbar">
              <span className="m-keep" style={`width:${total ? (c.keep / total) * 100 : 0}%`} />
              <span className="m-drop" style={`width:${total ? (c.drop / total) * 100 : 0}%`} />
            </span>
            <span className="t-data mval">
              <b className="is-keep"><DecisionIcon d="keep" size={12} />{c.keep}</b> · <b className="is-drop"><DecisionIcon d="drop" size={12} />{c.drop}</b>
              <span className="of"> / {total}</span>
            </span>
          </div>

          <div className="chiprail">
            {desktop ? (
              <>
                <Chip pressed={facetSheetOpen.value} onClick={openFacetSheet}>
                  Facets{activeFacetCount() > 0 && <b className="ar">{activeFacetCount()}</b>}
                </Chip>
                <QuickChip facet="status" value={OURS.undecided} label="Undecided" />
                <QuickChip facet="flags" value="restates vault" label="Restates" flag />
                <QuickChip facet="flags" value="duplicate incoming" label="Dupes" flag />
                <QuickChip facet="flags" value="has conflicts" label="Conflicts" flag />
                <span className="rail-gap" />
                {Object.entries(GROUPERS).map(([id, g]) => (
                  <Chip key={id} pressed={groupBy.value === id} onClick={() => { groupBy.value = id as typeof groupBy.value; }}>
                    {g.label}
                  </Chip>
                ))}
                <span className="rail-gap" />
                {Object.entries(SORTERS).map(([id, s]) => (
                  <Chip key={id} pressed={sortBy.value === id} onClick={() => {
                      if (sortBy.value === id) sortDir.value = (sortDir.value === 1 ? -1 : 1);
                      else { sortBy.value = id as typeof sortBy.value; sortDir.value = 1; }
                    }}>
                    {sortDir.value === 1 || sortBy.value !== id ? "↓" : "↑"} {s.label}
                  </Chip>
                ))}
              </>
            ) : (
              <>
                <Chip className="ctl" pressed={activeFacetCount() > 0} onClick={openFacetSheet}>
                  <span className="ctl-k">Filter</span><span className="ctl-v">{activeFacetCount() || "all"}</span>
                </Chip>
                <Chip className="ctl" onClick={() => { groupSheetOpen.value = true; }}>
                  <span className="ctl-k">Group</span><span className="ctl-v">{GROUPERS[groupBy.value].label}</span>
                </Chip>
                <Chip className="ctl" onClick={() => { sortSheetOpen.value = true; }}>
                  <span className="ctl-k">Sort</span><span className="ctl-v">{sortDir.value === 1 ? "↓" : "↑"} {SORTERS[sortBy.value].label}</span>
                </Chip>
                <QuickChip facet="status" value={OURS.undecided} label="Undecided" />
                <QuickChip facet="flags" value="restates vault" label="Restates" flag />
                <QuickChip facet="flags" value="duplicate incoming" label="Dupes" flag />
                <QuickChip facet="flags" value="has conflicts" label="Conflicts" flag />
              </>
            )}
          </div>

          {activeFacetCount() > 0 && (
            <div className="chiprail">
              <span className="t-data selcount">{shown.length} of {rows.value.length}</span>
              <Chip onClick={() => bulkDecide(shown, "keep", "keep shown")}>Keep shown</Chip>
              <Chip onClick={() => bulkDecide(shown, "drop", "drop shown")}>Drop shown</Chip>
              <Chip onClick={() => bulkDecide(shown, null, "reset shown")}>Reset</Chip>
              <Chip onClick={() => { activeFacets.value = new Map(); }}>Clear filters</Chip>
            </div>
          )}
        </header>

        <main className="rows mem-rows">
          <Obligations />
          <Failures />
          {shown.length === 0 && rows.value.length === 0 && !blocked.value.length && (
            // An emptied queue is the reviewer succeeding, so it reads the
            // same way the Sources screen's cleared backlog does.
            <EmptyState tone="ok" icon={<AllClear size={22} stroke={1.75} aria-hidden />} title={OURS.queueEmpty} />
          )}
          {shown.length === 0 && rows.value.length > 0 && (
            <EmptyState icon={<NoMatches size={22} stroke={1.75} aria-hidden />} title="No proposals match the active facets." />
          )}
          {groups.map((g) => <GroupBlock key={g.id} group={g} showTarget={groupBy.value !== "target"} onActivate={focusRow} tabbable={roving.tabbable} />)}
          <Rejections />
        </main>
      </div>

      {showDetailPane && (
        <aside className="audit-detail">
          {detailRow
            ? <ClaimDetail key={detailRow.key} row={detailRow} />
            : <EmptyState title="No claim open" body="j/k to move · a keep · d drop · Enter opens" />}
        </aside>
      )}
      {showDetailStack && (
        <div className="stack-screen">
          <header className="console"><div className="hrow">
            <IconButton className="hit" label="Back to queue" onClick={closeTopOverlay}><Back size={18} stroke={1.75} aria-hidden /></IconButton>
            {/* Queue position, not the target title — the headline right below
                already names the target, and position is what j/k triage wants. */}
            <h1 className="console-title">
              {visibleKeys.includes(detailRow!.key)
                ? `claim ${visibleKeys.indexOf(detailRow!.key) + 1} of ${visibleKeys.length}`
                : detailRow!.targetTitle}
            </h1>
          </div></header>
          <ClaimDetail key={detailRow!.key} row={detailRow!} />
        </div>
      )}

      <FacetSheet />
      <Picker open={groupSheetOpen.value} label="Group by" current={groupBy.value}
        options={Object.entries(GROUPERS).map(([id, g]) => ({ id, label: g.label }))}
        onPick={(id) => { groupBy.value = id as typeof groupBy.value; }}
        onClose={() => { groupSheetOpen.value = false; }} />
      <Picker open={sortSheetOpen.value} label="Sort by" current={sortBy.value}
        onClose={() => { sortSheetOpen.value = false; }}
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
    <Chip flag={props.flag} pressed={on} onClick={() => toggleFacet(props.facet, props.value)}>
      {props.label}
    </Chip>
  );
}

/** "Lorebook - Ashgate — Harbour Canon: The Tidewatch Compact" → "The
 *  Tidewatch Compact". Anything without that shape is left alone. */
function sourceFacetLabel(title: string): string {
  const t = title.replace(/^Lorebook\s*-\s*/i, "");
  const i = t.indexOf(":");
  return i > 0 ? t.slice(i + 1).trim() : t;
}

/** The review queue's facets, shaped for <FacetDrawer>. Provenance grouping is
 *  the review study's: what the console computed, what the model asserted, and
 *  what the reviewer decided. */
function FacetSheet() {
  if (!facetSheetOpen.value) return null;
  const counts = facetCounts(rows.value, activeFacets.value);
  // A selected value must stay listed even at count 0, or the selection
  // becomes un-clearable and the drawer can render blank.
  for (const [facetId, set] of activeFacets.value) {
    const m = counts.get(facetId);
    if (!m) continue;
    for (const v of set) if (!m.has(v)) m.set(v, 0);
  }
  const label = { computed: OURS.facetsComputed, model: OURS.facetsFromModel, yours: OURS.facetsYours };
  const groups = (["computed", "model", "yours"] as const).map((key) => ({
    key,
    label: label[key],
    facets: FACETS.filter((f) => f.source === key).map((f) => ({
      id: f.id,
      label: f.label,
      values: [...(counts.get(f.id) ?? new Map()).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({
          value,
          // Source titles arrive as "Lorebook - <book>: <entry>". Four chips
          // reading "Lorebook - Ashgate — …" name nothing, so the chip shows
          // the entry and keeps the whole title in its tooltip.
          label: f.id === "source" ? sourceFacetLabel(value) : undefined,
          count,
          on: activeFacets.value.get(f.id)?.has(value) ?? false,
        })),
    })),
  }));
  return (
    <FacetDrawer
      groups={groups}
      onToggle={toggleFacet}
      onClear={() => { activeFacets.value = new Map(); }}
      onClose={() => { facetSheetOpen.value = false; }}
      emptyText="No facet values in this slice."
    />
  );
}


// Group header v4 (owner-approved 2026-08-21): one line — identity · honest
// aggregates (sections touched, chars added) · cap flag only when real · bar
// tally · keep-all/drop-all as icon buttons (undecided rows only) · kebab for
// the rare object actions. Object affordances (type icon, dot, aggregates,
// pressure, open-note) exist only when the group key IS an object; enum lanes
// get label + count + tally + bulk and nothing else. At narrow width the
// header wraps to two lines and the aggregates drop (priority order, CSS).
function GroupBlock(props: { group: Group; showTarget: boolean; onActivate: (key: string) => void; tabbable: (key: string) => boolean }) {
  const g = props.group;
  const isTarget = groupBy.value === "target";
  const kept = g.rows.filter((r) => decisions.value.get(r.key) === "keep").length;
  const dropped = g.rows.filter((r) => decisions.value.get(r.key) === "drop").length;
  const undecidedRows = g.rows.filter((r) => !decisions.value.get(r.key));
  const isNew = isTarget && !notesById.value.get(g.id) && g.rows.some((r) => r.mutation.kind === "create_note");
  const collapsed = collapse.has(g.id);
  // Section counts dropped from the header (Luma 2026-08-21: titles get the room).
  const chars = isTarget ? g.rows.reduce((n, r) => n + contributionChars(r), 0) : 0;
  return (
    /* Same grid as the rows: chevron in the rail (the control column gets a
       control), type icon in the kind column, words in the body. The
       new-target marker is the 2a green edge (owner call, color-only tradeoff
       accepted) — an edge, so nothing in the title line shifts. */
    <ListGroup className={`mem-ghead ${isNew ? "is-new" : ""}`}
        collapsed={collapsed} onToggle={() => collapse.toggle(g.id)}
        label={g.label} count={g.rows.length}
        head={<>
        {isTarget && g.meta && <TypeIcon type={g.meta} />}
        <div className="ghead-body">
        <span className="gn t-prose">{g.label}</span>
        {chars > 0 && <span className="ghead-agg t-data">+{chars.toLocaleString()}</span>}
        <span className="ghead-ctl">
          <GroupPressure groupId={g.id} isTarget={isTarget} />
          <span className="tbar-w" aria-label={`${kept + dropped} of ${g.rows.length} decided`}>
            <span className="tbar">
              <i className="tk" style={`width:${(kept / g.rows.length) * 100}%`} />
              <i className="td" style={`width:${(dropped / g.rows.length) * 100}%`} />
            </span>
            <span className="tbar-n t-data">{kept + dropped}/{g.rows.length}</span>
          </span>
          {undecidedRows.length > 0 && (
            <span className="ghead-acts">
              <button className="gib gk" title={`Keep ${undecidedRows.length} undecided`}
                aria-label={`Keep all ${undecidedRows.length} undecided in ${g.label}`}
                onClick={() => bulkDecide(undecidedRows, "keep", `keep ${g.label}`)}>
                <DECISION_ICON.keep size={15} stroke={1.75} aria-hidden />
              </button>
              <button className="gib gd" title={`Drop ${undecidedRows.length} undecided`}
                aria-label={`Drop all ${undecidedRows.length} undecided in ${g.label}`}
                onClick={() => bulkDecide(undecidedRows, "drop", `drop ${g.label}`)}>
                <DECISION_ICON.drop size={15} stroke={1.75} aria-hidden />
              </button>
            </span>
          )}
          {isTarget && <GroupMenu group={g} kept={kept} dropped={dropped} isNew={isNew} />}
        </span>
        </div>
      </>}>
      {g.rows.map((r) => <ClaimRow key={r.key} row={r} showTarget={props.showTarget} onActivate={props.onActivate} tabbable={props.tabbable(r.key)} />)}
    </ListGroup>
  );
}

/** The kebab: rare object actions only — open the memory, clear this group's
 *  decisions. (Contents still under discussion; if it ends up with one item
 *  it dies and that item goes inline.) */
function GroupMenu(props: { group: Group; kept: number; dropped: number; isNew: boolean }) {
  const [open, setOpen] = useState(false);
  const g = props.group;
  return (
    <span className="gmenu-wrap">
      <button className="gib gmenu" aria-label={`Actions for ${g.label}`} aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <More size={16} stroke={1.75} aria-hidden />
      </button>
      {open && (
        <>
          <span className="gmenu-scrim" onClick={() => setOpen(false)} />
          <div className="gmenu-pop" role="menu">
            {!props.isNew && (
              <button role="menuitem" onClick={() => { setOpen(false); peekNote(g.id); }}>{t("reviewqueue.openMemory")}</button>
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
function ClaimRow(props: {
  row: Row; showTarget: boolean; onActivate: (key: string) => void;
  /** True for the one row that holds the list's tab stop. */
  tabbable: boolean;
}) {
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
  // Roving tabindex: only the cursor row is in the tab order (src/ui/useRovingFocus).
  const tab = props.tabbable ? 0 : -1;
  return (
    <div className={`mem-row ${isOpen ? "is-open" : ""} ${isFocused ? "is-focused" : ""}`} data-row={r.key} data-d={d ?? "undecided"}>
      <div className="mem-summary">
        <button
          className="mem-dec hit"
          tabIndex={tab}
          aria-label={`Decision: ${d ?? OURS.undecided}. Tap to cycle.`}
          onClick={(e) => { e.stopPropagation(); cycleDecision(r); }}
        >
          <DecisionIcon d={d} />
        </button>
        <span className="kslot">
          <Term tip={OP_TIP[r.mutation.kind]} tabIndex={tab}><OpIcon kind={r.mutation.kind} /></Term>
        </span>
        <button className="mem-mid" tabIndex={tab} onClick={() => props.onActivate(r.key)}>
          {props.showTarget && (
            <span className="a1-tgt t-data">
              <TypeIcon type={r.targetType} size={13} />
              {isNew && <span className="ndot" aria-label="will be created" />}
              {r.targetTitle}
            </span>
          )}
          <span className="claim-text t-prose">{r.text}</span>
          <span className="row-trail t-data">
            {edited.value.has(r.key) && (
              <Term tip="edited · you replaced this claim's proposed text — your version applies with the batch">
                <EditedMark size={14} stroke={1.75} className="edit-mark" aria-label={t("reviewqueue.editedChange")} />
              </Term>
            )}
            {isAuto && <span className="dep-tag">dependency</span>}
            {blockedMsg && <span className="is-drop" title={blockedMsg}>blocked</span>}
            {flags.length > 0 && (
              <span className="fq" data-sev={sev} title={flags.map((f) => f.label).join(" · ")}>
                <Flag size={13} stroke={1.75} aria-hidden />{flags.length}
              </span>
            )}
            <span className="chs">{chars > 0 ? `+${chars.toLocaleString()}` : ""}</span>
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
    <span className="fq gcap" data-sev={over ? "danger" : "warn"}
      title={`§${worst.key}: stored ${worst.current.toLocaleString()} ch, ${worst.projected.toLocaleString()} after this batch, cap ${CAP.toLocaleString()}`}>
      <Flag size={12} stroke={1.75} aria-hidden /><span className="gcap-pct">cap {pct}%</span>
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
        <div key={code} className="mem-card">
          <div className="t-data"><span className="fl">{code.replaceAll("_", " ")}</span> <b>{items.length}</b> draft{items.length === 1 ? "" : "s"} blocked · {items.reduce((n, b) => n + b.mutationCount, 0)} claims held</div>
          <p className="t-prose dim">{message}</p>
          <div className="blocked-srcs">
            {items.map((b) => (
              <span key={b.draftId} className="t-data blocked-src">
                <NoteRef id={b.sourceNoteId} label={b.sourceTitle} /> <span className="dim">· {b.mutationCount} claim{b.mutationCount === 1 ? "" : "s"}</span>
              </span>
            ))}
          </div>
          {["source_stale", "source_context_unbound"].includes(code) && (
            <>
              <Chip disabled={Boolean(extracting)} onClick={() => void reextract(items)}>
                {extracting ? `Extracting ${extracting}…` : t("memoryvault.extractToReview")}
              </Chip>
              <p className="t-prose dim reex-note">Re-extracting calls the model once per source and replaces each blocked draft with a fresh one.</p>
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
        <div key={f.title} className="mem-card is-danger">
          <div className="t-data"><span className="fl">apply failed</span> <b>{f.n}</b> · {f.title}</div>
          <p className="t-prose dim">{f.fix}</p>
          <details><summary className="t-data dim">raw</summary><p className="t-data dim">{f.msg.slice(0, 400)}</p></details>
        </div>
      ))}
      <div className="group-actions"><Chip onClick={() => { lastFailures.value = []; }}>Dismiss</Chip></div>
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
    <div className="mem-rejections">
      <div className="mem-ghead is-plain"><span className="gn t-prose">{t("reviewqueue.suggestionsThatWerentSaved")}</span>
        <span className="t-data dim">{rejections.value.length}</span></div>
      {[...byReason.entries()].map(([reason, items]) => (
        <details key={reason} className="mem-card">
          <summary className="t-data"><span className="fl">{reason.replaceAll("_", " ")}</span> <b>{items.length}</b> · <span className="dim">{items[0].message ?? ""}</span></summary>
          {items.map((i, idx) => <p key={idx} className="t-prose dim rej-snippet">{i.snippet}</p>)}
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
  // ready-after-drops, not the raw engine count, or a dropped dependency
  // preflight auto-included is counted twice (store.ts readyToSend)
  const applyCount = readyToSend.value + c.drop;
  const offerRestore = c.keep + c.drop >= RESTORE_POINT_THRESHOLD;
  const rowByKey = new Map(rows.value.map((row) => [row.key, row]));
  const pfState = preflightRowState.value;
  const autoRows = [...pfState.auto.keys()].map((k) => rowByKey.get(k)).filter(Boolean) as Row[];
  const blockedRows = [...pfState.blockedRows.entries()]
    .map(([k, why]) => ({ row: rowByKey.get(k), why }))
    .filter((x) => x.row) as Array<{ row: Row; why: string }>;
  return (
    <div className="apply-dock">
      <div className="dock-info t-data">
        <b className="is-keep">{c.keep}</b> {OURS.keep} · <b className="is-drop">{c.drop}</b> {OURS.drop}
        {c.undecided > 0 && <span className="dim"> · {c.undecided} {OURS.undecided}</span>}
        {c.edited > 0 && <span> · {c.edited} edited</span>}
        <br />
        <span className="dim">
          {progress ? <>Applying draft {progress.done}/{progress.total}…</> : <>
            {OURS.draftsWillApply(c.willSend)}{c.stayPending ? ` (${c.stayPending} still hold undecided claims)` : ""}
            {pf?.error
              ? <span className="is-drop"> · {pf.error} <Chip onClick={() => void refresh()}>Retry</Chip></span>
              : checking
                ? <> · checking with the engine…</>
                : pf
                  ? <> · {readyToSend.value} ready{pf.blockedN ? <span className="is-drop"> · {pf.blockedN} blocked</span> : null}</>
                  : null}
          </>}
        </span>
        {!checking && autoRows.length > 0 && (
          <details className="dock-detail"><summary>{OURS.autoIncluded(autoRows.length)}</summary>
            {autoRows.map((row) => <div key={row.key} className="dim dock-detail-row">→ {row.targetTitle}: {row.text.slice(0, 80)}</div>)}
          </details>
        )}
        {!checking && blockedRows.length > 0 && (
          <details className="dock-detail is-drop"><summary>{blockedRows.length} blocked — held back from Apply</summary>
            {blockedRows.map(({ row, why }) => <div key={row.key} className="dim dock-detail-row">→ {row.targetTitle}: {why}</div>)}
          </details>
        )}
        {/* The whole sentence branches, not just the noun: pluralising "claim"
            alone left "1 kept claim depend ... they will fail ... drop them". */}
        {warnings.length > 0 && (
          <div className="is-drop">
            {warnings.length === 1
              ? "1 kept claim depends on a dropped create — it will fail; keep the create or drop it"
              : `${warnings.length} kept claims depend on a dropped create — they will fail; keep the create or drop them`}
          </div>
        )}
        {offerRestore && <><br /><a className="t-data restore-link" href={backupExportUrl()} download onClick={() => toast(OURS.restorePointDone)}>{OURS.restorePoint}</a></>}
      </div>
      <Chip disabled={!canUndo.value} onClick={undo}>Undo</Chip>
      <button className="dock-primary t-label" disabled={applying.value || checking || (c.keep > 0 && !pf) || Boolean(pf?.error)} onClick={() => void applyDecided()}>
        {applying.value ? (progress ? `Applying ${progress.done}/${progress.total}…` : OURS.applying)
          : checking ? "Apply decided (…)"
          : `Apply decided (${applyCount})`}
      </button>
    </div>
  );
}
