// Review Queue — the curation loop's triage surface.
//
// Console header (tally meter, quick chips, facet sheet) · audit rows grouped
// by target memory · tri-state decision rail · master-detail on desktop,
// stacked detail on mobile · apply dock. Keyboard: j/k move, a/d keep/drop,
// x undecide, space cycle, Enter opens, u undo (DESIGN.md §3, §6 triage).

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { toast } from "../../shell/toast";
import { extractNote } from "./api/notes";
import { backupExportUrl } from "./api/backup";
import type { BlockedDraft, Rejection, Row } from "./model/review";
import { t } from "../../copy";
import { Copy } from "./Copy";
import {
  activeFacets, applyDecided, applying, applyProgress, blocked, bulkDecide, canUndo, cursor, cycleDecision, decisions, detailKey, droppedDependencyWarnings, edited, facetSheetOpen, groupBy, lastFailures, loadError, loading, notesById, preflight, preflightPending, preflightRowState, readyToSend, refresh, rejections, retryPersist, review, rows, saveState, setDecision, sortBy, sortDir, tally, undo,
} from "./store";
import { pressure } from "./store/pressure";
import { SECTION_CAP as CAP } from "./model/caps";
import { capPercent } from "./model/pressure";
import { openOverlay, closeTopOverlay } from "../../shell/overlays";
import { Flag, AllClear, NoMatches, DECISION_ICON, More, EditedMark, Back, Refresh, Download } from "../../ui/icons";
import { DecisionIcon, OpIcon, TypeIcon } from "./icons";
import { Term, OP_TIP } from "./glossary";
import { flagsOf, worstSeverity, contributionChars, FLAG } from "./model/flags";
import { FACETS, GROUPERS, SORTERS, applyFilters, facetCounts, buildGroups, type Group } from "./model/facets";
import { ClaimDetail } from "./ClaimDetail";
import { NoteRef, peekNote } from "./NotePeek";
import { Chip, collapsedGroups, EmptyState, ErrorState, FacetDrawer, IconButton, ListGroup, Loading, Picker, useIsDesktop, useRovingFocus } from "../../ui";
import { createStore, useStore } from "../../lib/store";

const RESTORE_POINT_THRESHOLD = 20;

// Mobile choosers for group/sort (three-button rail).
const groupSheetOpen = createStore(false);
const sortSheetOpen = createStore(false);

// Collapsed groups. Not persisted: a queue you are working through should
// start open every visit, unlike the sources inventory.
const collapse = collapsedGroups();

