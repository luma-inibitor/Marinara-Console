import type { KeyboardEventHandler, ReactNode, RefObject } from "react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { closeTopOverlay, openOverlay } from "../shell/overlays";
import { cn } from "./cn";

export type Side = "bottom" | "top";
export type Align = "start" | "end";

/** The four numbers of a DOMRect the placement reads. */
export type Box = Pick<DOMRect, "top" | "left" | "width" | "height">;

export interface Placement {
  top: number;
  left: number;
  side: Side;
}

/** Space between the anchor and the surface. */
export const GAP = 4;
/** Space kept between the surface and the viewport edge. */
export const MARGIN = 8;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Flips to the other side when the preferred one lacks room, and slides along the anchor to stay in the viewport. */
export function place(
  anchor: Box,
  surface: Box,
  viewport: { width: number; height: number },
  side: Side,
  align: Align,
): Placement {
  const below = anchor.top + anchor.height + GAP;
  const above = anchor.top - GAP - surface.height;
  const fitsBelow = below + surface.height <= viewport.height - MARGIN;
  const fitsAbove = above >= MARGIN;
  let resolved = side;
  if (side === "bottom" && !fitsBelow && fitsAbove) resolved = "top";
  if (side === "top" && !fitsAbove && fitsBelow) resolved = "bottom";
  const top = clamp(resolved === "bottom" ? below : above, MARGIN, viewport.height - MARGIN - surface.height);
  const wanted = align === "start" ? anchor.left : anchor.left + anchor.width - surface.width;
  const left = clamp(wanted, MARGIN, viewport.width - MARGIN - surface.width);
  return { top, left, side: resolved };
}

export interface PopoverProps {
  open: boolean;
  /** The trigger, which the surface sits against and focus returns to on close. */
  anchor: RefObject<HTMLElement | null>;
  label: string;
  /** Clears the state that renders the popover open, on outside click, Escape and back. */
  onClose: () => void;
  side?: Side;
  align?: Align;
  role?: "dialog" | "menu";
  /** `surface` keeps focus off a search field inside, so a phone keyboard does not open with the popover. */
  initialFocus?: "first" | "surface";
  /** Classes on the surface, for its width and padding. */
  className?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  children: ReactNode;
}

/** An anchored surface over a sealed page, portalled to `document.body` and registered with the overlay stack. */
export function Popover(props: PopoverProps) {
  const { open, anchor, side = "bottom", align = "start", role = "dialog", initialFocus = "first" } = props;
  const close = useRef(props.onClose);
  close.current = props.onClose;
  const root = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const el = surface.current;
    const at = anchor.current;
    if (!el || !at) return;
    const measure = () => {
      const p = place(
        at.getBoundingClientRect(),
        el.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        side,
        align,
      );
      el.style.translate = `${p.left}px ${p.top}px`;
      el.dataset.side = p.side;
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open, anchor, side, align]);

  useEffect(() => {
    if (!open) return;
    if (initialFocus === "surface") surface.current?.focus();
    return openOverlay(() => close.current(), { restoreFocus: anchor.current, surface: root.current });
  }, [open, anchor, initialFocus]);

  if (!open) return null;
  return createPortal(
    <div ref={root} className="fixed inset-0 z-70" data-popover-scrim onClick={closeTopOverlay}>
      <div
        ref={surface}
        role={role}
        aria-modal={role === "dialog" ? "true" : undefined}
        aria-label={props.label}
        tabIndex={initialFocus === "surface" ? -1 : undefined}
        className={cn(
          "absolute top-0 left-0 max-h-[calc(100vh-16px)] max-w-[calc(100vw-16px)] overflow-y-auto rounded-md border border-edge-strong bg-surface-1 shadow-pop outline-none",
          props.className,
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={props.onKeyDown}
      >
        {props.children}
      </div>
    </div>,
    document.body,
  );
}
