import type { KeyboardEvent, MouseEvent } from "react";
import { t } from "../../../copy";
import { ChevronRight, Flag, Fullscreen, ICON_SIZE } from "../../../ui/icons";
import { PREVIEW_BUDGET, sectionMeta, type SectionView } from "./model";
import "./SectionRow.css";

/** One section of a memory as one row and one tap target.
 *
 *  The glyph and the tap both read `view.fits` and nothing else, so the row
 *  cannot promise an inline expand and then open the peek. A capped section
 *  never expands in place — that is what keeps a 147-line section from turning
 *  the card into twenty screens.
 *
 *  Section keys are arbitrary suggestions rather than an enum: the row renders
 *  the key it is given, in payload order, with no key privileged over another.
 */
export function SectionRow(props: {
  view: SectionView;
  /** Effective open state — the parent owns it (collapse-all lives up there). */
  open: boolean;
  flagOpen: boolean;
  onToggle: () => void;
  onPeek: () => void;
  onFlag: () => void;
}) {
  const { view, open } = props;
  const inline = view.fits;

  const activateFlag = (e: MouseEvent | KeyboardEvent) => {
    // The flag sits inside the row button, so its activation must not also
    // fire the row's expand/peek.
    e.stopPropagation();
    e.preventDefault();
    props.onFlag();
  };

  const body = (
    <div className="mdc-row-body">
      {view.lines.map((line, i) => (
        <div key={i}>- {line}</div>
      ))}
    </div>
  );

  return (
    <div className="mdc-row-wrap">
      <button
        type="button"
        className="mdc-row"
        aria-expanded={open}
        onClick={inline ? props.onToggle : props.onPeek}
      >
        <span className="mdc-row-name-cell">
          <span className="mdc-row-name">§{view.key}</span>
          {view.flag && (
            <span className="mdc-row-flag-wrap">
              {/* A button cannot nest inside a button, so the flag is a span
                  carrying the button role, with Enter/Space wired by hand. */}
              <span
                role="button"
                tabIndex={0}
                className="mdc-row-flag hit"
                aria-label={t("memory.detail.flagWhy")}
                aria-expanded={props.flagOpen}
                onClick={activateFlag}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") activateFlag(e);
                }}
              >
                <Flag size={ICON_SIZE.sm} stroke={2} aria-hidden="true" />
              </span>
              {props.flagOpen && <span className="mdc-row-flag-pop">{view.flag.sentence}</span>}
            </span>
          )}
        </span>

        <span className="mdc-row-meta">{sectionMeta(view)}</span>

        <span className={`mdc-row-glyph${inline && open ? " mdc-row-glyph-open" : ""}`}>
          {inline ? (
            <ChevronRight size={ICON_SIZE.md} aria-hidden="true" />
          ) : (
            <Fullscreen size={ICON_SIZE.md} aria-hidden="true" />
          )}
        </span>
      </button>

      {/* Body text lives outside the button so it can be selected normally. */}
      {open &&
        (inline ? (
          body
        ) : (
          // A capped section shows a fixed slice with a fade: no count, no
          // "show rest" — the meta states the size and the glyph says where
          // the rest is, so every notice tried here only read as noise.
          <div className="mdc-row-preview" style={{ height: `${PREVIEW_BUDGET}px` }}>
            {body}
            <span className="mdc-row-fade" />
          </div>
        ))}
    </div>
  );
}
