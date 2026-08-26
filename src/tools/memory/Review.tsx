// Review Queue — the curation loop's triage surface.
//
// Console header (tally meter, quick chips, facet sheet) · audit rows grouped
// by target memory · tri-state decision rail · master-detail on desktop,
// stacked detail on mobile · apply dock. Keyboard: j/k move, a/d keep/drop,
// x undecide, space cycle, Enter opens, u undo (DESIGN.md §3, §6 triage).

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { toast } from "../../shell/toast";
import type { BlockedDraft, Rejection, Row } from "./model/review";
import { t } from "../../copy";
import { Copy } from "./Copy";
import { bulkDecide, canUndo, cycleDecision, decisions, edited, retryPersist, saveState, setDecision, undo } from "./store/decisions";
import { blocked, loadError, loading, refresh, rejections, review, rows } from "./store/review";
import { notesById, reextractSource } from "./store/notes";
import { backupExportUrl } from "./store/backup";
import { activeFacets, cursor, detailKey, dockSheetOpen, facetSheetOpen, groupBy, sortBy, sortDir, viewSheetOpen } from "./store/view";
import { preflight, preflightPending, preflightRowState } from "./store/preflight";
import { droppedDependencyWarnings, readyToSend, tally } from "./store/tally";
import { applyDecided, applying, applyProgress, lastFailures } from "./store/apply";
import { pressure } from "./store/pressure";
import { SECTION_CAP as CAP } from "./model/caps";
import { capPercent } from "./model/pressure";
import { openOverlay, closeTopOverlay } from "../../shell/overlays";
import { Flag, AllClear, NoMatches, DECISION_ICON, More, EditedMark, Back, Refresh, Download, Undo, Filter, ClearFilters, GroupBy, SortDown, SortUp, Remove, ChevronUp, ICON_SIZE } from "../../ui/icons";
import { DecisionIcon, GroupIcon, OpIcon, TypeIcon } from "./icons";
import { Term, OP_TIP } from "./glossary";
import { flagsOf, worstSeverity, contributionChars, FLAG } from "./model/flags";
import { ANY_FLAG, FACETS, GROUPERS, SORTERS, applyFilters, facetCounts, buildGroups, type Group } from "./model/facets";
import { FilterSheet, type SheetFacet } from "./review/FilterSheet";
import { ViewSheet } from "./review/ViewSheet";
import { DockSheet } from "./review/DockSheet";
import { ClaimDetail } from "./ClaimDetail";
import { NoteRef, peekNote } from "./components/NoteRef";
import { Button, Chip, collapsedGroups, EmptyState, ErrorState, ListGroup, Loading, MiddleTruncate, useIsDesktop, useRovingFocus } from "../../ui";
import { useStore } from "../../lib/store";

