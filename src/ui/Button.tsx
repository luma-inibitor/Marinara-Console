import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { t } from "../copy";
import { Term } from "./Term";
import { ICON_SIZE, Working } from "./icons";

/** The console's one button.
 *
 *  Rank is carried by the box and then by ink brightness — accent fill, then a
 *  bordered box in `--text`, then a bare label in `--text-dim`. `--accent` is
 *  deliberately NOT a rank step: measured against the canvas an accent label is
 *  7.24:1 where `--text` is 15.78:1, so an accent-inked tier ranked above a
 *  neutral one reads as louder, not quieter. Accent stays with the primary fill
 *  and with `pressed`.
 *
 *  `tone` is category, not rank, and composes with every variant — a destructive
 *  action can be the page's primary or a quiet ghost without changing meaning.
 *
 *  Icon-only is a mode of this component, not a separate one, because every prop
 *  here applies to it: an icon button still goes pending, still has to say why it
 *  is unavailable, still reports `pressed` and `expanded`. What it may not do is
 *  go unnamed, so `iconOnly` demands `label` in the type.
 *
 *  Pass `href` to render an anchor instead — a download link that looks like a
 *  button is still a link, and should keep a link's behaviors. */

type Variant = "primary" | "secondary" | "ghost";
type Tone = "danger" | "ok";

type Common = {
  variant?: Variant;
  /** Category, not rank. Composes with every variant. */
  tone?: Tone;
  size?: "md" | "sm";
  /** Uppercase is the house label treatment; the source string stays sentence
   *  case either way, so the accessible name is unaffected. */
  labelCase?: "upper" | "sentence";
  icon?: ReactNode;
  iconAlign?: "start" | "end";
  /** Spinner after a 1s delay, focusable throughout, repeat presses swallowed. */
  pending?: boolean;
  disabled?: boolean;
  /** Why the action is unavailable. Supplying it keeps the button focusable,
   *  because a reason nobody can reach is not a reason. */
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
};

export type ButtonProps = Common &
  (
    | { iconOnly?: false; children: ReactNode; label?: string }
    | { iconOnly: true; label: string; icon: ReactNode; children?: never }
  );

/** Spectrum's delay. Some work finishes in 80ms, and a spinner that appears and
 *  vanishes inside a frame reads as a glitch rather than as progress. The button
 *  is already inert during the delay — the wait is hidden, not ignored. */
const SPINNER_DELAY_MS = 1000;

// Two rules govern every string below.
//
// Tailwind's scanner reads source text, so each is a whole literal. Composing
// one (`bg-${tone}`) produces a class that is never generated, and the failure
// is a silently unstyled button rather than an error.
//
// And two utilities setting the SAME property must never both be emitted: the
// winner is their order in the generated sheet, not in this string. Shipping
// `border border-transparent` in the base and `border-edge-strong` in the skin
// left every secondary button borderless, because `border-transparent` sorts
// later. So each property is owned by exactly one lookup below.

const BASE =
  "relative inline-flex items-center justify-center rounded-m border " +
  "font-label font-semibold [font-variation-settings:'wdth'_110] " +
  "text-center transition-colors [transition-duration:var(--t-fast)] " +
  "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] " +
  "disabled:opacity-45 disabled:cursor-default " +
  "aria-disabled:opacity-45 aria-disabled:cursor-default aria-busy:cursor-default";

// Owns min-height, gap and horizontal padding. Icon-only takes a fixed width
// and no padding, so it cannot also carry the labelled form's `px-*`.
const BOX = {
  "md:label": "min-h-tap gap-2 px-4",
  "md:icon": "min-h-tap w-tap gap-2",
  "sm:label": "min-h-tap-2 gap-[6px] px-3",
  "sm:icon": "min-h-tap-2 w-tap-2 gap-[6px]",
} as const;

// Owns text-transform, letter-spacing and font-size.
const TYPE = {
  "upper:md": "uppercase tracking-[0.09em] text-label",
  "upper:sm": "uppercase tracking-[0.09em] text-label-s",
  "sentence:md": "tracking-normal text-data",
  "sentence:sm": "tracking-normal text-data-s",
} as const;