export function Review() {
  const desktop = useIsDesktop();
  const listRef = useRef<HTMLDivElement>(null);
  const allRows = useStore(rows);
  const active = useStore(activeFacets);
  const dec = useStore(decisions);
  const editedMuts = useStore(edited);
  const sectionPressure = useStore(pressure);
  const notes = useStore(notesById);
  const group = useStore(groupBy);
  const sort = useStore(sortBy);
  const dir = useStore(sortDir);
  const cursorKey = useStore(cursor);
  const openKey = useStore(detailKey);
  const err = useStore(loadError);
  const isLoading = useStore(loading);
  const c = useStore(tally);
  const reviewData = useStore(review);
  const save = useStore(saveState);
  const blockedDrafts = useStore(blocked);
  const facetsOpen = useStore(facetSheetOpen);
  const groupSheet = useStore(groupSheetOpen);
  const sortSheet = useStore(sortSheetOpen);
  const collapsedIds = collapse.useCollapsed();

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
    () => applyFilters(allRows, active, { pressure: sectionPressure, notesById: notes, decisions: dec, edited: editedMuts }),
    [allRows, active, dec, editedMuts, sectionPressure, notes],
  );
  const groups = useMemo(
    () => buildGroups(shown, group, sort, dir),
    [shown, group, sort, dir],
  );
  // Collapsed groups' rows leave the keyboard order too, or j/k would focus
  // rows the collapse has hidden.
  const visibleKeys = useMemo(
    () => groups.flatMap((g) => (collapsedIds.has(g.id) ? [] : g.rows.map((r) => r.key))),
    [groups, collapsedIds],
  );

  // Triage keys that keep working when a chip or header control has focus —
  // everything else defers to the focused control.
  const NAV_KEYS = ["j", "k", "ArrowDown", "ArrowUp", "Escape", "u", "?"];
  const roving = useRovingFocus({
    listRef, keys: visibleKeys, current: cursorKey,
    rowSelector: ".mem-row", navKeys: NAV_KEYS,
    onFocus: (key) => {
      cursor.set(key);
      detailKey.set(key); // mobile: opens the stacked detail; desktop: the pane
    },
  });
  const focusRow = roving.reveal;
  const move = roving.move;

  // Only rows in the current filtered view are actionable from the keyboard —
  // otherwise a/d silently mutate rows the filter has hidden.
  const cursorRow = () => {
    const key = cursor.get();
    if (!key || !visibleKeys.includes(key)) return null;
    return rows.get().find((r) => r.key === key) ?? null;
  };

  const decideAndAdvance = (value: "keep" | "drop") => {
    const row = cursorRow();
    if (!row) return;
    // Pick the neighbor before deciding: the decision may filter this row out.
    const i = visibleKeys.indexOf(row.key);
    const nextKey = visibleKeys[i + 1] ?? visibleKeys[i - 1] ?? null;
    setDecision(row, value);
    if (nextKey) focusRow(nextKey);
    else cursor.set(null);
  };

  const onListKey = (ev: ReactKeyboardEvent<HTMLDivElement>) => {
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
        const key = cursor.get();
        if (key) detailKey.set(key);
        break;
      }
      case "u": ev.preventDefault(); undo(); break;
      case "Escape":
        // Overlays (sheet, peek, stacked detail) are closed by the document-
        // level overlay stack; here Escape only clears the pane/cursor.
        if (detailKey.get() && desktop) { ev.preventDefault(); detailKey.set(null); }
        else if (cursor.get()) { ev.preventDefault(); cursor.set(null); }
        break;
    }
  };

  // The stacked detail participates in the overlay stack (back/Escape close it).
  const stackOpen = !desktop && Boolean(openKey);
  useEffect(() => {
    if (!stackOpen) return;
    return openOverlay(() => { detailKey.set(null); });
  }, [stackOpen]);

  if (err) {
    return <div className="screen"><ErrorState title={t("reviewqueue.pendingReviewDraftsCouldNotLoad")} message={err} /></div>;
  }
  if (isLoading) {
    return <div className="screen"><Loading label={t("reviewqueue.loadingPendingReviewDrafts")} /></div>;
  }

  const total = allRows.length;
  const detailRow = openKey ? allRows.find((r) => r.key === openKey) ?? null : null;
  const showDetailPane = desktop;
  const showDetailStack = !desktop && detailRow;

  return (
    <div className={`audit ${desktop ? "is-desktop" : ""}`}>
      <div className="audit-list" ref={listRef} tabIndex={0} onKeyDown={onListKey}>
        <header className="console">
          <div className="hrow">
            <h1 className="console-title">{t("reviewqueue.reviewQueue")}</h1>
            <span className="t-data mem-save" data-contrast-exempt>
              {save === "saving" ? t("memory.save.autosaving")
                : save === "failed"
                  ? <span className="is-drop">{t("activityview.failed")} <Chip onClick={retryPersist}>{t("activityview.retry")}</Chip></span>
                  : t("memoryvault.saved")}
            </span>
            <IconButton label={t("memory.review.refreshQueue")} onClick={() => void refresh()}><Refresh size={15} stroke={1.75} aria-hidden /></IconButton>
            <IconButton href={backupExportUrl()} download label={t("memory.restorePoint")}>
              <Download size={16} stroke={1.5} aria-hidden />
            </IconButton>
          </div>

          {reviewData && (
            <div className="gen-line t-data" data-contrast-exempt>
              {t("memory.review.generatedAt", { time: new Date(reviewData.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
              {reviewData.counts.deduplications > 0 && <> · {t("memory.review.dedupedUpstream", { count: reviewData.counts.deduplications })}</>}
            </div>
          )}

          {/* decision meter: tally as data, one line */}
          <div className="meter">
            <span className="t-label t-label-s">{t("memory.review.decided")}</span>
            <span className="mbar">
              <span className="m-keep" style={{ width: `${total ? (c.keep / total) * 100 : 0}%` }} />
              <span className="m-drop" style={{ width: `${total ? (c.drop / total) * 100 : 0}%` }} />
            </span>
            <span className="t-data mval">
              <b className="is-keep"><DecisionIcon d="keep" size={12} />{c.keep}</b> · <b className="is-drop"><DecisionIcon d="drop" size={12} />{c.drop}</b>
              <span className="of"> / {total}</span>
            </span>
          </div>

          <div className="chiprail">
            {desktop ? (
              <>
                <Chip pressed={facetsOpen} onClick={openFacetSheet}>
                  {t("ui.facets.title")}{activeFacetCount(active) > 0 && <b className="ar">{activeFacetCount(active)}</b>}
                </Chip>
                <QuickChip facet="status" value={t("memory.undecided")} label={t("memory.undecided")} />
                <QuickChip facet="flags" value={FLAG.restates} label={t("memory.restates")} flag />
                <QuickChip facet="flags" value={FLAG.duplicate} label={t("memory.review.chipDupes")} flag />
                <QuickChip facet="flags" value={FLAG.conflicts} label={t("memoryvault.conflicts")} flag />
                <span className="rail-gap" />
                {Object.entries(GROUPERS).map(([id, g]) => (
                  <Chip key={id} pressed={group === id} onClick={() => { groupBy.set(id as ReturnType<typeof groupBy.get>); }}>
                    {g.label}
                  </Chip>
                ))}
                <span className="rail-gap" />
                {Object.entries(SORTERS).map(([id, s]) => (
                  <Chip key={id} pressed={sort === id} onClick={() => {
                      if (sortBy.get() === id) sortDir.set(sortDir.get() === 1 ? -1 : 1);
                      else { sortBy.set(id as ReturnType<typeof sortBy.get>); sortDir.set(1); }
                    }}>
                    {dir === 1 || sort !== id ? "↓" : "↑"} {s.label}
                  </Chip>
                ))}
              </>
            ) : (
              <>
                <Chip className="ctl" pressed={activeFacetCount(active) > 0} onClick={openFacetSheet}>
                  <span className="ctl-k">{t("memory.review.filter")}</span><span className="ctl-v">{activeFacetCount(active) || t("sourcesworkspace.all")}</span>
                </Chip>
                <Chip className="ctl" onClick={() => { groupSheetOpen.set(true); }}>
                  <span className="ctl-k">{t("memory.review.group")}</span><span className="ctl-v">{GROUPERS[group].label}</span>
                </Chip>
                <Chip className="ctl" onClick={() => { sortSheetOpen.set(true); }}>
                  <span className="ctl-k">{t("memory.review.sort")}</span><span className="ctl-v">{dir === 1 ? "↓" : "↑"} {SORTERS[sort].label}</span>
                </Chip>
                <QuickChip facet="status" value={t("memory.undecided")} label={t("memory.undecided")} />
                <QuickChip facet="flags" value={FLAG.restates} label={t("memory.restates")} flag />
                <QuickChip facet="flags" value={FLAG.duplicate} label={t("memory.review.chipDupes")} flag />
                <QuickChip facet="flags" value={FLAG.conflicts} label={t("memoryvault.conflicts")} flag />
              </>
            )}
          </div>

          {activeFacetCount(active) > 0 && (
            <div className="chiprail">
              <span className="t-data selcount">{t("memory.review.shownOf", { shown: shown.length, total: allRows.length })}</span>
              <Chip onClick={() => bulkDecide(shown, "keep", t("memory.review.keepShown"))}>{t("memory.review.keepShown")}</Chip>
              <Chip onClick={() => bulkDecide(shown, "drop", t("memory.review.dropShown"))}>{t("memory.review.dropShown")}</Chip>
              <Chip onClick={() => bulkDecide(shown, null, t("memory.review.reset"))}>{t("memory.review.reset")}</Chip>
              <Chip onClick={() => { activeFacets.set(new Map()); }}>{t("memoryvault.clearFilters")}</Chip>
            </div>
          )}
        </header>

        <main className="rows mem-rows">
          <Obligations />
          <Failures />
          {shown.length === 0 && allRows.length === 0 && !blockedDrafts.length && (
            // An emptied queue is the reviewer succeeding, so it reads the
            // same way the Sources screen's cleared backlog does.
            <EmptyState tone="ok" icon={<AllClear size={22} stroke={1.75} aria-hidden />} title={t("memory.queueEmpty")} />
          )}
          {shown.length === 0 && allRows.length > 0 && (
            <EmptyState icon={<NoMatches size={22} stroke={1.75} aria-hidden />} title={t("memory.review.noMatch")} />
          )}
          {groups.map((g) => <GroupBlock key={g.id} group={g} showTarget={group !== "target"} onActivate={focusRow} tabbable={roving.tabbable} />)}
          <Rejections />
        </main>
      </div>

      {showDetailPane && (
        <aside className="audit-detail">
          {detailRow
            ? <ClaimDetail key={detailRow.key} row={detailRow} />
            : <EmptyState title={t("memory.review.noClaimOpen")} body={t("memory.review.triageHint")} />}
        </aside>
      )}
      {showDetailStack && (
        <div className="stack-screen">
          <header className="console"><div className="hrow">
            <IconButton className="hit" label={t("memory.backToQueue")} onClick={closeTopOverlay}><Back size={18} stroke={1.75} aria-hidden /></IconButton>
            {/* Queue position, not the target title — the headline right below
                already names the target, and position is what j/k triage wants. */}
            <h1 className="console-title">
              {visibleKeys.includes(detailRow!.key)
                ? t("memory.review.claimPosition", { index: visibleKeys.indexOf(detailRow!.key) + 1, total: visibleKeys.length })
                : detailRow!.targetTitle}
            </h1>
          </div></header>
          <ClaimDetail key={detailRow!.key} row={detailRow!} />
        </div>
      )}

      <FacetSheet />
      <Picker open={groupSheet} label={t("memory.review.groupBy")} current={group}
        options={Object.entries(GROUPERS).map(([id, g]) => ({ id, label: g.label }))}
        onPick={(id) => { groupBy.set(id as ReturnType<typeof groupBy.get>); }}
        onClose={() => { groupSheetOpen.set(false); }} />
      <Picker open={sortSheet} label={t("memoryvault.sortBy")} current={sort}
        onClose={() => { sortSheetOpen.set(false); }}
        options={Object.entries(SORTERS).map(([id, sr]) => ({
          id, label: sr.label,
          hint: sort === id ? (dir === 1 ? "↓ tap to flip" : "↑ tap to flip") : undefined,
        }))}
        onPick={(id) => {
          if (sortBy.get() === id) sortDir.set(sortDir.get() === 1 ? -1 : 1);
          else { sortBy.set(id as ReturnType<typeof sortBy.get>); sortDir.set(1); }
        }} />
      <ApplyDock />
    </div>
  );
}

function openFacetSheet() {
  if (facetSheetOpen.get()) { closeTopOverlay(); return; }
  facetSheetOpen.set(true);
}

/** Called from render, so the map is a parameter: reading the store here would
 *  not subscribe the caller and the count would stop tracking the filters. */
function activeFacetCount(active: Map<string, Set<string>>): number {
  let n = 0;
  for (const set of active.values()) n += set.size;
  return n;
}

function toggleFacet(facetId: string, value: string) {
  const next = new Map(activeFacets.get());
  const set = new Set(next.get(facetId) ?? []);
  set.has(value) ? set.delete(value) : set.add(value);
  next.set(facetId, set);
  activeFacets.set(next);
}

function QuickChip(props: { facet: string; value: string; label: string; flag?: boolean }) {
  const on = useStore(activeFacets).get(props.facet)?.has(props.value) ?? false;
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

/** The review queue's facets, shaped for <FacetDrawer>. Facets are grouped by
 *  provenance: what the console computed, what the model asserted, and what the
 *  reviewer decided. */
function FacetSheet() {
  const open = useStore(facetSheetOpen);
  const allRows = useStore(rows);
  const active = useStore(activeFacets);
  const sectionPressure = useStore(pressure);
  const notes = useStore(notesById);
  const dec = useStore(decisions);
  const editedMuts = useStore(edited);
  const ctx = { pressure: sectionPressure, notesById: notes, decisions: dec, edited: editedMuts };
  if (!open) return null;
  const counts = facetCounts(allRows, active, ctx);
  // A selected value must stay listed even at count 0, or the selection
  // becomes un-clearable and the drawer can render blank.
  for (const [facetId, set] of active) {
    const m = counts.get(facetId);
    if (!m) continue;
    for (const v of set) if (!m.has(v)) m.set(v, 0);
  }
  const label = { computed: t("memory.facetsComputed"), model: t("memory.facetsFromModel"), yours: t("memory.facetsYours") };
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
          on: active.get(f.id)?.has(value) ?? false,
        })),
    })),
  }));
  return (
    <FacetDrawer
      groups={groups}
      onToggle={toggleFacet}
      onClear={() => { activeFacets.set(new Map()); }}
      onClose={() => { facetSheetOpen.set(false); }}
      emptyText={t("memory.review.noFacetValues")}
    />
  );
}


