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

import { Picker } from "marinara-console";

/** Choose one value from a short, fixed list, in a bottom sheet. The sheet
 *  projection exists because these triggers live in the phone's thumb rail. */
export function Open() {
  return (
    <Stage height={600}>
      <Picker
        open
        label="Sort entries by"
        current="updated"
        onPick={() => {}}
        onClose={() => {}}
        options={[
          { id: "updated", label: "Last updated", hint: "newest first" },
          { id: "title", label: "Title", hint: "A–Z" },
          { id: "size", label: "Section size", hint: "largest first" },
          { id: "keywords", label: "Keyword count" },
        ]}
      />
    </Stage>
  );
}
