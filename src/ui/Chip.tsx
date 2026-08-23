import type { ComponentChildren } from "preact";
import "./Chip.css";

/** A small pressable control: an action, or a toggle when `pressed` is passed.
 *
 *  Split from `<Tag>` deliberately. The console had one `.chip` class doing
 *  three jobs — action button, filter toggle, and static label — so whether a
 *  chip-shaped thing could be clicked was something you found out by clicking
 *  it. Accent means interactive (design/DESIGN.md §2); a label that is not
 *  interactive must not be able to reach for it, and now it cannot, because
 *  it is a different component. */
export function Chip(props: {
  children: ComponentChildren;
  onClick?: () => void;
  /** Present makes this a toggle and renders the pressed state. */
  pressed?: boolean;
  /** Computed-outlier hue, reserved for flag filters (DESIGN.md §2). */
  flag?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`chip ${props.flag ? "is-flag" : ""} ${props.className ?? ""}`}
      aria-pressed={props.pressed}
      disabled={props.disabled}
      title={props.title}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

/** A chip-shaped static label — a keyword, a type, a value. Not pressable.
 *  See `<Chip>` for why this is its own component. */
export function Tag(props: { children: ComponentChildren; className?: string }) {
  return <span className={`tag t-data ${props.className ?? ""}`}>{props.children}</span>;
}