// Group header: one line — identity · aggregates (chars added) · cap flag only
// when real · bar tally · keep-all/drop-all as icon buttons (undecided rows
// only) · kebab for the rare object actions. Object affordances (type icon,
// dot, aggregates, pressure, open-note) exist only when the group key IS an
// object; enum lanes get label + count + tally + bulk and nothing else. At
// narrow width the header wraps to two lines and the aggregates drop
// (priority order, CSS).
function GroupBlock(props: { group: Group; showTarget: boolean; onActivate: (key: string) => void; tabbable: (key: string) => boolean }) {
  const g = props.group;
  const dec = useStore(decisions);
  const notes = useStore(notesById);
  // The collapsed Set is read here, in the component that paints the collapsed
  // state — asking a helper that closed over the store would not subscribe it.
  const collapsed = collapse.useCollapsed().has(g.id);
  const isTarget = useStore(groupBy) === "target";
  const kept = g.rows.filter((r) => dec.get(r.key) === "keep").length;
  const dropped = g.rows.filter((r) => dec.get(r.key) === "drop").length;
  const undecidedRows = g.rows.filter((r) => !dec.get(r.key));
  const isNew = isTarget && !notes.get(g.id) && g.rows.some((r) => r.mutation.kind === "create_note");
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
          <span className="tbar-w" aria-label={t("memory.review.decidedOf", { done: kept + dropped, total: g.rows.length })}>
            <span className="tbar">
              <i className="tk" style={{ width: `${(kept / g.rows.length) * 100}%` }} />
              <i className="td" style={{ width: `${(dropped / g.rows.length) * 100}%` }} />
            </span>
            <span className="tbar-n t-data">{kept + dropped}/{g.rows.length}</span>
          </span>
          {undecidedRows.length > 0 && (
            <span className="ghead-acts">
              <button className="gib gk" title={t("memory.review.keepUndecided", { count: undecidedRows.length })}
                aria-label={t("memory.review.keepAllUndecidedIn", { count: undecidedRows.length, group: g.label })}
                onClick={() => bulkDecide(undecidedRows, "keep", `${t("memory.keep")} ${g.label}`)}>
                <DECISION_ICON.keep size={15} stroke={1.75} aria-hidden />
              </button>
              <button className="gib gd" title={t("memory.review.dropUndecided", { count: undecidedRows.length })}
                aria-label={t("memory.review.dropAllUndecidedIn", { count: undecidedRows.length, group: g.label })}
                onClick={() => bulkDecide(undecidedRows, "drop", `${t("memory.drop")} ${g.label}`)}>
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
 *  decisions. */
function GroupMenu(props: { group: Group; kept: number; dropped: number; isNew: boolean }) {
  const [open, setOpen] = useState(false);
  const g = props.group;
  return (
    <span className="gmenu-wrap">
      <button className="gib gmenu" aria-label={t("memoryvault.moreActionsForValue1", { value1: g.label })} aria-expanded={open}
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
              <button role="menuitem" onClick={() => { setOpen(false); bulkDecide(g.rows, null, `${t("memory.review.reset")} ${g.label}`); }}>
                {t("memory.review.clearDecisions", { count: props.kept + props.dropped })}
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
}

// Row: status icon that cycles on tap · fixed op-icon slot · one-line claim ·
// quiet flags chip (worst severity tints it) · contribution chars. No secondary
// line, no per-row confidence — the enums live in the detail card, their
// exceptions live in the flags.
function ClaimRow(props: {
  row: Row; showTarget: boolean; onActivate: (key: string) => void;
  /** True for the one row that holds the list's tab stop. */
  tabbable: boolean;
}) {
  const r = props.row;
  const d = useStore(decisions).get(r.key);
  const editedMuts = useStore(edited);
  const pfState = useStore(preflightRowState);
  const isAuto = pfState.auto.has(r.key) && d !== "keep";
  const blockedMsg = d === "keep" ? pfState.blockedRows.get(r.key) : undefined;
  const isFocused = useStore(cursor) === r.key;
  const isOpen = useStore(detailKey) === r.key;
  const sectionPressure = useStore(pressure);
  const notes = useStore(notesById);
  const flags = flagsOf(r, { pressure: sectionPressure, notesById: notes });
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
          aria-label={t("memory.review.decisionCycle", { decision: d ?? t("memory.undecided") })}
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
              {isNew && <span className="ndot" aria-label={t("memory.review.willBeCreated")} />}
              {r.targetTitle}
            </span>
          )}
          <span className="claim-text t-prose">{r.text}</span>
          <span className="row-trail t-data">
            {editedMuts.has(r.key) && (
              <Term tip={t("memory.editedTip")}>
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
  const sectionPressure = useStore(pressure);
  if (!props.isTarget) return null;
  let worst: { key: string; current: number; projected: number } | null = null;
  for (const [, p] of sectionPressure) {
    if (p.noteId !== props.groupId) continue;
    if (!worst || p.projected > worst.projected) worst = p;
  }
  if (!worst || worst.projected < CAP * 0.8) return null;
  const over = worst.projected > CAP;
  const pct = capPercent(worst.projected);
  return (
    <span className="fq gcap" data-sev={over ? "danger" : "warn"}
      title={t("memory.review.capTitle", { key: worst.key, stored: worst.current.toLocaleString(), projected: worst.projected.toLocaleString(), cap: CAP.toLocaleString() })}>
      <Flag size={12} stroke={1.75} aria-hidden /><span className="gcap-pct">{t("memory.review.capPct", { pct })}</span>
    </span>
  );
}

function Obligations() {
  const [extracting, setExtracting] = useState<string | null>(null); // "2/5" while running
  const blockedDrafts = useStore(blocked);
  if (!blockedDrafts.length) return null;
  const byCode = new Map<string, { message: string; items: BlockedDraft[] }>();
  for (const b of blockedDrafts) {
    for (const reason of b.reasons) {
      let bucket = byCode.get(reason.code);
      if (!bucket) byCode.set(reason.code, (bucket = { message: reason.message, items: [] }));
      bucket.items.push(b);
    }
  }
  const reextract = async (items: BlockedDraft[]) => {
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
          <div className="t-data">
            <span className="fl">{code.replaceAll("_", " ")}</span>{" "}
            <Copy k="memory.review.blockedDrafts" params={{ count: items.length }} slots={{ n: <b>{items.length}</b> }} />
            {" · "}
            <Copy k="memory.review.claimsHeld"
              params={{ count: items.reduce((n, b) => n + b.mutationCount, 0) }}
              slots={{ n: <b>{items.reduce((n, b) => n + b.mutationCount, 0)}</b> }} />
          </div>
          <p className="t-prose dim">{message}</p>
          <div className="blocked-srcs">
            {items.map((b) => (
              <span key={b.draftId} className="t-data blocked-src">
                <NoteRef id={b.sourceNoteId} label={b.sourceTitle} /> <span className="dim">· {t("memory.review.claimCount", { count: b.mutationCount })}</span>
              </span>
            ))}
          </div>
          {["source_stale", "source_context_unbound"].includes(code) && (
            <>
              <Chip disabled={Boolean(extracting)} onClick={() => void reextract(items)}>
                {extracting ? t("memory.review.extractingProgress", { progress: extracting }) : t("memoryvault.extractToReview")}
              </Chip>
              <p className="t-prose dim reex-note">{t("memory.review.reextractNote")}</p>
            </>
          )}
        </div>
      ))}
    </>
  );
}

function Failures() {
  const failures = useStore(lastFailures);
  if (!failures.length) return null;
  return (
    <>
      {failures.map((f) => (
        <div key={f.title} className="mem-card is-danger">
          <div className="t-data"><span className="fl">{t("memory.error.applyFailed")}</span> <b>{f.n}</b> · {f.title}</div>
          <p className="t-prose dim">{f.fix}</p>
          <details><summary className="t-data dim">{t("memory.review.rawSummary")}</summary><p className="t-data dim">{f.msg.slice(0, 400)}</p></details>
        </div>
      ))}
      <div className="group-actions"><Chip onClick={() => { lastFailures.set([]); }}>{t("shell.toast.dismiss")}</Chip></div>
    </>
  );
}

function Rejections() {
  const list = useStore(rejections);
  if (!list.length) return null;
  const byReason = new Map<string, Rejection[]>();
  for (const item of list) {
    byReason.set(item.reason, [...(byReason.get(item.reason) ?? []), item]);
  }
  return (
    <div className="mem-rejections">
      <div className="mem-ghead is-plain"><span className="gn t-prose">{t("reviewqueue.suggestionsThatWerentSaved")}</span>
        <span className="t-data dim">{list.length}</span></div>
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
  const c = useStore(tally);
  const undoable = useStore(canUndo);
  const pf = useStore(preflight);
  const checking = useStore(preflightPending);
  const progress = useStore(applyProgress);
  const warnings = useStore(droppedDependencyWarnings);
  const ready = useStore(readyToSend);
  const allRows = useStore(rows);
  const pfState = useStore(preflightRowState);
  const isApplying = useStore(applying);
  // Stays mounted while undo is available so touch users can undo a bulk
  // reset (the keyboard has `u`; the dock is the only touch path).
  if (!c.keep && !c.drop && !undoable) return null;
  // ready-after-drops, not the raw engine count, or a dropped dependency
  // preflight auto-included is counted twice (store.ts readyToSend)
  const applyCount = ready + c.drop;
  const offerRestore = c.keep + c.drop >= RESTORE_POINT_THRESHOLD;
  const rowByKey = new Map(allRows.map((row) => [row.key, row]));
  const autoRows = [...pfState.auto.keys()].map((k) => rowByKey.get(k)).filter(Boolean) as Row[];
  const blockedRows = [...pfState.blockedRows.entries()]
    .map(([k, why]) => ({ row: rowByKey.get(k), why }))
    .filter((x) => x.row) as Array<{ row: Row; why: string }>;
  return (
    <div className="apply-dock">
      <div className="dock-info t-data">
        <b className="is-keep">{c.keep}</b> {t("memory.keep")} · <b className="is-drop">{c.drop}</b> {t("memory.drop")}
        {c.undecided > 0 && <span className="dim"> · {c.undecided} {t("memory.undecided")}</span>}
        {c.edited > 0 && <span> · {t("memory.dock.editedCount", { count: c.edited })}</span>}
        <br />
        <span className="dim">
          {progress ? t("memory.apply.progressDraft", { done: progress.done, total: progress.total }) : <>
            {t("memory.draftsWillApply", { count: c.willSend })}
            {c.stayPending > 0 && <>{" "}{t("memory.dock.stayPending", { count: c.stayPending })}</>}
            {pf?.error
              ? <span className="is-drop"> · {pf.error} <Chip onClick={() => void refresh()}>{t("activityview.retry")}</Chip></span>
              : checking
                ? <> · {t("memory.dock.checking")}</>
                : pf
                  ? <> · {t("memory.dock.ready", { count: ready })}{pf.blockedN ? <span className="is-drop"> · {t("memory.dock.blocked", { count: pf.blockedN })}</span> : null}</>
                  : null}
          </>}
        </span>
        {!checking && autoRows.length > 0 && (
          <details className="dock-detail"><summary>{t("memory.autoIncluded", { count: autoRows.length })}</summary>
            {autoRows.map((row) => <div key={row.key} className="dim dock-detail-row">→ {row.targetTitle}: {row.text.slice(0, 80)}</div>)}
          </details>
        )}
        {!checking && blockedRows.length > 0 && (
          <details className="dock-detail is-drop"><summary>{t("memory.dock.blockedHeld", { count: blockedRows.length })}</summary>
            {blockedRows.map(({ row, why }) => <div key={row.key} className="dim dock-detail-row">→ {row.targetTitle}: {why}</div>)}
          </details>
        )}
        {/* The whole sentence branches on count, not just the noun — the verb
            and the pronouns have to agree too. */}
        {warnings.length > 0 && (
          <div className="is-drop">{t("memory.dock.droppedDependency", { count: warnings.length })}</div>
        )}
        {offerRestore && <><br /><a className="t-data restore-link" href={backupExportUrl()} download onClick={() => toast(t("memory.restorePointDone"))}>{t("memory.restorePoint")}</a></>}
      </div>
      <Chip disabled={!undoable} onClick={undo}>{t("memoryvault.undo")}</Chip>
      <button className="dock-primary t-label" disabled={isApplying || checking || (c.keep > 0 && !pf) || Boolean(pf?.error)} onClick={() => void applyDecided()}>
        {isApplying ? (progress ? t("memory.apply.progress", { done: progress.done, total: progress.total }) : t("memory.applying"))
          : checking ? t("memory.apply.buttonChecking")
          : t("memory.apply.button", { count: applyCount })}
      </button>
    </div>
  );
}
