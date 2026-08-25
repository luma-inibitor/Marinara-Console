// The review queue's filter surface.
//
// Three levels of prominence, in the order a reviewer reaches for them:
//
//   the exception     "has quality flags" as one toggle, with a drill-in to
//                     the named flags. Asking "is anything wrong with this
//                     claim" is one press; asking "which wrongness" is two.
//   the taxonomies    memory type and decision as tiles — short, fixed,
//                     icon-bearing lists that are worth the vertical space.
//   the long tail     sources behind their own search (the list is as long as
//                     the vault), and the four model enums behind a
//                     disclosure (DESIGN.md §4: 3-5 inline, rest behind it).
//
// This replaces the provenance grouping the facet drawer used — computed /
// from the model / yours. That grouping answered "who asserted this", which is
// a question about trust, and the reviewer arriving here has a question about
// narrowing. Provenance still decides *authority* and survives where it is
// load-bearing: the flag facets are the console's own and stay visually apart
// from the model's enums by sitting in a different level, not a labeled block.

import { useState } from "react";
import { t } from "../../../copy";
import { Sheet, SheetHead } from "../../../ui/Sheet";
import { closeTopOverlay } from "../../../shell/overlays";
import { SearchBar } from "../../../ui/SearchBar";
import { Back, ChevronRight, ChevronDown, Confirm, Flag, ICON_SIZE } from "../../../ui/icons";
import { TypeIcon, DecisionIcon } from "../icons";
import "./FilterSheet.css";

interface SheetValue { value: string; label: string; count: number; on: boolean }
export interface SheetFacet { id: string; label: string; values: SheetValue[]; selected: number }

/** Everything the sheet renders, computed by the caller — it is the screen
 *  that holds the stores, and a facet count read here would not subscribe. */
interface FilterSheetModel {
  facets: Map<string, SheetFacet>;
  /** Rows carrying at least one flag, counted as if no flag filter applied. */
  anyFlagCount: number;
  anyFlagOn: boolean;
  shown: number;
  total: number;
  activeCount: number;
}

