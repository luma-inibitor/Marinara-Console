import { EmptyState } from "marinara-console";
import { AllClear, Failure, NoMatches, ICON_SIZE } from "../../src/ui/icons";

const btn = {
  padding: "6px 10px",
  background: "var(--surface-2)",
  border: "var(--hairline)",
  borderRadius: "var(--r-s)",
  color: "var(--text)",
};

export function Clear() {
  return (
    <div style={{ maxWidth: 420 }}>
      <EmptyState
        tone="ok"
        icon={<AllClear size={ICON_SIZE.hero} stroke={1.75} />}
        title="Every claim decided"
        body={<>All 24 claims from this extraction were kept or dropped. <b>char_devi_okonkwo</b> gained two sections.</>}
        actions={<button className="t-label" style={btn}>Back to vault</button>}
      />
    </div>
  );
}

export function Failed() {
  return (
    <div style={{ maxWidth: 420 }}>
      <EmptyState
        tone="danger"
        icon={<Failure size={ICON_SIZE.hero} stroke={1.75} />}
        title="Extraction stopped"
        body={<>The model returned nothing for chapters 7–9. No sections were written, so the vault is unchanged.</>}
        actions={<button className="t-label" style={btn}>Run again</button>}
      />
    </div>
  );
}

export function Filtered() {
  return (
    <div style={{ maxWidth: 420 }}>
      <EmptyState
        icon={<NoMatches size={ICON_SIZE.hero} stroke={1.75} />}
        title="No notes match this filter"
        body={<>Type <b>relationship</b> and salience above 0.8 leave nothing. Widen one of the two.</>}
        actions={<button className="t-label" style={btn}>Clear filters</button>}
      />
    </div>
  );
}
