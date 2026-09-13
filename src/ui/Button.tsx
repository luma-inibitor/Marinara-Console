import type { FocusEvent, ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { cn, cva, type VariantProps } from "./cn";
import { ICON_SIZE, Working } from "./icons";

const button = cva(
  [
    "relative inline-flex items-center justify-center rounded-m border",
    "font-label font-semibold [font-variation-settings:'wdth'_110]",
    "text-center transition-colors [transition-duration:var(--t-fast)]",
    "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
    "disabled:cursor-default disabled:opacity-45",
    "aria-disabled:cursor-default aria-disabled:opacity-45 aria-busy:cursor-default",
  ],
  {
    variants: {
      variant: { primary: "", secondary: "", ghost: "border-transparent" },
      tone: { neutral: "", danger: "", ok: "" },
      size: { md: "min-h-tap gap-2", sm: "min-h-tap-2 gap-[6px]" },
      shape: { label: "", icon: "" },
      labelCase: { upper: "uppercase tracking-[0.09em]", sentence: "tracking-normal" },
      pressed: { true: "", false: "" },
      inert: { true: "", false: "" },
      fullWidth: { true: "w-full" },
    },
    compoundVariants: [
      { size: "md", shape: "label", className: "px-4" },
      { size: "sm", shape: "label", className: "px-3" },
      { size: "md", shape: "icon", className: "w-tap" },
      { size: "sm", shape: "icon", className: "w-tap-2" },
      { labelCase: "upper", size: "md", className: "text-label" },
      { labelCase: "upper", size: "sm", className: "text-label-s" },
      { labelCase: "sentence", size: "md", className: "text-data" },
      { labelCase: "sentence", size: "sm", className: "text-data-s" },
      { pressed: false, variant: "primary", tone: "neutral", className: "border-accent bg-accent text-accent-ink" },
      { pressed: false, variant: "primary", tone: "danger", className: "border-danger bg-danger text-danger-ink" },
      { pressed: false, variant: "primary", tone: "ok", className: "border-ok bg-ok text-ok-ink" },
      { pressed: false, variant: "secondary", tone: "neutral", className: "border-edge-strong text-ink" },
      {
        pressed: false,
        variant: "secondary",
        tone: "danger",
        className: "border-[color-mix(in_srgb,var(--danger)_45%,transparent)] text-danger",
      },
      {
        pressed: false,
        variant: "secondary",
        tone: "ok",
        className: "border-[color-mix(in_srgb,var(--ok)_45%,transparent)] text-ok",
      },
      { pressed: false, variant: "ghost", tone: "neutral", className: "text-dim" },
      { pressed: false, variant: "ghost", tone: "danger", className: "text-danger" },
      { pressed: false, variant: "ghost", tone: "ok", className: "text-ok" },
      { pressed: true, tone: "neutral", className: "border-accent bg-accent-wash text-accent" },
      { pressed: true, tone: "danger", className: "border-danger bg-danger-wash text-danger" },
      { pressed: true, tone: "ok", className: "border-ok bg-ok-wash text-ok" },
      { pressed: false, inert: false, variant: "primary", className: "hover:brightness-[1.08]" },
      { pressed: false, inert: false, variant: "secondary", className: "hover:border-faint" },
      { pressed: false, inert: false, variant: "ghost", className: "hover:text-ink" },
    ],
    defaultVariants: {
      variant: "secondary",
      tone: "neutral",
      size: "md",
      shape: "label",
      labelCase: "upper",
      pressed: false,
      inert: false,
    },
  },
);

const TIP =
  "invisible absolute top-[calc(100%_+_6px)] left-0 z-70 w-max max-w-[260px] rounded-s border border-edge-strong " +
  "bg-surface-3 px-[9px] py-[6px] font-prose text-[11.5px] leading-[1.45] whitespace-normal text-ink shadow-pop " +
  "group-hover:visible group-focus-within:visible";

type Styles = VariantProps<typeof button>;

type Common = {
  variant?: NonNullable<Styles["variant"]>;
  /** Category, not rank. Composes with every variant. */
  tone?: "danger" | "ok";
  size?: NonNullable<Styles["size"]>;
  /** The source string stays sentence case, so the accessible name is unaffected. */
  labelCase?: NonNullable<Styles["labelCase"]>;
  icon?: ReactNode;
  iconAlign?: "start" | "end";
  /** Spinner after a 1s delay, focusable throughout, repeat presses swallowed. */
  pending?: boolean;
  disabled?: boolean;
  /** Why the action is unavailable, which keeps the control focusable. */
  disabledReason?: string;
  href?: string;
  download?: boolean;
  target?: string;
  pressed?: boolean;
  expanded?: boolean;
  haspopup?: boolean | "menu" | "listbox" | "tree" | "grid" | "dialog";
  fullWidth?: boolean;
  onClick?: () => void;
  className?: string;
  autoFocus?: boolean;
  /** -1 takes it out of the tab order, for a button inside a roving composite. */
  tabIndex?: number;
};

export type ButtonProps = Common &
  (
    | { iconOnly?: false; children: ReactNode; label?: never }
    | { iconOnly: true; label: string; icon: ReactNode; children?: never }
  );

/** Spectrum's delay, so work that finishes inside a frame never flashes a spinner. */
const SPINNER_DELAY_MS = 1000;

export function Button(props: ButtonProps) {
  const {
    variant,
    tone,
    size = "md",
    labelCase,
    icon,
    iconAlign = "start",
    pending = false,
    disabled = false,
    disabledReason,
    href,
    download,
    target,
    pressed,
    expanded,
    haspopup,
    fullWidth,
    onClick,
    className,
    autoFocus,
    tabIndex,
    label,
  } = props;
  const iconOnly = props.iconOnly === true;
  const tipId = useId();

  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (!pending) {
      setSpinning(false);
      return;
    }
    const id = setTimeout(() => setSpinning(true), SPINNER_DELAY_MS);
    return () => clearTimeout(id);
  }, [pending]);
  const [tipOpen, setTipOpen] = useState(false);

  const inert = disabled || pending;
  const softDisabled = inert && (pending || disabledReason != null);
  const withTip = disabled && disabledReason != null;

  const cls = cn(
    button({
      variant,
      tone: tone ?? "neutral",
      size,
      shape: iconOnly ? "icon" : "label",
      labelCase,
      pressed,
      inert,
      fullWidth,
    }),
    className,
  );

  const hide = spinning ? "opacity-0" : undefined;
  const glyph = icon && <span className={hide}>{icon}</span>;
  const body = (
    <>
      {iconAlign === "start" && glyph}
      {!iconOnly && <span className={hide}>{props.children}</span>}
      {iconAlign === "end" && glyph}
      {spinning && (
        <Working
          className="absolute inset-0 m-auto animate-spin motion-reduce:[animation-duration:2400ms]"
          size={size === "sm" ? ICON_SIZE.sm : ICON_SIZE.xl}
          stroke={2}
        />
      )}
    </>
  );

  const shared = {
    className: cls,
    "aria-label": label,
    "aria-busy": pending || undefined,
    "aria-pressed": pressed,
    "aria-expanded": expanded,
    "aria-haspopup": haspopup,
    "aria-describedby": withTip ? tipId : undefined,
    title: iconOnly ? label : undefined,
  };

  const control = href ? (
    <a
      {...shared}
      href={inert && !softDisabled ? undefined : href}
      download={download}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      tabIndex={tabIndex ?? (softDisabled ? 0 : undefined)}
      aria-disabled={inert || undefined}
      onClick={(e) => {
        if (inert) e.preventDefault();
        else onClick?.();
      }}
    >
      {body}
    </a>
  ) : (
    <button
      {...shared}
      type="button"
      autoFocus={autoFocus}
      tabIndex={tabIndex}
      disabled={inert && !softDisabled}
      aria-disabled={softDisabled || undefined}
      onClick={() => {
        if (!inert) onClick?.();
      }}
    >
      {body}
    </button>
  );

  if (!withTip) return control;
  return (
    <span
      className="group relative inline-flex"
      onClick={() => setTipOpen(!tipOpen)}
      onBlur={(e: FocusEvent<HTMLSpanElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setTipOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && tipOpen) {
          e.stopPropagation();
          setTipOpen(false);
        }
      }}
    >
      {control}
      <span id={tipId} role="tooltip" className={cn(TIP, tipOpen && "visible")}>
        {disabledReason}
      </span>
    </span>
  );
}
