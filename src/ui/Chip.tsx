/* eslint-disable local/no-raw-button -- a pressable tag */
import type { ReactNode } from "react";
import { cn, cva } from "./cn";

const chip = cva(
  [
    "inline-flex min-h-tap-2 flex-none items-center gap-[5px] rounded-md border border-edge bg-surface-1 px-[10px]",
    "font-label text-label-s font-semibold tracking-[0.09em] whitespace-nowrap text-dim uppercase",
    "[font-variant-ligatures:none] [font-variation-settings:'wdth'_110]",
  ],
  {
    variants: {
      pressable: {
        true: "chip disabled:cursor-default disabled:opacity-45 aria-pressed:bg-surface-2 [&_.ar]:text-accent",
        false: "tag tabular-nums",
      },
      hue: { accent: "", flag: "" },
    },
    compoundVariants: [
      { pressable: true, hue: "accent", className: "aria-pressed:border-accent aria-pressed:text-ink" },
      { pressable: true, hue: "flag", className: "aria-pressed:border-flag aria-pressed:text-flag" },
    ],
    defaultVariants: { pressable: true, hue: "accent" },
  },
);

/** A small pressable control, a toggle when `pressed` is passed. */
export function Chip(props: {
  children: ReactNode;
  onClick?: () => void;
  /** Present makes this a toggle and renders the pressed state. */
  pressed?: boolean;
  /** Outlier hue, for flag filters. */
  flag?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(chip({ hue: props.flag ? "flag" : "accent" }), props.className)}
      aria-pressed={props.pressed}
      disabled={props.disabled}
      title={props.title}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

/** A chip-shaped static label, not pressable. */
export function Tag(props: { children: ReactNode; className?: string }) {
  return <span className={cn(chip({ pressable: false }), props.className)}>{props.children}</span>;
}
