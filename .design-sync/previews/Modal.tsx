import type { ReactNode } from "react";

// The card wraps a single-mode story in `.ds-single { transform: translateZ(0) }`,
// and a transform makes that element the containing block for `position: fixed`
// descendants. The scrim's `inset: 0` therefore resolves against a box whose only
// child is itself fixed — which collapses to 0px and the card reads blank. This
// stage gives it a real one. Preview scaffolding, not part of the component: in
// the app the scrim resolves against the viewport.
function Stage(props: { height: number; children: ReactNode }) {
  return <div style={{ position: "relative", height: props.height, overflow: "hidden" }}>{props.children}</div>;
}

import { Modal, SheetHead, Chip, Edu } from "marinara-console";

/** A Modal sits in the middle because it interrupts, where a Sheet arrives
 *  from an edge because it extends. This is the shape it exists for: a
 *  question that must be answered before anything else happens. */
export function Confirm() {
  return (
    <Stage height={520}>
      <Modal label="Import and extract" onClose={() => {}}>
        <SheetHead title="Import and extract 4 sources?" autoFocus />
        <div style={{ display: "grid", gap: "var(--s3)", paddingTop: "var(--s3)" }}>
          <p className="t-prose" style={{ margin: 0, fontSize: 13.5 }}>
            Each source is saved first, then read for proposed memories.
            Extraction spends model calls and runs for several minutes.
          </p>
          <Edu>Proposed memories land in the review queue. Nothing is written to the vault until you keep them.</Edu>
          <div style={{ display: "flex", gap: "var(--s2)", justifyContent: "flex-end" }}>
            <Chip onClick={() => {}}>Cancel</Chip>
            <Chip pressed onClick={() => {}}>Import and extract</Chip>
          </div>
        </div>
      </Modal>
    </Stage>
  );
}
