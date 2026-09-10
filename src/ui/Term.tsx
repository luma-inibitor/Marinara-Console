import type { ReactNode } from "react";
import { useState } from "react";
import "./Term.css";

/** A word or icon that can explain itself in place.
 *
 *  Hover or focus reveals it on a pointer; tap toggles it on touch. Never
 *  hover-only — a tooltip only a mouse can reach does not exist on touch.
 *
 *  Definitions lead with the field the value belongs to ("claim kind · static
 *  — …"), so a bare word is never floating free. Interactive controls carry no
 *  Term: a help cursor on something you are meant to click is a contradiction.
 *  Their teaching goes in a first-use hint.
 *
 *  The one exception is the control you are NOT meant to click: `Button`'s
 *  `disabledReason` wraps an unavailable button in a Term, because the reason
 *  has to reach a pointer and a keyboard both. Pass `tabIndex={-1}` there — the
 *  button inside is already a tab stop, and two stops for one control is a trap
 *  in miniature. */
export function Term(props: {
  tip: string;
  children: ReactNode;
  chip?: boolean;
  /** -1 takes it out of the tab order, for a Term inside a roving composite. */
  tabIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={`term ${props.chip ? "term-chip" : ""} ${open ? "tip-open" : ""}`}
      tabIndex={props.tabIndex ?? 0}
      data-tip={props.tip}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(!open);
      }}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      {props.children}
    </span>
  );
}
