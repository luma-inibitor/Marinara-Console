// The trap and the background aria-hiding for any surface that renders
// `aria-modal`. Dismissal and history stay with the caller and `overlays.ts`.
import type { ReactNode } from "react";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

export function FocusTrap(props: {
  children: ReactNode;
  /** Omit for a surface that fills the viewport and has no scrim. */
  scrim?: string;
  onOutside?: () => void;
}) {
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  const content = (
    <Dialog.Content
      asChild
      // Radix's listener shares document/capture with the caller's, where
      // stopPropagation cannot reach it, so both would close a layer.
      onEscapeKeyDown={(e) => e.preventDefault()}
      onPointerDownOutside={(e) => { e.preventDefault(); props.onOutside?.(); }}
      // A caller's own restore is taken back while the trap is up. This one holds.
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
