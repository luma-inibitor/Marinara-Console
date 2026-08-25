// Radix's focus trap and background aria-hiding, with dismissal left to the
// caller. A surface that renders `aria-modal` must keep Tab inside itself, and
// this is the only way that is done here (DESIGN.md §8).
import type { ReactNode } from "react";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

export function FocusTrap(props: {
  /** The trapped surface. One element, forwarding props to a DOM node. */
  children: ReactNode;
  /** Class for the scrim Radix renders behind the surface. Omit for a surface
   *  that fills the viewport. */
  scrim?: string;
  /** Runs on a pointer-down outside the surface. Omit where there is nothing
   *  outside to press. */
  onOutside?: () => void;
}) {
  // Read during render. By the first effect the trap has already moved focus
  // into the surface.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  const content = (
    <Dialog.Content
      asChild
      // Radix listens for Escape on document in capture, where the surface's own
      // handler already sits and stopPropagation cannot reach it, so both would
      // close a layer.
      onEscapeKeyDown={(e) => e.preventDefault()}
      // Routed through the caller so state and history stay in step.
      onPointerDownOutside={(e) => { e.preventDefault(); props.onOutside?.(); }}
      // A caller that restores focus itself does it while the trap is still up
      // and the trap takes it back. On unmount this holds.
      onCloseAutoFocus={(e) => { e.preventDefault(); if (opener?.isConnected) opener.focus(); }}
    >
      {props.children}
    </Dialog.Content>
  );

  return (
    <Dialog.Root open modal>
      {props.scrim ? <Dialog.Overlay className={props.scrim}>{content}</Dialog.Overlay> : content}
    </Dialog.Root>
  );
}
