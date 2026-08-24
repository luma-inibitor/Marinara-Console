import type { KeyboardEvent, MouseEvent } from "react";
import { t } from "../../../copy";
import { ChevronRight, Flag, ICON_SIZE } from "../../../ui/icons";
import { sectionMeta, type SectionView } from "./model";
import "./SectionRow.css";

/** One section of a memory as one row and one tap target.
 *
 *  Every section behaves identically: the chevron expands the body in place,
 *  however long the body is. There is no size threshold and no second surface,
 *  so the glyph has only one thing it can mean.
 *
 *  A long section is made navigable by the row itself: while its body is open
 *  the row sticks under the card's head, so the control that closes it is on
 *  screen the whole way down instead of a hundred lines back up. That is a CSS
 *  behavior, and it costs nothing for a short section — a header with less
 *  body than viewport never reaches its sticky offset.
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
  onFlag: () => void;
}) {
  const { view, open } = props;

  const activateFlag = (e: MouseEvent | KeyboardEvent) => {
    // The flag sits inside the row button, so its activation must not also
    // fire the row's expand.
    e.stopPropagation();
    e.preventDefault();
    props.onFlag();
  };

  return (
    <div className="mdc-row-wrap" data-key={view.key}>
      <button
        type="button"
        className={`mdc-row${open ? " is-open" : ""}`}
        aria-expanded={open}
        onClick={props.onToggle}
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

        <span className={`mdc-row-glyph${open ? " mdc-row-glyph-open" : ""}`}>
          <ChevronRight size={ICON_SIZE.md} aria-hidden="true" />
        </span>
      </button>

      {/* Body text lives outside the button so it can be selected normally. */}
      {open && (
        <div className="mdc-row-body">
          {view.lines.map((line, i) => (
            <div key={i}>- {line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
