// How the queue is arranged: what divides it into groups, and what orders the
// rows inside them.
//
// One sheet for both, where there used to be two Pickers. They are one
// question — "arrange this list" — and asking it twice cost two taps and two
// surfaces to answer half of it each. Sort is exclusive-with-a-direction
// rather than a plain radio: pressing the option already selected reverses it,
// which is why the active row carries a direction glyph and the others do not.

import { t } from "../../../copy";
import { Sheet, SheetHead } from "../../../ui/Sheet";
import { SortDown, SortUp, ICON_SIZE } from "../../../ui/icons";
import "./ViewSheet.css";

interface ViewOption {
  id: string;
  label: string;
  /** Groups this option would produce. Absent where the number is not a fact
   *  about the option — sort produces no groups, and "nothing" is one lane by
   *  definition rather than by measurement. */
  count?: number;
}

export function ViewSheet(props: {
  groupers: ViewOption[];
  sorters: ViewOption[];
  group: string;
  sort: string;
  dir: 1 | -1;
  onGroup: (id: string) => void;
  onSort: (id: string) => void;
  onClose: () => void;
}) {
  const current = props.groupers.find((g) => g.id === props.group);
  const currentSort = props.sorters.find((s) => s.id === props.sort);
  return (
    <Sheet label={t("memory.review.view")} onClose={props.onClose} className="view-sheet">
      <SheetHead title={<span className="t-label t-label-s">{t("memory.review.view")}</span>}>
        <span className="vs-meta t-data">{current?.label} · {currentSort?.label}</span>
      </SheetHead>

      <div className="vs-sec">
        <span className="t-label t-label-s vs-sec-l">{t("memory.review.groupBy")}</span>
      </div>
      {props.groupers.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`vs-opt ${props.group === o.id ? "is-on" : ""}`}
          aria-pressed={props.group === o.id}
          onClick={() => props.onGroup(o.id)}
        >
          <Dot on={props.group === o.id} />
          <span className="t-data vs-opt-l">{o.label}</span>
          {o.count !== undefined && <span className="t-data vs-n">{o.count}</span>}
        </button>
      ))}

      {/* Neither section restates its own current value: the head summarises
          both, and the filled dot two rows down says which. Three statements
          of one choice was one too many, twice over. */}
      <div className="vs-sec">
        <span className="t-label t-label-s vs-sec-l">{t("memoryvault.sortBy")}</span>
      </div>
      {props.sorters.map((o) => {
        const on = props.sort === o.id;
        return (
          <button
            key={o.id}
            type="button"
            className={`vs-opt ${on ? "is-on" : ""}`}
            aria-pressed={on}
            onClick={() => props.onSort(o.id)}
          >
            <Dot on={on} />
            <span className="t-data vs-opt-l">{o.label}</span>
            {on && (
              <span className="vs-dir">
                {props.dir === 1
                  ? <SortDown size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
                  : <SortUp size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
              </span>
            )}
          </button>
        );
      })}
      <p className="vs-hint t-prose dim">{t("memory.review.sortFlipHint")}</p>
    </Sheet>
  );
}

/** Exclusive choice, so a dot rather than a box — the shape says only one of
 *  these can be true, before any color is read. */
function Dot(props: { on: boolean }) {
  return <span className={`vs-dot ${props.on ? "is-on" : ""}`} aria-hidden="true" />;
}
