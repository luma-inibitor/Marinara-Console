import { Edu } from "marinara-console";

export function Field() {
  return (
    <div style={{ maxWidth: 460 }}>
      <label className="t-label" htmlFor="ex-keywords">
        Keywords
      </label>
      <input
        id="ex-keywords"
        className="t-data"
        defaultValue="harbour, writ, ledger"
        style={{
          width: "100%",
          marginTop: 4,
          padding: "6px 8px",
          background: "var(--surface-2)",
          border: "var(--hairline)",
          borderRadius: "var(--r-s)",
        }}
      />
      <Edu>Keywords decide when a note is pulled into context. Fewer and more specific beats more and vaguer.</Edu>
    </div>
  );
}

export function Wrapping() {
  return (
    <div style={{ maxWidth: 380 }}>
      <Edu>
        A section marked additive is line-merged on every extraction, and duplicate lines are dropped. Sections that are
        not additive are replaced outright.
      </Edu>
    </div>
  );
}
