import type { ReactNode } from "react";
import "./IconButton.css";

/** A square button holding one icon.
 *
 *  `label` is required: an icon-only control with no accessible name is
 *  invisible to a screen reader and unnameable by voice control.
 *
 *  Pass `href` to render an anchor instead — a download link that looks like a
 *  button is still a link, and should keep a link's behaviors. */
export function IconButton(props: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  download?: boolean;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
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
    <button {...shared} type="button" autoFocus={props.autoFocus} disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  );
}
