import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import "./Term.css";

/** A word or icon that can explain itself in place.
 *
 *  Hover or focus reveals it on a pointer; tap toggles it on touch. Never
 *  hover-only — a tooltip that only a mouse can reach does not exist on the
 *  device Luma actually uses.
 *
 *  Definitions lead with the field the value belongs to ("claim kind · static
 *  — …"), so a bare word is never floating free. Interactive controls carry no
 *  Term: a help cursor on something you are meant to click is a contradiction
 *  (owner feedback, 2026-08-21). Their teaching goes in a first-use hint. */
export function Term(props: {
  tip: string;
  children: ComponentChildren;
  chip?: boolean;
  /** -1 takes it out of the tab order, for a Term inside a roving composite. */
  tabIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      class={`term ${props.chip ? "term-chip" : ""} ${open ? "tip-open" : ""}`}
      tabIndex={props.tabIndex ?? 0}
      data-tip={props.tip}
      onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); } }}
    >
      {props.children}
    </span>
  );
}
