import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { openOverlay, closeTopOverlay } from "../shell/overlays";
import { Close, ICON_SIZE } from "./icons";
import "./Sheet.css";

/** A layered surface: a bottom sheet on a phone, a right-hand panel on a wide
 *  screen. The mobile projection of a panel or popover (DESIGN.md §6).
 *
 *  Sheet registers itself with the overlay stack on mount, so its opener only
 *  has to flip a signal. That is not a convenience — it is the point. Four
 *  sheets hand-rolled this markup and one of them, the import confirm, never
 *  registered at all, so Escape and the Android back gesture walked past it
 *  while closing every other sheet in the console. A dismissal contract that
 *  each call site has to remember is a contract that one call site will
 *  forget.
 *
 *  `onClose` must clear whatever state renders this sheet. It runs on scrim
 *  tap, on Escape, and on back — all three route through the same stack, so
 *  state and history cannot desync. */
export function Sheet(props: {
  label: string;
  onClose: () => void;
  children: ComponentChildren;
  /** Extra classes on the panel — `option-sheet` caps its height, for one. */
  class?: string;
}) {
  return <Overlay {...props} surface={`sheet ${props.class ?? ""}`} />;
}

/** A centred dialog. The surface for a question the reviewer has to answer
 *  before anything else happens — an import that will spend model calls, say.
 *
 *  A Modal is not a Sheet shrunk or a Sheet grown. It sits in the middle
 *  because it interrupts, where a Sheet arrives from an edge because it
 *  extends. They share a dismissal contract, not a shape. */
export function Modal(props: {
  label: string;
  onClose: () => void;
  children: ComponentChildren;
  class?: string;
}) {
  return <Overlay {...props} surface={`modal ${props.class ?? ""}`} />;
}

/** Scrim, dialog semantics, and the overlay-stack registration that every
 *  layered surface needs and one of them used to be missing. */
function Overlay(props: {
  label: string;
  onClose: () => void;
  children: ComponentChildren;
  surface: string;
}) {
  // Captured in a ref on purpose: the stack stores this closer for the lifetime
  // of the entry, and re-registering on render would push history entries.
  const close = useRef(props.onClose);
  close.current = props.onClose;
  useEffect(() => { openOverlay(() => close.current()); }, []);

  return (
    <div class="peek-scrim" onClick={closeTopOverlay}>
      <aside
        class={props.surface}
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </aside>
    </div>
  );
}

/** A sheet's sticky header: title on the left, close on the right, anything
 *  passed as children sitting between them.
 *
 *  Separate from `<Sheet>` because a confirm has no dismiss button — you
 *  answer it, you do not wave it away — and forcing one on would have been a
 *  worse kind of consistency. */
export function SheetHead(props: {
  title: ComponentChildren;
  /** Sits before the title — a type glyph, usually. */
  icon?: ComponentChildren;
  /** Sits between the title and the close button. */
  children?: ComponentChildren;
  /** Focused on open, so the dialog receives focus without stealing a field. */
  autoFocus?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (props.autoFocus) closeRef.current?.focus(); }, []);
  return (
    <header class="sheet-head">
      {props.icon}
      <span class="sheet-title t-prose">{props.title}</span>
      {props.children}
      <button ref={closeRef} class="hit sheet-x" aria-label="Close" onClick={closeTopOverlay}>
        <Close size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
      </button>
    </header>
  );
}
