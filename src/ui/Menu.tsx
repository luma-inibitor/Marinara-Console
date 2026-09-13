/* eslint-disable local/no-raw-button -- a menu item */
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";
import { useCloseThen } from "../shell/overlays";
import { cva } from "./cn";
import { Confirm, ICON_SIZE } from "./icons";
import { Popover, type Align, type Side } from "./Popover";

export interface MenuItem {
  id: string;
  label: ReactNode;
  /** Runs after the menu has closed, except a checkbox runs it at once and stays open. */
  onSelect: () => void;
  /** Renders the item as a radio or a checkbox, with `checked` as its state. */
  check?: "radio" | "checkbox";
  checked?: boolean;
  /** Keeps the item reachable and shows why it cannot act. */
  disabledReason?: string;
  hint?: ReactNode;
}

// eslint-disable-next-line better-tailwindcss/no-unknown-classes -- a DOM selector
const MENUITEM = '[role^="menuitem"]';

const menuItem = cva(
  [
    "flex min-h-tap w-full items-center gap-2 rounded-sm px-3 text-left text-prose text-ink",
    "hover:bg-surface-2 focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none",
  ],
  {
    variants: {
      checked: { true: "bg-accent-wash", false: "" },
      disabled: { true: "cursor-default opacity-45", false: "" },
    },
    defaultVariants: { checked: false, disabled: false },
  },
);

const ROLE = { radio: "menuitemradio", checkbox: "menuitemcheckbox" } as const;

/** The next item for a key, or null when the key is not the menu's. */
export function step(key: string, at: number, count: number, back = false): number | null {
  const next = (at + 1) % count;
  const prev = at <= 0 ? count - 1 : at - 1;
  switch (key) {
    case "ArrowDown":
      return next;
    case "ArrowUp":
      return prev;
    case "Tab":
      return back ? prev : next;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** A list of actions in a Popover, with focus on the checked item or else the first. */
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
  const home = useRef<HTMLButtonElement>(null);
  const checked = props.items.findIndex((item) => item.checked);
  const tabbable = checked === -1 ? 0 : checked;
  useEffect(() => {
    if (props.open) home.current?.focus();
  }, [props.open]);
  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.isDefaultPrevented()) return;
    const items = Array.from(ev.currentTarget.querySelectorAll<HTMLElement>(MENUITEM));
    const next = step(ev.key, items.indexOf(document.activeElement as HTMLElement), items.length, ev.shiftKey);
    if (next === null || !items.length) return;
    ev.preventDefault();
    items[next]!.focus();
  };
  const run = (item: MenuItem) => {
    if (item.disabledReason) return;
    if (item.check === "checkbox") item.onSelect();
    else choose(item.onSelect);
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
      {props.items.map((item, i) => {
        const disabled = item.disabledReason != null;
        const checked = item.check != null && item.checked === true;
        return (
          <button
            key={item.id}
            ref={i === tabbable ? home : undefined}
            type="button"
            role={item.check ? ROLE[item.check] : "menuitem"}
            aria-checked={item.check ? item.checked === true : undefined}
            aria-disabled={disabled || undefined}
            tabIndex={i === tabbable ? 0 : -1}
            className={menuItem({ checked, disabled })}
            onClick={() => run(item)}
          >
            {item.check && (
              <span className="flex w-4 shrink-0 justify-center text-accent">
                {item.checked && <Confirm size={ICON_SIZE.md} stroke={2} aria-hidden />}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {(item.disabledReason ?? item.hint) && (
              <span className="shrink-0 t-data text-data-s text-dim">{item.disabledReason ?? item.hint}</span>
            )}
          </button>
        );
      })}
    </Popover>
  );
}
