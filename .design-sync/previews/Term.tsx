import { Term } from "marinara-console";

export function Sentence() {
  return (
    <p className="t-prose" style={{ maxWidth: 440, margin: 0 }}>
      This draft raises one <Term tip="claim · a single proposed fact, kept or dropped on its own">claim</Term> against
      the <Term tip="section · one named block of a note's text, with its own confidence and evidence">section</Term> it
      would land in.
    </p>
  );
}

export function Chips() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Term chip tip="character · a note about one person, with exactly one subject">
        character
      </Term>
      <Term chip tip="thread · an open question or storyline being tracked">
        thread
      </Term>
      <Term chip tip="timeline event · something that happened, anchored in time">
        timeline event
      </Term>
    </div>
  );
}
