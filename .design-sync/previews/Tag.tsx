import { Tag } from "marinara-console";

const row = { display: "flex", flexWrap: "wrap" as const, gap: "var(--s2)", alignItems: "center" };

/** The eight memory types, as static labels. A Tag is never pressable — that
 *  is the whole reason it exists beside Chip. */
export function Types() {
  return (
    <div style={row}>
      {["character", "relationship", "timeline event", "thread", "world", "tone", "source", "neutral"].map((s) => (
        <Tag key={s}>{s}</Tag>
      ))}
    </div>
  );
}

/** Keywords off a lorebook entry — the data face, so they read as values. */
export function Keywords() {
  return (
    <div style={row}>
      {["harbour", "writ", "ledger", "salvage desk", "Meridian archive", "fortnight rota"].map((s) => (
        <Tag key={s}>{s}</Tag>
      ))}
    </div>
  );
}

/** Mixed with values, which is where the mono face earns its keep. */
export function Values() {
  return (
    <div style={{ display: "grid", gap: "var(--s2)", maxWidth: 420 }}>
      <div style={row}><span className="t-label t-label-s" style={{ width: 72 }}>type</span><Tag>character</Tag></div>
      <div style={row}><span className="t-label t-label-s" style={{ width: 72 }}>scope</span><Tag>chat_2f8b41c9</Tag></div>
      <div style={row}><span className="t-label t-label-s" style={{ width: 72 }}>version</span><Tag>v4</Tag></div>
    </div>
  );
}