export function FilterSheet(props: {
  model: FilterSheetModel;
  onToggle: (facetId: string, value: string) => void;
  /** Turning "any flag" on drops the named-flag selection, and vice versa —
   *  the two are one question asked at two resolutions. */
  onToggleAnyFlag: () => void;
  onClear: () => void;
  /** Clears whatever renders this sheet. Runs on scrim, Escape and back —
   *  the dismiss buttons pop the overlay stack instead, so all four paths
   *  arrive here through the same entry. */
  onClose: () => void;
}) {
  const [view, setView] = useState<"main" | "flags" | "source">("main");
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState("");
  const m = props.model;

  const facet = (id: string): SheetFacet =>
    m.facets.get(id) ?? { id, label: "", values: [], selected: 0 };
  const flags = facet("flags");
  const sources = facet("source");

  const back = () => { setView("main"); setQuery(""); };
  const title = view === "flags" ? flags.label
    : view === "source" ? t("reviewqueue.sources")
      : t("memory.review.filter");

  return (
    <Sheet label={t("memory.review.filter")} onClose={props.onClose} className="filter-sheet">
      {/* Back leads the row — it is the way out of this screen, and a way out
          that sits after the title has to be hunted for. */}
      <SheetHead
        title={<span className="t-label t-label-s">{title}</span>}
        icon={view !== "main" ? (
          <button type="button" className="fs-back t-label t-label-s" onClick={back}>
            <Back size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
            {t("memory.review.filter")}
          </button>
        ) : undefined}
      >
        <span className="fs-meta t-data">
          {m.activeCount ? t("memory.review.activeCount", { count: m.activeCount }) : t("memory.review.noneActive")}
        </span>
        {view === "main" && m.activeCount > 0 && (
          <button type="button" className="fs-clear t-label t-label-s" onClick={props.onClear}>
            {t("sourceoperation.clearAll")}
          </button>
        )}
      </SheetHead>

      <div className="fs-body">
        {view === "main" && (
          <>
            {/* The exception filter. The row toggles "any flag"; the count on
                its right edge drills into the named ones. Two targets, so the
                coarse answer never costs a round trip through a sub-screen. */}
            <div className={`fs-any ${m.anyFlagOn || flags.selected ? "is-on" : ""}`}>
              <button type="button" className="fs-any-t" aria-pressed={m.anyFlagOn} onClick={props.onToggleAnyFlag}>
                <Box on={m.anyFlagOn} partial={flags.selected > 0} flag />
                <span className="fs-any-i"><Flag size={ICON_SIZE.sm} stroke={1.75} aria-hidden /></span>
                <span className="t-label t-label-s fs-any-l">{t("memory.review.anyFlag")}</span>
                <span className="fs-sum t-data">{flags.selected ? selectedSummary(flags) : ""}</span>
                {/* Claims carrying a flag — what this toggle would keep. The
                    drill-in's number counts FLAGS, not claims; they are two
                    questions and must never resolve to the same figure. */}
                <span className="t-data fs-n">{m.anyFlagCount}</span>
              </button>
              <button type="button" className="fs-drill" onClick={() => setView("flags")}>
                <span className="t-data fs-n">{flags.selected ? `${flags.selected}/${flags.values.length}` : flags.values.length}</span>
                <ChevronRight size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
              </button>
            </div>

            {/* Sources get their own screen because the list is the vault's
                length — it is the one facet that cannot be a tile grid. */}
            <button type="button" className="fs-row fs-nav" onClick={() => setView("source")}>
              <span className="t-label t-label-s fs-row-l">{t("reviewqueue.sources")}</span>
              <span className="fs-sum t-data">
                {sources.selected ? selectedSummary(sources) : t("memory.review.anySource")}
              </span>
              <span className="t-data fs-n">{sources.selected ? `${sources.selected}/${sources.values.length}` : sources.values.length}</span>
              <ChevronRight size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
            </button>

            {PINNED.map((id) => (
              <Tiles key={id} facet={facet(id)} onToggle={props.onToggle} />
            ))}

            <button type="button" className="fs-row fs-more" aria-expanded={more} onClick={() => setMore(!more)}>
              <span className="t-label t-label-s fs-row-l">
                {more ? t("memory.review.fewerFilters") : t("memory.review.moreFilters")}
              </span>
              <span className={`t-data fs-n ${moreSelected(m) ? "is-on" : ""}`}>
                {moreSelected(m) || TAIL.length}
              </span>
              {more
                ? <ChevronDown size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
                : <ChevronRight size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
            </button>
            {more && TAIL.map((id) => (
              <CheckList key={id} facet={facet(id)} onToggle={props.onToggle} heading />
            ))}
          </>
        )}

        {/* Flat and ordered by count, not grouped into families. The flags do
            fall into families — limits, redundancy, completeness — but naming
            them means coining category words the product does not have, and
            the count order already puts what this batch actually tripped at
            the top, which is the order a reviewer scans in. */}
        {view === "flags" && flags.values.map((v) => (
          <Check key={v.value} v={v} flag onToggle={() => props.onToggle("flags", v.value)} />
        ))}

        {view === "source" && (
          <SourceList facet={sources} query={query} setQuery={setQuery} onToggle={props.onToggle} />
        )}
      </div>

      <div className="fs-foot">
        <span className="t-data fs-shown">
          {t("memory.review.shownClaims", { count: m.shown, shown: m.shown, total: m.total })}
        </span>
        <button type="button" className="fs-done t-label t-label-s" onClick={closeTopOverlay}>
          {t("memoryvault.done")}
        </button>
      </div>
    </Sheet>
  );
}

/** Short, fixed taxonomies worth a tile grid: every value visible at once. */
const PINNED = ["targetType", "status"];
/** The model's enums — real, but reached for far less often than the rest. */
const TAIL = ["disposition", "risk", "kind", "claimKind"];

const moreSelected = (m: FilterSheetModel) =>
  TAIL.reduce((n, id) => n + (m.facets.get(id)?.selected ?? 0), 0);

/** "restates vault, long +2" — the first two names, then a count. Naming one
 *  more would cost the row its single line at 390px. */
function selectedSummary(f: SheetFacet): string {
  const on = f.values.filter((v) => v.on).map((v) => v.label);
  const head = on.slice(0, 2).join(", ");
  return on.length > 2 ? `${head} +${on.length - 2}` : head;
}

/** The toggle mark. `partial` is the flag row's third state: named flags are
 *  selected, so the set is narrowed but "any" is not what is on. */
function Box(props: { on: boolean; partial?: boolean; flag?: boolean }) {
  const lit = props.on || props.partial;
  return (
    <span className={`fs-box ${lit ? "is-on" : ""} ${props.flag ? "is-flag" : ""}`} aria-hidden="true">
      {props.partial ? <span className="fs-dash" /> : props.on ? <Confirm size={10} stroke={3} /> : null}
    </span>
  );
}

function Check(props: { v: SheetValue; flag?: boolean; icon?: React.ReactNode; onToggle: () => void }) {
  const { v } = props;
  // A value at zero would filter the list to nothing, so it is shown (the
  // count is the information) but not offered — unless it is already on, in
  // which case turning it off is the only way back.
  const dead = v.count === 0 && !v.on;
  return (
    <button
      type="button"
      className={`fs-check ${v.on ? "is-on" : ""}`}
      aria-pressed={v.on}
      disabled={dead}
      onClick={props.onToggle}
    >
      <Box on={v.on} flag={props.flag} />
      {props.icon}
      <span className="t-data fs-check-l">{v.label}</span>
      <span className="t-data fs-n">{v.count}</span>
    </button>
  );
}

/** A facet's heading is rendered even when the facet has nothing in it. An
 *  axis that disappears when the current slice happens to be empty tells the
 *  reviewer it does not exist, which is a different and wrong statement. */
function CheckList(props: { facet: SheetFacet; onToggle: (id: string, v: string) => void; heading?: boolean }) {
  const f = props.facet;
  return (
    <>
      {props.heading && (
        <div className="fs-sub">
          <span className="t-label t-label-s fs-row-l">{f.label}</span>
          <span className={`t-data fs-n ${f.selected ? "is-on" : ""}`}>
            {f.selected ? `${f.selected}/${f.values.length}` : f.values.length}
          </span>
        </div>
      )}
      <div className="fs-checks">
        {f.values.map((v) => (
          <Check key={v.value} v={v} onToggle={() => props.onToggle(f.id, v.value)} />
        ))}
      </div>
    </>
  );
}

/** A taxonomy as tiles: three across, each carrying its own glyph, so the
 *  whole vocabulary is legible without scrolling past it. */
function Tiles(props: { facet: SheetFacet; onToggle: (id: string, v: string) => void }) {
  const f = props.facet;
  return (
    <div className="fs-tiles-w">
      <div className="fs-sub">
        <span className="t-label t-label-s fs-row-l">{f.label}</span>
        <span className={`t-data fs-n ${f.selected ? "is-on" : ""}`}>
          {f.selected ? `${f.selected}/${f.values.length}` : f.values.length}
        </span>
      </div>
      <div className="fs-tiles">
        {f.values.map((v) => {
          const dead = v.count === 0 && !v.on;
          return (
            <button
              key={v.value}
              type="button"
              className={`fs-tile ${v.on ? "is-on" : ""}`}
              aria-pressed={v.on}
              disabled={dead}
              title={v.label}
              onClick={() => props.onToggle(f.id, v.value)}
            >
              {f.id === "targetType"
                ? <TypeIcon type={v.value} size={13} />
                : <DecisionIcon d={decisionOf(v.value)} size={13} />}
              <span className="t-data fs-tile-l">{v.label}</span>
              <span className="t-data fs-n">{v.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The decision facet carries the reviewer's own states plus "edited", which
 *  is not a decision and so gets no decision glyph. */
function decisionOf(value: string): "keep" | "drop" | null {
  return value === "keep" ? "keep" : value === "drop" ? "drop" : null;
}

function SourceList(props: {
  facet: SheetFacet;
  query: string;
  setQuery: (q: string) => void;
  onToggle: (id: string, v: string) => void;
}) {
  const q = props.query.trim().toLowerCase();
  const list = q ? props.facet.values.filter((v) => v.label.toLowerCase().includes(q)) : props.facet.values;
  return (
    <>
      <div className="fs-search">
        <SearchBar
          value={props.query}
          onInput={props.setQuery}
          label={t("memory.sources.search")}
          count={q ? list.length : undefined}
        />
      </div>
      {list.map((v) => (
        <Check key={v.value} v={v} onToggle={() => props.onToggle("source", v.value)} />
      ))}
      {list.length === 0 && (
        <p className="fs-empty t-prose dim">{t("memory.noMatchingSources")}</p>
      )}
    </>
  );
}
