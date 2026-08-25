import { SectionKey } from "marinara-console";

const keys = ["core", "voice", "backstory", "habits", "appearance"];

/** The keys one character note actually carries, read as a set of addresses. */
export function Keys() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s3)", alignItems: "baseline" }}>
      {keys.map((k) => <SectionKey key={k} k={k} />)}
    </div>
  );
}

/** In situ: the key addresses a row, and the row's own numbers sit opposite it. */
export function Rows() {
  const rows = [
    { k: "core", chars: 214 },
    { k: "observations", chars: 96 },
    { k: "canon", chars: 252 },
  ];
  return (
    <div style={{ display: "grid", gap: "var(--s1)", width: 320 }}>
      {rows.map((r) => (
        <div key={r.k} style={{ display: "flex", alignItems: "center", gap: "var(--s2)",
                                minHeight: "var(--tap-2)", borderBottom: "var(--hairline)" }}>
          <SectionKey k={r.k} />
          <span className="t-data t-num" style={{ marginLeft: "auto", color: "var(--text-dim)", fontSize: 11 }}>
            {r.chars}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A long key beside a value that must not shrink — the key is the address, so
 *  it wraps rather than truncating (design/CHECKLIST.md §4). */
export function Narrow() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "var(--s2)", width: 200,
                  padding: "var(--s2) var(--s3)", background: "var(--surface-2)",
                  border: "var(--hairline)", borderRadius: "var(--r-s)" }}>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <SectionKey k="progression" />
      </span>
      <span className="t-data" style={{ marginLeft: "auto", flex: "none", color: "var(--text-dim)", fontSize: 11 }}>
        additive
      </span>
    </div>
  );
}
