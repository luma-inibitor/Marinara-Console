import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { t } from "../copy";
import { openOverlay, closeTopOverlay } from "../shell/overlays";
import { Close, ICON_SIZE } from "./icons";
import "./Sheet.css";

/** A layered surface: a bottom sheet on a phone, a right-hand panel on a wide
 *  screen. The mobile projection of a panel or popover (DESIGN.md §6).
 *
 *  Sheet registers itself with the overlay stack on mount, so its opener only
 *  has to flip a signal and Escape and the Android back gesture reach it
 *  without the call site arranging anything.
 *
 *  `onClose` must clear whatever state renders this sheet. It runs on scrim
 *  tap, on Escape, and on back — all three route through the same stack, so
 *  state and history cannot desync. */
export function Sheet(props: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Extra classes on the panel — `option-sheet` caps its height, for one. */
  className?: string;
}) {
  return <Overlay {...props} surface={`sheet ${props.className ?? ""}`} />;
}

/** A centered dialog. The surface for a question the reviewer has to answer
 *  before anything else happens — an import that will spend model calls, say.
 *
 *  A Modal sits in the middle because it interrupts, where a Sheet arrives from
 *  an edge because it extends. They share a dismissal contract, not a shape. */
export function Modal(props: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return <Overlay {...props} surface={`modal ${props.className ?? ""}`} />;
}

/** Scrim, dialog semantics, and the overlay-stack registration that every
 *  layered surface needs.
 *
 *  Radix's dialog supplies what `aria-modal="true"` has always promised and
 *  the hand-rolled version never delivered: a focus trap, a scroll lock, and
 *  `aria-hidden` on everything behind. It owns none of the dismissal —
 *  `overlays.ts` does, because dismissal here is a history traversal so the
 *  Android back gesture reaches every layer. Every Radix dismissal route is
 *  therefore cancelled and re-routed through the stack, or the two would each
 *  close a layer for one gesture. */
function Overlay(props: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  surface: string;
}) {
  // Captured in a ref on purpose: the stack stores this closer for the lifetime
  // of the entry, and re-registering on render would push history entries.
  const close = useRef(props.onClose);
  close.current = props.onClose;
  useEffect(() => openOverlay(() => close.current()), []);

  // The opener has to be read during this render: by the time any effect runs,
  // the trap below has already moved focus into the surface, so the stack entry
  // records a control that is about to be removed and restores nothing.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  return (
    <Dialog.Root open modal>
      <Dialog.Overlay className="peek-scrim">
        <Dialog.Content
          asChild
          // Escape already has a handler: overlays.ts's document listener, which
          // runs in the same capture phase and cannot be stopped from here
          // (stopPropagation does not reach a listener on the same node). Both
          // firing pops two history entries for one press.
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => { e.preventDefault(); closeTopOverlay(); }}
          // Restoring on unmount rather than letting the stack entry do it: the
          // entry restores during dismissal, while the trap is still up, and the
          // trap pulls focus straight back in.
          onCloseAutoFocus={(e) => { e.preventDefault(); if (opener?.isConnected) opener.focus(); }}
        >
          <aside className={props.surface} aria-modal="true" aria-label={props.label}>
            {props.children}
          </aside>
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}

/** A sheet's sticky header: title on the left, close on the right, anything
 *  passed as children sitting between them.
 *
 *  Separate from `<Sheet>` because a confirm has no dismiss button — you answer
 *  it, you do not wave it away. */
export function SheetHead(props: {
  title: ReactNode;
  /** Sits before the title — a type glyph, usually. */
  icon?: ReactNode;
  /** Sits between the title and the close button. */
  children?: ReactNode;
  /** Focused on open, so the dialog receives focus without stealing a field. */
  autoFocus?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Mount-only on purpose. Depending on autoFocus would re-run the effect when
  // it later flips true and yank focus out of whatever the reader is using.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (props.autoFocus) closeRef.current?.focus(); }, []);
  return (
    <header className="sheet-head">
      {props.icon}
      <span className="sheet-title t-prose">{props.title}</span>
      {props.children}
      <button ref={closeRef} className="hit sheet-x" aria-label={t("ui.sheet.close")} onClick={closeTopOverlay}>
        <Close size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
      </button>
    </header>
  );
}
