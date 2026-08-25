import { ListEmpty } from "marinara-console";

/** Nothing has ever been added — the only state that offers to make the first. */
export function FirstRun() {
  return (
    <div style={{ maxWidth: 460 }}>
      <ListEmpty kind="first-run" what="entries" action={{ label: "Add entry", run: () => {} }} />
    </div>
  );
}

/** The filtered state names the filters responsible and offers a way out of
 *  itself — the reason first-run copy must never stand in for this one. */
export function Filtered() {
  return (
    <div style={{ maxWidth: 460 }}>
      <ListEmpty
        kind="filtered"
        what="entries"
        filters={[
          { label: "type: character", clear: () => {} },
          { label: "flagged", clear: () => {} },
        ]}
        onClearAll={() => {}}
      />
    </div>
  );
}

/** A queue worked to the end: an achievement, not an absence. */
export function Cleared() {
  return (
    <div style={{ maxWidth: 460 }}>
      <ListEmpty kind="cleared" what="proposed memory" />
    </div>
  );
}
