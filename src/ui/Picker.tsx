import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn, cva, type VariantProps } from "./cn";
import { ChevronDown, ICON_SIZE } from "./icons";
import type { Icon } from "./icons";
import { Menu, type MenuItem } from "./Menu";
import type { Align } from "./Popover";
import { closeTopOverlay } from "../shell/overlays";

const trigger = cva(
  [
    "inline-flex items-center gap-1.5 rounded-m border border-edge bg-surface-1",
    "font-label font-semibold tracking-[0.09em] text-dim uppercase [font-variation-settings:'wdth'_110]",
    "transition-colors hover:border-faint hover:text-ink aria-expanded:bg-surface-2 aria-expanded:text-ink",
    "focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none",
  ],
  {
    variants: { size: { sm: "min-h-tap-2 px-2.5 text-label-s", md: "min-h-tap px-2 text-label" } },
    defaultVariants: { size: "sm" },
  },
);

export interface PickerOption {
  id: string;
  label: string;
  hint?: ReactNode;
  /** Keeps the option reachable and shows why it cannot be chosen. */
  disabledReason?: string;
}

type Choice =
  | { multi?: false; value: string; onChange: (id: string) => void }
  | { multi: true; value: readonly string[]; onChange: (ids: string[]) => void };

export type PickerProps = Choice & {
  /** Names the choice, as in "Group by"; the trigger reads `label: value`. */
  label: string;
  options: PickerOption[];
  icon?: Icon;
  /** The trigger's text while a multi picker has nothing chosen. */
  noneLabel?: string;
  size?: NonNullable<VariantProps<typeof trigger>["size"]>;
  align?: Align;
  className?: string;
};

/** A choice from a short fixed list, in a Menu anchored to a chip that shows the current one. */
export function Picker(props: PickerProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const chosen = (id: string) => (props.multi ? props.value.includes(id) : props.value === id);
  const items: MenuItem[] = props.options.map((o) => ({
    id: o.id,
    label: o.label,
    hint: o.hint,
    disabledReason: o.disabledReason,
    check: props.multi ? "checkbox" : "radio",
    checked: chosen(o.id),
    onSelect: () => {
      if (props.multi) props.onChange(chosen(o.id) ? props.value.filter((v) => v !== o.id) : [...props.value, o.id]);
      else props.onChange(o.id);
    },
  }));
  const current = props.options.filter((o) => chosen(o.id)).map((o) => o.label);
  const text = current.length ? current.join(", ") : (props.noneLabel ?? props.label);
  const I = props.icon;
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={cn(trigger({ size: props.size }), props.className)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${props.label}: ${text}`}
        onClick={() => (open ? closeTopOverlay() : setOpen(true))}
      >
        {I && <I size={ICON_SIZE.md} stroke={1.75} className="shrink-0" aria-hidden />}
        <span className="min-w-0 truncate">{text}</span>
        <ChevronDown size={ICON_SIZE.sm} stroke={1.75} className="shrink-0" aria-hidden />
      </button>
      <Menu
        open={open}
        anchor={anchor}
        label={props.label}
        align={props.align}
        items={items}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
