import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { t } from "../copy";
import { openOverlay, closeTopOverlay } from "../shell/overlays";
import { Close, ICON_SIZE } from "./icons";

/** A layered surface, a bottom sheet on a phone and a right-hand panel past the split breakpoint. */

// `peek-scrim` and `sheet` stay as bare hooks for tests/e2e/overlays.spec.ts and scripts/domsnap.mjs.
const SCRIM = "peek-scrim fixed inset-0 z-60 bg-scrim";

const PANEL =
  "sheet fixed inset-x-0 bottom-0 z-61 max-h-[78vh] overflow-y-auto rounded-t-l border-t border-edge-strong " +
  "bg-surface-1 p-3 split:inset-y-0 split:left-auto split:right-0 split:w-[400px] split:max-h-none " +
  "split:rounded-none split:border-t-0 split:border-l";

// z-62 keeps a confirm raised from a sheet in front of it.
const MODAL =
  "fixed top-1/2 left-1/2 z-62 max-h-[82vh] w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 " +
  "overflow-y-auto rounded-l border border-edge bg-surface-1 p-3 shadow-modal";

const HEAD =
  "sticky -top-[var(--panel-pad)] z-2 -mx-3 -mt-3 mb-2 flex items-center gap-2 border-b border-edge " +
  "bg-surface-1 px-3 py-2";
const TITLE = "min-w-0 flex-1 font-prose font-semibold";
// grid keeps the mark centred, since a flex button baseline-aligns its svg.
const X = "hit grid size-[38px] place-items-center text-dim";

export function Sheet(props: {
  label: string;
  /** Must clear whatever state renders the sheet, since scrim tap, Escape and back all run it. */
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return <Overlay {...props} surface={[PANEL, props.className].filter(Boolean).join(" ")} />;
}

/** A centred dialog for a question the reviewer has to answer before anything else happens. */
export function Modal(props: { label: string; onClose: () => void; children: ReactNode; className?: string }) {
  return <Overlay {...props} surface={[MODAL, props.className].filter(Boolean).join(" ")} />;
}

function Overlay(props: { label: string; onClose: () => void; children: ReactNode; surface: string }) {
  // The stack keeps this closer for the entry's lifetime, so it lives in a ref.
  const close = useRef(props.onClose);
  close.current = props.onClose;
  // Read during render, before SheetHead's autoFocus effect moves focus.
  const opener = useRef<HTMLElement | null>(null);
  if (opener.current === null) opener.current = document.activeElement as HTMLElement | null;
  const scrim = useRef<HTMLDivElement>(null);
  useEffect(() => openOverlay(() => close.current(), { restoreFocus: opener.current, surface: scrim.current }), []);

  return (
    <div className={SCRIM} ref={scrim} onClick={closeTopOverlay}>
      <div
        className={props.surface}
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>
  );
}

/** A sheet's sticky header, with the title on the left and the close button on the right. */
export function SheetHead(props: {
  title: ReactNode;
  /** Sits before the title. */
  icon?: ReactNode;
  /** Sits between the title and the close button. */
  children?: ReactNode;
  /** Focuses the close button on open, so the dialog takes focus without stealing a field. */
  autoFocus?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Mount-only, so a later flip of autoFocus cannot pull focus out of a field.
  useEffect(() => {
    if (props.autoFocus) closeRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <header className={HEAD}>
      {props.icon}
      <span className={TITLE}>{props.title}</span>
      {props.children}
      <button ref={closeRef} className={X} aria-label={t("ui.sheet.close")} onClick={closeTopOverlay}>
        <Close size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
      </button>
    </header>
  );
}
