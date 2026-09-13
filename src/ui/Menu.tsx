import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { useCloseThen } from "../shell/overlays";
import { Popover, type Align, type Side } from "./Popover";

export interface MenuItem {
  id: string;
  label: ReactNode;
  /** Runs after the menu has closed and its history entry has settled. */
  onSelect: () => void;
}

// eslint-disable-next-line better-tailwindcss/no-unknown-classes -- a DOM selector
const MENUITEM = '[role="menuitem"]';
const ITEM =
  "flex min-h-tap w-full items-center rounded-sm px-3 text-left text-prose text-ink " +
  "hover:bg-surface-2 focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none";

/** The next item for a key, or null when the key is not the menu's. */
export function step(key: string, at: number, count: number): number | null {
  switch (key) {
    case "ArrowDown":
      return (at + 1) % count;
    case "ArrowUp":
      return at <= 0 ? count - 1 : at - 1;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** A list of actions in a Popover.
 *
 *  Focus lands on the first item when the menu opens and returns to the
 *  trigger when it closes. Arrows move between items and wrap, Home and End
 *  jump, and Enter or Space runs the item. The trigger carries
 *  `aria-haspopup="menu"` and `aria-expanded`. */
export function Menu(props: {
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
  label: string;
  onClose: () => void;
  items: MenuItem[];
  side?: Side;
  align?: Align;
}) {
  const choose = useCloseThen(props.open);
  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(ev.currentTarget.querySelectorAll<HTMLElement>(MENUITEM));
    const next = step(ev.key, items.indexOf(document.activeElement as HTMLElement), items.length);
    if (next === null || !items.length) return;
    ev.preventDefault();
    items[next]!.focus();
  };
  return (
    <Popover
      open={props.open}
      anchor={props.anchor}
      label={props.label}
      onClose={props.onClose}
      role="menu"
      side={props.side}
      align={props.align}
      className="min-w-[180px] p-1"
      onKeyDown={onKeyDown}
    >
      {props.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={ITEM}
          onClick={() => choose(item.onSelect)}
        >
          {item.label}
        </button>
      ))}
    </Popover>
  );
}
