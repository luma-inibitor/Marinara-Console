import { RawJson } from "marinara-console";

const note = {
  id: "char_devi_okonkwo",
  type: "character",
  title: "Devi Okonkwo",
  tags: ["harbour", "writ", "ledger"],
  sections: {
    core: { text: "Runs the salvage desk at Harbour Ledger.", updatedAt: "2026-08-19T10:04:00Z", confidence: 0.92 },
    voice: { text: "Speaks in short declaratives.", updatedAt: "2026-08-19T10:04:00Z", confidence: 0.71 },
  },
  links: [{ target: "world_harbour_ledger", relation: "occurred_in" }],
  version: 4,
};

/** Closed by default, and labelled with how much it hides — a fold that never
 *  reads as missing content. This is the resting state the reader meets. */
export function Folded() {
  return (
    <div style={{ maxWidth: 460 }}>
      <RawJson value={note} />
    </div>
  );
}

/** The label names which record is folded away, for a screen showing several. */
export function Labelled() {
  return (
    <div style={{ display: "grid", gap: "var(--s2)", maxWidth: 460 }}>
      <RawJson value={note} label="Memory record" />
      <RawJson value={note.sections} label="Sections" />
      <RawJson value={note.links} label="Links" />
    </div>
  );
}

/** The line count is computed from the value, so a small record says so. */
export function Small() {
  return (
    <div style={{ maxWidth: 460 }}>
      <RawJson value={{ status: "ok", elapsedMs: 41 }} label="Preflight" />
    </div>
  );
}