// Owns background, border-color and text colour. variant × tone — danger and ok
// borrow the fill and ink of their hue, and the secondary border is mixed down
// so a bordered box does not read as a fill.
const SKIN: Record<string, string> = {
  "primary:": "bg-accent text-accent-ink border-accent",
  "secondary:": "border-edge-strong text-ink",
  "ghost:": "border-transparent text-dim",
  "primary:danger": "bg-danger text-danger-ink border-danger",
  "secondary:danger": "text-danger border-[color-mix(in_srgb,var(--danger)_45%,transparent)]",
  "ghost:danger": "border-transparent text-danger",
  "primary:ok": "bg-ok text-ok-ink border-ok",
  "secondary:ok": "text-ok border-[color-mix(in_srgb,var(--ok)_45%,transparent)]",
  "ghost:ok": "border-transparent text-ok",
};

// Pressed takes the wash of its hue and overrides the resting skin entirely, so
// it reads the same whichever variant is underneath it.
const PRESSED: Record<string, string> = {
  "": "bg-accent-wash border-accent text-accent",
  danger: "bg-danger-wash border-danger text-danger",
  ok: "bg-ok-wash border-ok text-ok",
};

const HOVER: Record<Variant, string> = {
  primary: "hover:brightness-[1.08]",
  secondary: "hover:border-faint",
  ghost: "hover:text-ink",
};

export function Button(props: ButtonProps) {
  const {
    variant = "secondary", tone, size = "md", labelCase = "upper",
    icon, iconAlign = "start", pending = false, disabled = false, disabledReason,
    href, download, target, pressed, expanded, haspopup, fullWidth,
    onClick, className, autoFocus, label,
  } = props;
  const iconOnly = props.iconOnly === true;

  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (!pending) { setSpinning(false); return; }
    const id = setTimeout(() => setSpinning(true), SPINNER_DELAY_MS);
    return () => clearTimeout(id);
  }, [pending]);

  const inert = disabled || pending;
  // A reason to show means the control has to stay reachable, so it is only
  // aria-disabled. Without one there is nothing to reach and :disabled is
  // honest — it drops the button out of the tab order entirely.
  const softDisabled = inert && (pending || disabledReason != null);

  const cls = [
    BASE,
    BOX[`${size}:${iconOnly ? "icon" : "label"}`],
    TYPE[`${labelCase}:${size}`],
    pressed ? PRESSED[tone ?? ""] : SKIN[`${variant}:${tone ?? ""}`],
    !pressed && !inert && HOVER[variant],
    fullWidth && "w-full",
    className,
  ].filter(Boolean).join(" ");

  const hide = spinning ? "invisible" : undefined;
  const glyph = icon && <span className={hide}>{icon}</span>;
  const body = (
    <>
      {iconAlign === "start" && glyph}
      {/* The label keeps its box and loses only its ink, so a row cannot reflow
          mid-request; the spinner is laid over the space it left. */}
      {!iconOnly && <span className={hide}>{props.children}</span>}
      {iconAlign === "end" && glyph}
      {spinning && (
        <Working
          className="absolute inset-0 m-auto animate-spin motion-reduce:[animation-duration:2400ms]"
          size={size === "sm" ? ICON_SIZE.sm : ICON_SIZE.xl}
          stroke={2}
          aria-label={t("ui.button.pending")}
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
    // A title on a button that already shows its label is read twice; on an
    // icon-only button it is the only way a pointer user learns the name.
    title: iconOnly ? label : undefined,
  };

  if (href) {
    return (
      <a {...shared} href={inert ? undefined : href} download={download} target={target}
         rel={target === "_blank" ? "noopener noreferrer" : undefined}
         aria-disabled={inert || undefined}>
        {body}
      </a>
    );
  }

  const button = (
    <button
      {...shared}
      type="button"
      autoFocus={autoFocus}
      disabled={inert && !softDisabled}
      aria-disabled={softDisabled || undefined}
      onClick={() => { if (!inert) onClick?.(); }}
    >
      {body}
    </button>
  );

  // -1 keeps the Term out of the tab order: the button inside it is already a
  // tab stop, and two stops for one control is a trap in miniature.
  return disabledReason && disabled
    ? <Term tip={disabledReason} tabIndex={-1}>{button}</Term>
    : button;
}
