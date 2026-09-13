/* eslint-disable local/no-raw-button -- the row's primary target */
import type { FocusEventHandler, KeyboardEventHandler, ReactNode, Ref } from "react";
import { cn } from "./cn";

/** The rows' container. `role="list"` restates what Preflight's `list-style:
 *  none` makes Safari forget. */
export function List(props: {
  children: ReactNode;
  className?: string;
  label?: string;
  ref?: Ref<HTMLUListElement>;
  onKeyDown?: KeyboardEventHandler<HTMLUListElement>;
  onFocus?: FocusEventHandler<HTMLUListElement>;
}) {
  return (
    <ul
      role="list"
      aria-label={props.label}
      className={props.className}
      ref={props.ref}
      onKeyDown={props.onKeyDown}
      onFocus={props.onFocus}
    >
      {props.children}
    </ul>
  );
}

/** The console's list row.
 *
 *  One primary target, the button that fills the row, and two cells outside it
 *  for anything that must stay its own control: `leading` before it, `action`
 *  after it. Inside the button, `title` truncates to one line, `secondary` is
 *  the meta line under it and `trailing` holds read-only chips and figures.
 *
 *  Focus is the caller's: pass `rowKey` and `tabIndex` from `useRovingFocus`
 *  so the primary carries the roving stop, and give every control in
 *  `leading` or `action` the same `tabIndex`. Without `onActivate` the row is
 *  static and takes no focus.
 *
 *  `disabled` keeps the primary reachable through `aria-disabled` so a screen
 *  reader still arrives at the reason, which the caller states in
 *  `secondary`. */
export type ListItemProps = {
  title: ReactNode;
  secondary?: ReactNode;
  /** A glyph or a control before the primary target. */
  leading?: ReactNode;
  /** Read-only chips and figures inside the primary target. */
  trailing?: ReactNode;
  /** Controls after the primary target, each with its own hit area. */
  action?: ReactNode;
  onActivate?: () => void;
  /** The open row. Sets `aria-current` on the primary target. */
  selected?: boolean;
  disabled?: boolean;
  /** Written to `data-row` on the primary target, where `useRovingFocus` looks for it. */
  rowKey?: string;
  tabIndex?: 0 | -1;
  /** Applied to the row itself, for a wash the screen owns. */
  className?: string;
};

const ROW = "flex items-stretch border-b border-edge";
const SELECTED_ROW = "shadow-[inset_3px_0_0_var(--accent)]";
const SIDE = "flex shrink-0 items-center";
const PRIMARY = "flex min-h-tap min-w-0 flex-1 items-center gap-2 px-row-x py-row-y text-left";
const PRIMARY_BUTTON =
  "transition-colors [transition-duration:var(--t-fast)] hover:bg-surface-1 " +
  "focus-visible:relative focus-visible:z-[1] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none " +
  "aria-disabled:cursor-default aria-disabled:opacity-45 aria-disabled:hover:bg-transparent";
const TITLE = "block truncate font-label text-title leading-tight font-semibold [font-variation-settings:'wdth'_102]";
const SECONDARY = "mt-1 block truncate t-data text-data-s text-dim";

export function ListItem(props: ListItemProps) {
  const { title, secondary, leading, trailing, action, onActivate, selected, disabled, rowKey, tabIndex, className } =
    props;

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className={TITLE}>{title}</span>
        {secondary && <span className={SECONDARY}>{secondary}</span>}
      </span>
      {trailing && <span className={cn(SIDE, "gap-2")}>{trailing}</span>}
    </>
  );

  const primary = onActivate ? (
    <button
      type="button"
      className={cn(PRIMARY, PRIMARY_BUTTON, selected && "bg-surface-1")}
      data-row={rowKey}
      tabIndex={tabIndex}
      aria-current={selected || undefined}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onActivate();
      }}
    >
      {body}
    </button>
  ) : (
    <div className={cn(PRIMARY, selected && "bg-surface-1")} data-row={rowKey}>
      {body}
    </div>
  );

  return (
    <li className={cn(ROW, selected && SELECTED_ROW, className)}>
      {leading && <span className={cn(SIDE, "min-w-6 justify-center pl-row-x")}>{leading}</span>}
      {primary}
      {action && <span className={cn(SIDE, "gap-2 pr-row-x")}>{action}</span>}
    </li>
  );
}
