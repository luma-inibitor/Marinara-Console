import type { ComponentChildren } from "preact";
import "./IconButton.css";

/** A square button holding one icon.
 *
 *  `label` is required: an icon-only control with no accessible name is
 *  invisible to a screen reader and unnameable by voice control.
 *
 *  Pass `href` to render an anchor instead — a download link that looks like a
 *  button is still a link, and should keep a link's behaviours. */
export function IconButton(props: {
  children: ComponentChildren;
  label: string;
  onClick?: () => void;
  href?: string;
  download?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const shared = {
    className: `icon-btn ${props.className ?? ""}`,
    "aria-label": props.label,
    title: props.label,
  };
  if (props.href) {
    return <a {...shared} href={props.href} download={props.download}>{props.children}</a>;
  }
  return (
    <button {...shared} type="button" disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  );
}
