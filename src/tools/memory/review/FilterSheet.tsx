// The review queue's filter surface, with the flag toggle first, the two
// taxonomies as tiles, and the long tail behind a source search and a disclosure.

import { useState } from "react";
import { t } from "../../../copy";
import { FacetDrawer, FacetGroup, FacetTally, FacetToggle, facetSelected, type FacetGroupModel } from "../../../ui";
import { Button } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { SearchBar } from "../../../ui/SearchBar";
import { ChevronRight, ChevronDown, Flag, ICON_SIZE } from "../../../ui/icons";
import { TypeIcon, DecisionIcon } from "../icons";

/** Everything the sheet renders, computed by the caller that holds the stores. */
interface FilterSheetModel {
  facets: Map<string, FacetGroupModel>;
  /** Rows carrying at least one flag, counted as if no flag filter applied. */
  anyFlagCount: number;
  anyFlagOn: boolean;
  shown: number;
  total: number;
  activeCount: number;
}

/** Short, fixed taxonomies worth a tile grid. */
const PINNED = ["targetType", "status"];
/** The model's enums, reached for less often than the rest. */
const TAIL = ["disposition", "risk", "kind", "claimKind"];

const NAV = cn(
  "justify-start rounded-none border-x-0 border-t-0 border-b border-edge px-3 text-left font-normal text-ink hover:bg-surface-2",
  "[font-variation-settings:normal] [&>span]:flex [&>span]:min-w-0 [&>span]:flex-1 [&>span]:items-center [&>span]:gap-2",
);
const NAV_LABEL = "t-label t-label-s flex-none text-ink";

export function FilterSheet(props: {
  model: FilterSheetModel;
  onToggle: (facetId: string, value: string) => void;
  /** Turning "any flag" on drops the named-flag selection, and the reverse. */
  onToggleAnyFlag: () => void;
  onClear: () => void;
  /** Clears whatever renders this sheet, on scrim tap, Escape and back. */
  onClose: () => void;
}) {
  const [view, setView] = useState<"main" | "flags" | "source">("main");
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState("");
  const m = props.model;

  const facet = (id: string): FacetGroupModel => m.facets.get(id) ?? { id, label: "", values: [] };
  const flags = facet("flags");
  const flagsChosen = facetSelected(flags);
  const sources = facet("source");
  const sourcesChosen = facetSelected(sources);
  const tail = TAIL.reduce((n, id) => n + facetSelected(facet(id)), 0);

  const back = () => {
    setView("main");
    setQuery("");
  };
  const title =
    view === "flags" ? flags.label : view === "source" ? t("reviewqueue.sources") : t("memory.review.filter");

  return (
    <FacetDrawer
      label={t("memory.review.filter")}
      title={title}
      activeCount={m.activeCount}
      back={view === "main" ? undefined : { label: t("memory.review.filter"), onBack: back }}
      onClear={props.onClear}
      onClose={props.onClose}
      result={t("memory.review.shownClaims", { count: m.shown, shown: m.shown, total: m.total })}
    >
      {view === "main" && (
        <>
          <div
            className={cn(
              "flex items-stretch border-b border-edge",
              (m.anyFlagOn || flagsChosen > 0) && "bg-flag-wash",
            )}
          >
            <FacetToggle
              prominent
              flag
              label={<span className="t-label t-label-s text-inherit">{t("memory.review.anyFlag")}</span>}
              icon={
                <span className="inline-flex flex-none text-flag">
                  <Flag size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
                </span>
              }
              summary={flagsChosen ? selectedSummary(flags) : ""}
              count={m.anyFlagCount}
              pressed={m.anyFlagOn}
              partial={flagsChosen > 0}
              onToggle={props.onToggleAnyFlag}
            />
            <Button
              variant="ghost"
              labelCase="sentence"
              icon={<ChevronRight size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
              iconAlign="end"
              className="gap-1 rounded-none border-y-0 border-r-0 border-l border-edge px-3 font-normal [font-variation-settings:normal]"
              onClick={() => setView("flags")}
            >
              <FacetTally selected={flagsChosen} total={flags.values.length} />
            </Button>
          </div>

          <Button variant="ghost" labelCase="sentence" fullWidth className={NAV} onClick={() => setView("source")}>
            <span className={NAV_LABEL}>{t("reviewqueue.sources")}</span>
            <span className="min-w-0 flex-1 truncate font-data text-label text-dim">
              {sourcesChosen ? selectedSummary(sources) : t("memory.review.anySource")}
            </span>
            <FacetTally selected={sourcesChosen} total={sources.values.length} />
            <ChevronRight className="flex-none" size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
          </Button>

          {PINNED.map((id) => (
            <FacetGroup key={id} group={withGlyphs(facet(id))} layout="tiles" onToggle={(v) => props.onToggle(id, v)} />
          ))}

          <Button
            variant="ghost"
            labelCase="sentence"
            fullWidth
            expanded={more}
            className={cn(NAV, "border-t bg-canvas")}
            onClick={() => setMore(!more)}
          >
            <span className={NAV_LABEL}>{more ? t("memory.review.fewerFilters") : t("memory.review.moreFilters")}</span>
            <FacetTally selected={tail} total={TAIL.length} />
            {more ? (
              <ChevronDown className="flex-none" size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
            ) : (
              <ChevronRight className="flex-none" size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
            )}
          </Button>
          {more && TAIL.map((id) => <FacetGroup key={id} group={facet(id)} onToggle={(v) => props.onToggle(id, v)} />)}
        </>
      )}

      {view === "flags" && (
        <FacetGroup group={flags} layout="list" heading={false} flag onToggle={(v) => props.onToggle("flags", v)} />
      )}

      {view === "source" && (
        <SourceList facet={sources} query={query} setQuery={setQuery} onToggle={(v) => props.onToggle("source", v)} />
      )}
    </FacetDrawer>
  );
}

/** Two chosen names and then a count, so the row keeps one line at 390px. */
function selectedSummary(f: FacetGroupModel): string {
  const on = f.values.filter((v) => v.on).map((v) => v.label);
  const head = on.slice(0, 2).join(", ");
  return on.length > 2 ? `${head} +${on.length - 2}` : head;
}

/** The tile glyphs, with none for "edited" since it is not a decision. */
function withGlyphs(f: FacetGroupModel): FacetGroupModel {
  const glyph = (value: string) =>
    f.id === "targetType" ? (
      <TypeIcon type={value} size={13} />
    ) : (
      <DecisionIcon d={value === "keep" ? "keep" : value === "drop" ? "drop" : null} size={13} />
    );
  return { ...f, values: f.values.map((v) => ({ ...v, icon: glyph(v.value) })) };
}

function SourceList(props: {
  facet: FacetGroupModel;
  query: string;
  setQuery: (q: string) => void;
  onToggle: (value: string) => void;
}) {
  const q = props.query.trim().toLowerCase();
  const list = q ? props.facet.values.filter((v) => v.label.toLowerCase().includes(q)) : props.facet.values;
  return (
    <>
      <div className="border-b border-edge px-3 py-2">
        <SearchBar
          value={props.query}
          onInput={props.setQuery}
          label={t("memory.sources.search")}
          count={q ? list.length : undefined}
        />
      </div>
      <FacetGroup group={{ ...props.facet, values: list }} layout="list" heading={false} onToggle={props.onToggle} />
      {list.length === 0 && <p className="px-3 py-5 font-prose text-data text-dim">{t("memory.noMatchingSources")}</p>}
    </>
  );
}
