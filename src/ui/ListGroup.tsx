import type { ComponentChildren } from "preact";
import { t } from "../copy";
import { ChevronDown, ChevronRight } from "./icons";
import "./ListGroup.css";

/** The collapse control for a group of rows.
 *
 *  Its own component for the accessible name: the label must say what will
 *  happen, to what, and how much is hidden — "Expand Sherlock Holmes (4)".
 *  Without it a screen reader announces a bare "button". */
export function CollapseButton(props: {
  collapsed: boolean;
  onToggle: () => void;
  /** What this group is called, for the accessible name. */
  label: string;
  /** How many rows it holds. */
  count: number;
  size?: number;
  className?: string;
}) {
  const Chevron = props.collapsed ? ChevronRight : ChevronDown;
  return (
    <button
      type="button"
      className={`gexp hit ${props.className ?? ""}`}
      aria-expanded={!props.collapsed}
      aria-label={t(props.collapsed ? "ui.group.expand" : "ui.group.collapse", {
        label: props.label, count: props.count })}
      onClick={props.onToggle}
    >
      <Chevron size={props.size ?? 16} stroke={1.75} aria-hidden />
    </button>
  );
}

/** A collapsible group of rows: a header, and the rows when it is open.
 *
 *  The header's shape is the caller's — pass `className` to pick it. This owns
 *  the behaviour only: the chevron, its accessible name, and not rendering
 *  children while collapsed. */
export function ListGroup(props: {
  collapsed: boolean;
  onToggle: () => void;
  label: string;
  count: number;
  /** Everything in the header after the chevron — icon, title, controls. */
  head: ComponentChildren;
  children: ComponentChildren;
  className?: string;
  chevronSize?: number;
}) {
  return (
    <div className="listgroup">
      <div className={props.className}>
        <CollapseButton
          collapsed={props.collapsed}
          onToggle={props.onToggle}
          label={props.label}
          count={props.count}
          size={props.chevronSize}
        />
        {props.head}
      </div>
      {!props.collapsed && props.children}
    </div>
  );
}
