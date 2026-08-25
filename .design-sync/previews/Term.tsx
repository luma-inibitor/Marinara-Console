import { Term } from "marinara-console";

export function Sentence() {
  return (
    <p className="t-prose" style={{ maxWidth: 440, margin: 0 }}>
      This draft raises one{" "}
      <Term tip="claim · a single proposed fact, kept or dropped on its own">claim</Term>{" "}
      against the{" "}
      <Term tip="section · one named block of a note's text, with its own confidence and evidence">section</Term>{" "}
      it would land in.
    </p>
  );
}

export function Chips() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Term chip tip="character · a note about one person, with exactly one subject">character</Term>
      <Term chip tip="thread · an open question or storyline being tracked">thread</Term>
      <Term chip tip="timeline event · something that happened, anchored in time">timeline event</Term>
    </div>
  );
}

/** A glossary run: the vocabulary a reviewer meets on the review queue, each
 *  term carrying the definition the console would otherwise have to repeat. */
export function Glossary() {
  return (
    <div style={{ display: "grid", gap: "var(--s2)", maxWidth: 440 }}>
      <p className="t-prose" style={{ margin: 0, fontSize: 13.5 }}>
        A <Term tip="proposed memory · a note the model extracted but nobody has kept or dropped yet">proposed memory</Term>{" "}
        arrives with its <Term tip="evidence · the span of source text a claim was read from">evidence</Term> attached.
      </p>
      <p className="t-prose" style={{ margin: 0, fontSize: 13.5 }}>
        Keeping it writes to the <Term tip="vault · the set of memories the engine will actually inject into context">vault</Term>;{" "}
        dropping it records a <Term tip="rejection reason · why a candidate was binned, kept so the same one is not re-proposed">rejection reason</Term>.
      </p>
    </div>
  );
}
