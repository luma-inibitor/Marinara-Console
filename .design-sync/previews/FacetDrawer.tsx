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

import { FacetDrawer } from "marinara-console";

/** Every facet in the current slice, with counts, as toggles — grouped by
 *  where the number came from, because a reviewer treats a count the console
 *  computed differently from one the model asserted. A selected value stays
 *  listed at count 0; dropping it would make the selection un-clearable. */
export function Facets() {
  return (
    <Stage height={700}>
      <FacetDrawer
        onToggle={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        emptyText="No facets in this slice."
        groups={[
          {
            key: "computed",
            label: "Computed by the console",
            facets: [
              { id: "type", label: "Type", values: [
                { value: "character", count: 12, on: true },
                { value: "relationship", count: 5, on: false },
                { value: "thread", count: 4, on: false },
                { value: "world", count: 2, on: false },
              ] },
              { id: "section", label: "Section key", values: [
                { value: "core", count: 23, on: false },
                { value: "voice", count: 8, on: false },
                { value: "backstory", count: 6, on: false },
              ] },
            ],
          },
          {
            key: "asserted",
            label: "Asserted by the model",
            facets: [
              { id: "confidence", label: "Confidence", values: [
                { value: "high", count: 18, on: false },
                { value: "medium", count: 9, on: true },
                { value: "low", count: 3, on: false },
              ] },
              { id: "source", label: "Source", values: [
                { value: "source_character_c7a1843d96ae1092", label: "Harbour ledger", count: 14, on: false },
                { value: "source_character_9f2c1ad4e37b58c0", label: "Meridian archive", count: 7, on: false },
              ] },
            ],
          },
        ]}
      />
    </Stage>
  );
}