const RESTORE_POINT_THRESHOLD = 20;

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
        {/* Desktop keeps the full console — title, generation line, meter, and
            the flat chip rail. The phone gets the arrangement rail instead:
            everything above the first claim there is a tax on the ~11 rows
            §2 asks for, and the meter's keep/drop was the dock's keep/drop
            said a second time (CHECKLIST §3). The dock is the phone's status
            surface now, so it stays mounted and carries the tally. */}
        <header className="console">
          {desktop ? (
            <>
              <div className="hrow">
                <h1 className="console-title">{t("reviewqueue.reviewQueue")}</h1>
                <span className="t-data mem-save">
                  {save === "saving" ? t("memory.save.autosaving")
                    : save === "failed"
                      ? <span className="is-drop">{t("activityview.failed")} <Chip onClick={retryPersist}>{t("activityview.retry")}</Chip></span>
                      : t("memoryvault.saved")}
                </span>
                <Button iconOnly label={t("memory.review.refreshQueue")} onClick={() => void refresh()}
                  icon={<Refresh size={15} stroke={1.75} aria-hidden />} />
                <Button iconOnly href={backupExportUrl()} download label={t("memory.restorePoint")}
                  icon={<Download size={16} stroke={1.5} aria-hidden />} />
              </div>

              {reviewData && (
                <div className="gen-line t-data">
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
            </>
          ) : (
            <ArrangeRail active={active} group={group} sort={sort} dir={dir} shown={shown.length} total={total} />
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
            <Button iconOnly className="hit" label={t("memory.backToQueue")} onClick={closeTopOverlay}
              icon={<Back size={18} stroke={1.75} aria-hidden />} />
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
      <ViewSheetHost />
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

/** The phone's one row of chrome: filter, and the two arrangement values.
 *
 *  Filter is a glyph and a count because its value is "how narrowed am I",
 *  which a number answers; group and sort are glyph + word because theirs is
 *  a choice among names, and a name has to be read. The two arrangement
 *  buttons share the remaining width so the row scans as columns.
 *
 *  Active filters land in a track under it, each removable where it is shown —
 *  DESIGN.md §4 asks for exactly that, and it is the only path back out of a
 *  filter that a phone has once the sheet is dismissed. */
function ArrangeRail(props: {
  active: Map<string, Set<string>>;
  group: string;
  sort: string;
  dir: 1 | -1;
  shown: number;
  total: number;
}) {
  const n = activeFacetCount(props.active);
  const SortGlyph = props.dir === 1 ? SortDown : SortUp;
  return (
    <>
      <div className="qrail">
        <button
          type="button"
          className={`qbtn qbtn-f ${n ? "is-on" : ""}`}
          aria-label={t("memory.review.filter")}
          aria-pressed={n > 0}
          onClick={openFacetSheet}
        >
          <Filter size={ICON_SIZE.lg} stroke={1.75} aria-hidden />
          {n > 0 && <span className="t-data qn">{n}</span>}
        </button>
        <button
          type="button"
          className={`qbtn ${props.group === "none" ? "" : "is-on"}`}
          aria-label={t("memory.review.groupBy")}
          onClick={() => { viewSheetOpen.set(true); }}
        >
          <GroupBy size={ICON_SIZE.lg} stroke={1.75} aria-hidden />
          <span className="t-data qv">{GROUPERS[props.group].label}</span>
        </button>
        <button
          type="button"
          className="qbtn"
          aria-label={t("memoryvault.sortBy")}
          onClick={() => { viewSheetOpen.set(true); }}
        >
          <SortGlyph size={ICON_SIZE.lg} stroke={1.75} aria-hidden />
          <span className="t-data qv">{SORTERS[props.sort].label}</span>
        </button>
      </div>

      {n > 0 && (
        <div className="ftrack">
          <span className="t-data ftrack-n">
            {t("memory.review.shownOf", { shown: props.shown, total: props.total })}
          </span>
          {[...props.active.entries()].flatMap(([facetId, set]) =>
            [...set].map((value) => (
              <button
                key={`${facetId}:${value}`}
                type="button"
                className="fpill"
                aria-label={t("pill.removeValue1", { value1: chipLabel(facetId, value) })}
                onClick={() => toggleFacet(facetId, value)}
              >
                <span className="t-data">{chipLabel(facetId, value)}</span>
                <Remove size={10} stroke={2} aria-hidden />
              </button>
            )),
          )}
          <button
            type="button"
            className="fclear"
            aria-label={t("memoryvault.clearFilters")}
            onClick={() => { activeFacets.set(new Map()); }}
          >
            <ClearFilters size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}

/** What a filter chip says. The value alone, except for the yes/no facet whose
 *  value is the bare word "any" — meaningless without the thing it is any of. */
function chipLabel(facetId: string, value: string): string {
  if (facetId === "anyFlag") return t("memory.review.anyFlag");
  return facetId === "source" ? sourceFacetLabel(value) : value;
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

/** Builds the filter sheet's model from the stores and hands it over. The
 *  sheet is presentation; every count here is computed against the live rows,
 *  and a store read inside the sheet would not subscribe it. */
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
  // becomes un-clearable and the sheet can render blank.
  for (const [facetId, set] of active) {
    const m = counts.get(facetId);
    if (!m) continue;
    for (const v of set) if (!m.has(v)) m.set(v, 0);
  }

  const facets = new Map<string, SheetFacet>();
  for (const f of FACETS) {
    const values = [...(counts.get(f.id) ?? new Map()).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({
        value,
        // Source titles arrive as "Lorebook - <book>: <entry>". Four rows
        // reading "Lorebook - Ashgate — …" name nothing, so the row shows the
        // entry; the whole title is what gets filtered on.
        //
        // Enum values are snake_case on the wire. `append_section` is a key,
        // not a phrase, and a tile narrow enough to hold it breaks it across
        // the underscore — the same de-snaking GROUPERS already does.
        label: f.id === "source" ? sourceFacetLabel(value) : value.replaceAll("_", " "),
        count,
        on: active.get(f.id)?.has(value) ?? false,
      }));
    facets.set(f.id, { id: f.id, label: f.label, values, selected: values.filter((v) => v.on).length });
  }

  const shown = applyFilters(allRows, active, ctx);
  return (
    <FilterSheet
      model={{
        facets,
        anyFlagCount: counts.get("anyFlag")?.get(ANY_FLAG) ?? 0,
        anyFlagOn: active.get("anyFlag")?.has(ANY_FLAG) ?? false,
        shown: shown.length,
        total: allRows.length,
        activeCount: activeFacetCount(active),
      }}
      onToggle={toggleFacet}
      onToggleAnyFlag={toggleAnyFlag}
      onClear={() => { activeFacets.set(new Map()); }}
      onClose={() => { facetSheetOpen.set(false); }}
    />
  );
}

/** "Any flag" and the named flags are one question at two resolutions, so
 *  turning either on clears the other. Leaving both live would let the sheet
 *  show a narrowed flag list under a control claiming to accept all of them. */
function toggleAnyFlag() {
  const next = new Map(activeFacets.get());
  const wasOn = next.get("anyFlag")?.has(ANY_FLAG) ?? false;
  const hadNamed = (next.get("flags")?.size ?? 0) > 0;
  next.delete("flags");
  next.delete("anyFlag");
  // Named flags collapse UP to "any" rather than off: the press asked to
  // widen, and widening from three flags to none is not what was asked.
  if (!wasOn || hadNamed) next.set("anyFlag", new Set([ANY_FLAG]));
  activeFacets.set(next);
}

function ViewSheetHost() {
  const open = useStore(viewSheetOpen);
  const group = useStore(groupBy);
  const sort = useStore(sortBy);
  const dir = useStore(sortDir);
  const allRows = useStore(rows);
  const active = useStore(activeFacets);
  const sectionPressure = useStore(pressure);
  const notes = useStore(notesById);
  const dec = useStore(decisions);
  const editedMuts = useStore(edited);
  if (!open) return null;
  const shown = applyFilters(allRows, active, { pressure: sectionPressure, notesById: notes, decisions: dec, edited: editedMuts });
  return (
    <ViewSheet
      groupers={Object.entries(GROUPERS).map(([id, g]) => ({
        id,
        label: g.label,
        // How many lanes this grouper would produce over what is actually
        // shown — a fact about the choice, so it is measured, not guessed.
        // "nothing" makes one lane by definition and states no number.
        count: id === "none" ? undefined : new Set(shown.map((r) => g.key(r).id)).size,
      }))}
      sorters={Object.entries(SORTERS).map(([id, s]) => ({ id, label: s.label }))}
      group={group}
      sort={sort}
      dir={dir}
      onGroup={(id) => { groupBy.set(id as ReturnType<typeof groupBy.get>); }}
      onSort={(id) => {
        if (sortBy.get() === id) sortDir.set(sortDir.get() === 1 ? -1 : 1);
        else { sortBy.set(id as ReturnType<typeof sortBy.get>); sortDir.set(1); }
      }}
      onClose={() => { viewSheetOpen.set(false); }}
    />
  );
}


// Group header: one line — identity · aggregates (chars added) · cap flag only
// when real · bar tally · keep-all/drop-all as icon buttons (undecided rows
// only) · kebab for the rare object actions. The glyph comes from the grouper.
// The title elides its MIDDLE, because every lorebook entry from one book
// shares a long prefix and only the end tells them apart.
function GroupBlock(props: { group: Group; showTarget: boolean; onActivate: (key: string) => void; tabbable: (key: string) => boolean }) {
  const g = props.group;
  const dec = useStore(decisions);
  const notes = useStore(notesById);
  // The collapsed Set is read here, in the component that paints the collapsed
  // state — asking a helper that closed over the store would not subscribe it.
  const collapsed = collapse.useCollapsed().has(g.id);
  const grouping = useStore(groupBy);
  // Object affordances exist only when the group key is an object.
  const isTarget = grouping === "target";
  const isSource = grouping === "source";
  const kept = g.rows.filter((r) => dec.get(r.key) === "keep").length;
  const dropped = g.rows.filter((r) => dec.get(r.key) === "drop").length;
  const undecidedRows = g.rows.filter((r) => !dec.get(r.key));
  const isNew = isTarget && !notes.get(g.id) && g.rows.some((r) => r.mutation.kind === "create_note");
  const chars = isTarget ? g.rows.reduce((n, r) => n + contributionChars(r), 0) : 0;
  return (
    /* Same grid as the rows: chevron in the rail (the control column gets a
       control), the grouper's glyph in the kind column, words in the body. The
       new-target marker is the 2a green edge (owner call, color-only tradeoff
       accepted) — an edge, so nothing in the title line shifts. */
    <ListGroup className={`mem-ghead ${isNew ? "is-new" : ""}`}
        collapsed={collapsed} onToggle={() => collapse.toggle(g.id)}
        label={g.label} count={g.rows.length}
        head={<>
        {g.icon && <GroupIcon icon={g.icon} />}
        <div className="ghead-body">
        <MiddleTruncate className="gn t-prose" text={g.label} />
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
          {(isTarget || isSource) && (
            <GroupMenu group={g} kept={kept} dropped={dropped} isNew={isNew}
              openLabel={isSource ? t("reviewqueue.openSource") : t("reviewqueue.openMemory")} />
          )}
        </span>
        </div>
      </>}>
      {g.rows.map((r) => <ClaimRow key={r.key} row={r} showTarget={props.showTarget} onActivate={props.onActivate} tabbable={props.tabbable(r.key)} />)}
    </ListGroup>
  );
}

/** The kebab: open the note the group is keyed on, or clear its decisions.
 *  `openLabel` names which note that is. */
function GroupMenu(props: { group: Group; kept: number; dropped: number; isNew: boolean; openLabel: string }) {
  const [open, setOpen] = useState(false);
  const g = props.group;
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
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
              <button role="menuitem" onClick={() => { setOpen(false); peekNote(g.id); }}>{props.openLabel}</button>
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
            {isAuto && <span className="dep-tag">{t("reviewqueue.dependency")}</span>}
            {blockedMsg && <span className="is-drop" title={blockedMsg}>{t("memory.sourcesBlocked")}</span>}
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
      try { await reextractSource(items[i].sourceNoteId); } catch (error) { toast((error as Error).message, { kind: "error" }); }
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
  const desktop = useIsDesktop();
  const save = useStore(saveState);
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
  const dockSheet = useStore(dockSheetOpen);
  const dec = useStore(decisions);
  const decided = c.keep + c.drop;
  // On desktop the dock is purely the apply surface, and stays mounted while
  // undo is available so touch users can undo a bulk reset (the keyboard has
  // `u`; the dock is the only touch path).
  //
  // On the phone it is also the status surface — the header no longer carries
  // the tally or the save state, so the dock cannot come and go with them.
  if (desktop && !decided && !undoable) return null;
  // ready-after-drops, not the raw engine count, or a dropped dependency
  // preflight auto-included is counted twice (store/tally.ts readyToSend)
  const applyCount = ready + c.drop;
  const offerRestore = c.keep + c.drop >= RESTORE_POINT_THRESHOLD;
  const rowByKey = new Map(allRows.map((row) => [row.key, row]));
  // Preflight is sent only the keeps, so everything it marks auto-included is
  // something the reviewer did not ask for — but the two halves have opposite
  // outcomes. An undecided one is written; one the reviewer dropped is stripped
  // again before sending (model/tally.ts countReadyToSend). Reported together
  // they claimed a row would be applied that will not be, and the send count
  // stopped reconciling with them (CHECKLIST §3).
  const pulledIn = [...pfState.auto.keys()].map((k) => rowByKey.get(k)).filter(Boolean) as Row[];
  const autoRows = pulledIn.filter((r) => dec.get(r.key) !== "drop");
  const droppedRequiredRows = pulledIn.filter((r) => dec.get(r.key) === "drop");
  const blockedRows = [...pfState.blockedRows.entries()]
    .map(([k, why]) => ({ row: rowByKey.get(k), why }))
    .filter((x) => x.row) as Array<{ row: Row; why: string }>;
  const total = c.keep + c.drop + c.undecided;
  // What the sheet has to say that the reviewer did not ask for. The badge
  // counts these, not the rows inside them: it is a "there is something here"
  // marker, and the sheet does the accounting.
  const exceptions =
    (checking ? 0 : autoRows.length + droppedRequiredRows.length + blockedRows.length) + warnings.length;
  return (
    <>
      {/* Rendered OUTSIDE .apply-dock, not inside it. The dock sets
          `backdrop-filter`, which makes it a containing block for fixed
          descendants — the sheet's full-viewport scrim was being clipped to
          the dock's own height, so a tap anywhere above it missed and the
          sheet would not close. */}
      {dockSheet && (
        <DockSheet
          model={{
            undecided: c.undecided, edited: c.edited,
            stayPending: c.stayPending,
            // Zero when nothing is decided, because zero is then the true
            // answer — not the null that means "the engine has not said yet".
            // Reading `ready === null` as "checking" left the sheet claiming
            // it was checking with the engine on an untouched queue, which
            // preflight never does.
            ready: pf ? ready : (decided ? null : 0),
            auto: checking ? [] : autoRows,
            droppedRequired: checking ? [] : droppedRequiredRows,
            held: checking ? [] : blockedRows,
            warnings: warnings.length,
            offerRestore,
          }}
          onRestore={() => toast(t("memory.restorePointDone"))}
          onClose={() => { dockSheetOpen.set(false); }}
        />
      )}
      <div className="apply-dock">
      {/* The phone's status row. Three counts and their total, each glyphed so
          the state is not carried by colour alone, plus the save pill and the
          two controls the cut header used to hold. */}
      {!desktop && (
        <div className="dock-tally">
          {/* The tally is the affordance: tap the numbers to get the numbers
              explained. An exception count rides on it so the surprises in
              the apply path advertise themselves before the sheet is opened
              — hidden by default is fine, hidden and silent is not. */}
          <button type="button" className="t-data dock-counts" aria-label={t("memory.dock.detailTitle")} onClick={() => { dockSheetOpen.set(true); }}>
            <b className="is-keep"><DecisionIcon d="keep" size={14} />{c.keep}</b>
            <b className="is-drop"><DecisionIcon d="drop" size={14} />{c.drop}</b>
            <b className="dim"><DecisionIcon d={null} size={14} />{c.undecided}</b>
            <span className="dim of">/ {total}</span>
            {exceptions > 0 && (
              <span className="dock-exc"><Flag size={12} stroke={2} aria-hidden />{exceptions}</span>
            )}
            <ChevronUp size={13} stroke={1.75} aria-hidden />
          </button>
          <span className="t-data mem-save">
            {save === "saving" ? t("memory.save.autosaving")
              : save === "failed"
                ? <span className="is-drop">{t("activityview.failed")} <Chip onClick={retryPersist}>{t("activityview.retry")}</Chip></span>
                : t("memoryvault.saved")}
          </span>
          <Button iconOnly label={t("memory.review.refreshQueue")} onClick={() => void refresh()}
            icon={<Refresh size={15} stroke={1.75} aria-hidden />} />
          {/* An icon, not the desktop's labelled chip: it sits in a row of
              44px controls, and a 34px chip beside them was the one
              mismatched height in the dock. */}
          <Button iconOnly label={t("memoryvault.undo")} disabled={!undoable} onClick={undo}
            icon={<Undo size={16} stroke={1.75} aria-hidden />} />
          {/* The short label is the phone's, not a whim: the labelled form
              plus the counts overruns the row at 390px, and the value that
              must never truncate is the primary action's own name. The
              checking state has to come from the SAME pair — falling back to
              the long one made the button grow and flash the other wording on
              every decision. */}
          <button className="dock-primary t-label" disabled={!decided || isApplying || checking || (c.keep > 0 && !pf) || Boolean(pf?.error)} onClick={() => void applyDecided()}>
            {isApplying ? (progress ? t("memory.apply.progress", { done: progress.done, total: progress.total }) : t("memory.applying"))
              : checking ? t("memory.apply.buttonShortChecking")
              : t("memory.apply.buttonShort", { count: applyCount })}
          </button>
        </div>
      )}
      {/* What survives in the dock: progress while applying, and anything
          BLOCKING. A preflight error stops the apply, so it stays at the
          cause rather than behind a tap (DESIGN.md §4). Every other figure and
          list moved into the tally's sheet, which has room to name the units
          and render a claim as a claim. */}
      {(progress || pf?.error) && (
        <div className="dock-info t-data">
          {progress
            ? <span className="dim">{t("memory.apply.progressDraft", { done: progress.done, total: progress.total })}</span>
            : <span className="is-drop">{pf!.error} <Chip onClick={() => void refresh()}>{t("activityview.retry")}</Chip></span>}
        </div>
      )}
      {/* Desktop keeps its labelled controls, and gets the same tally button
          — the figures it used to spell out inline live in the same sheet. */}
      {desktop && (
        <button type="button" className="t-data dock-counts" aria-label={t("memory.dock.detailTitle")} onClick={() => { dockSheetOpen.set(true); }}>
          <b className="is-keep"><DecisionIcon d="keep" size={14} />{c.keep}</b>
          <b className="is-drop"><DecisionIcon d="drop" size={14} />{c.drop}</b>
          <b className="dim"><DecisionIcon d={null} size={14} />{c.undecided}</b>
          <span className="dim of">/ {total}</span>
          {exceptions > 0 && (
            <span className="dock-exc"><Flag size={12} stroke={2} aria-hidden />{exceptions}</span>
          )}
          <ChevronUp size={13} stroke={1.75} aria-hidden />
        </button>
      )}
      {desktop && <Chip disabled={!undoable} onClick={undo}>{t("memoryvault.undo")}</Chip>}
      {desktop && (
        <button className="dock-primary t-label" disabled={!decided || isApplying || checking || (c.keep > 0 && !pf) || Boolean(pf?.error)} onClick={() => void applyDecided()}>
          {isApplying ? (progress ? t("memory.apply.progress", { done: progress.done, total: progress.total }) : t("memory.applying"))
            : checking ? t("memory.apply.buttonChecking")
            : t("memory.apply.button", { count: applyCount })}
        </button>
      )}

      {/* The meter the header used to carry, as the dock's own bottom edge:
          the same keep/drop proportion, stated once now instead of twice. */}
      {!desktop && (
        <span className="dock-bar" aria-hidden="true">
          <span className="m-keep" style={{ width: `${total ? (c.keep / total) * 100 : 0}%` }} />
          <span className="m-drop" style={{ width: `${total ? (c.drop / total) * 100 : 0}%` }} />
        </span>
      )}
      </div>
    </>
  );
}
