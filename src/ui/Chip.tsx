import type { ComponentChildren } from "preact";
import "./Chip.css";

/** A small pressable control: an action, or a toggle when `pressed` is passed.
 *
 *  Accent means interactive (design/DESIGN.md §2), so a non-interactive label
 *  must not reach for it — use `<Tag>` for those. */
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

/** A chip-shaped static label — a keyword, a type, a value. Not pressable. */
export function Tag(props: { children: ComponentChildren; className?: string }) {
  return <span className={`tag t-data ${props.className ?? ""}`}>{props.children}</span>;
}
