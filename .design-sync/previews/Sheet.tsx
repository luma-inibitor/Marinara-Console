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

import { Sheet, SheetHead, Chip, DetailSection, Tag } from "marinara-console";

/** The layered surface. At the card's width this is the wide-screen
 *  projection — a right-hand panel; under 900px the same component arrives as
 *  a bottom sheet instead. Shown with the header and body a real caller gives
 *  it: a Sheet with no SheetHead has no way out on a touch device. */
export function Panel() {
  return (
    <Stage height={600}>
      <Sheet label="Devi Okonkwo" onClose={() => {}}>
        <SheetHead title="Devi Okonkwo">
          <Tag>character</Tag>
        </SheetHead>
        <DetailSection sectionKey="core">
          <p className="t-prose" style={{ margin: 0, fontSize: 13.5, whiteSpace: "pre-wrap" }}>
            {"- Runs the salvage desk at Harbour Ledger on a fortnight rota she has never once traded away.\n- Keeps every promise made to a client, however small, and resents being thanked for it."}
          </p>
        </DetailSection>
        <DetailSection sectionKey="voice">
          <p className="t-prose" style={{ margin: 0, fontSize: 13.5 }}>
            Speaks in short declaratives; the longer the sentence, the less she means it.
          </p>
        </DetailSection>
        <div style={{ display: "flex", gap: "var(--s2)", paddingTop: "var(--s3)" }}>
          <Chip onClick={() => {}}>Edit</Chip>
          <Chip onClick={() => {}}>Re-extract</Chip>
        </div>
      </Sheet>
    </Stage>
  );
}
