import { Chip } from "./Chip";
import { Sheet, SheetHead } from "./Sheet";
import { t } from "../copy";
import "./FacetDrawer.css";

export interface FacetValue {
  /** The filter key. Never shown if `label` is set. */
  value: string;
  /** What to display. Set this when the values share a long prefix — four
   *  chips all reading "Lorebook - Ashgate — …" name nothing. */
  label?: string;
  count: number;
  on: boolean;
}
export interface FacetLine { id: string; label: string; values: FacetValue[] }
/** Facets grouped by where they came from — the reviewer treats a number the
 *  console computed differently from one the model asserted. */
export interface FacetGroup { key: string; label: string; facets: FacetLine[] }

/** The filter drawer: every facet in the current slice, with counts, as
 *  toggles.
 *
 *  Values render as a wrapping run of chips rather than rows, because the full
 *  facet inventory is the only thing that has to fit on a phone screen and a
 *  row per value does not. Each facet's chips get their own wrapping column so
 *  a second line aligns under the first chip and never under the label.
 *
 *  A selected value must stay listed at count 0 — that is the caller's job
 *  when it builds `values`. Dropping it makes the selection un-clearable and
 *  the drawer can render blank. */
export function FacetDrawer(props: {
  groups: FacetGroup[];
  onToggle: (facetId: string, value: string) => void;
  onClear: () => void;
  onClose: () => void;
  emptyText: string;
}) {
  const live = props.groups
    .map((g) => ({ ...g, facets: g.facets.filter((f) => f.values.length > 0) }))
    .filter((g) => g.facets.length > 0);

  return (
    <Sheet label={t("ui.facets.title")} onClose={props.onClose}>
      <SheetHead title={<span className="t-label t-label-s">{t("ui.facets.title")}</span>}>
        <Chip onClick={props.onClear}>{t("ui.facets.clear")}</Chip>
      </SheetHead>
      {live.length === 0 && <p className="t-prose dim">{props.emptyText}</p>}
      {live.map((g) => (
        <div key={g.key} className="facet-block">
          <h3 className="t-label t-label-s facet-src">{g.label}</h3>
          {g.facets.map((f) => (
            <div key={f.id} className="facet-line">
              <span className="facet-lab t-label t-label-s">{f.label}</span>
              <span className="facet-vals">
                {f.values.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    className="facet-chip t-data"
                    aria-pressed={v.on}
                    onClick={() => props.onToggle(f.id, v.value)}
                  >
                    <span className="facet-v" title={v.value}>{v.label ?? v.value}</span>
                    <span className="facet-n">{v.count}</span>
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      ))}
    </Sheet>
  );
}
