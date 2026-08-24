import { Fragment } from "react";
import { t } from "../../../copy";
import { Sheet, SheetHead } from "../../../ui/Sheet";
import { Flag, ICON_SIZE } from "../../../ui/icons";
import { SECTION_CAP } from "../data";
import type { SectionView } from "./model";
import "./SectionPeek.css";

/** One section's own screen: the surface where someone actually reads 147
 *  lines, opened from a row whose body does not fit the preview budget.
 *
 *  Built on `Sheet` rather than a hand-rolled overlay so scrim tap, Escape and
 *  the Android back gesture all close it through the one overlay stack.
 *  Unlike a generic sheet it stays a bottom sheet at every width (see the CSS):
 *  it is a reading surface for a single section, not a master-detail pane. */
export function SectionPeek(props: { view: SectionView; onClose: () => void }) {
  const { view } = props;
  const meta =
    t("memory.detail.sectionMeta", {
      count: view.lines.length,
      chars: view.chars.toLocaleString(),
    }) + ` / ${SECTION_CAP.toLocaleString()}`;

  // Cap pressure, clamped: a section over the cap fills the bar and no more.
  const fill = view.flag ? Math.min(1, view.chars / SECTION_CAP) : 0;

  return (
    <Sheet
      label={t("memory.detail.peekLabel", { key: view.key })}
      onClose={props.onClose}
      className="mdc-peek"
    >
      <SheetHead title={`§${view.key}`}>
        {view.flag && (
          // A read-out, not a control: the flag's popover belongs to the row
          // that owns the section, and this sheet already shows the pressure
          // as a meter. The sentence is the glyph's accessible name so the
          // colour is never the only carrier (WCAG 1.4.1).
          <span className="mdc-peek-flag" role="img" aria-label={view.flag.sentence}>
            <Flag size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
          </span>
        )}
        <span className="mdc-peek-meta t-num">{meta}</span>
      </SheetHead>

      {view.flag && (
        // aria-hidden, not role="img": the flag glyph beside the title already
        // announces this exact sentence, and announcing it twice makes the
        // header read as two separate warnings. The bar is the visual half of
        // a signal whose text half is two elements away.
        <div className="mdc-peek-meter" aria-hidden>
          <div className="mdc-peek-meter-fill" style={{ width: `${fill * 100}%` }} />
        </div>
      )}

      <div className="mdc-peek-body">
        {view.lines.map((line, i) => (
          // Fragment, so both cells land as direct children of the grid and
          // the number stays in its own column instead of inside the line.
          <Fragment key={i}>
            {/* Quiet marginal figures: the text reads complete without them,
                which is what keeps 10px legal under the --text-faint rule.
                They exist so a dedupe can point ("line 3 restates line 41"),
                hence tabular via .t-num — alignment has to survive line 99. */}
            <span className="mdc-peek-num t-num">{i + 1}</span>
            <div className="mdc-peek-line">- {line}</div>
          </Fragment>
        ))}
      </div>
    </Sheet>
  );
}
