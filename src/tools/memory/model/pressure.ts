// How full a section would be if the queue were applied.
//
// Mirrors isAdditiveLtmSection in the package's draft-projector: some sections
// accumulate and some are replaced, and only the accumulating ones can be
// pushed over the cap by a batch.

import { SECTION_CAP, type Note } from "../api/types";
import type { Row } from "./review";

// ── section pressure ────────────────────────────────────────────────
// Projected size of every additive section the queue writes to: what the note
// already holds plus what every kept-or-undecided claim would append. Mirrors
// isAdditiveLtmSection in the package's draft-projector.

function isAdditive(type: string | undefined, tags: string[] | undefined, key: string): boolean {
  const tg = tags ?? [];
  if (type === "timeline_event") return true;
  if (type === "character") return !["items", "progression"].includes(key);
  if (type === "relationship") return key === "history";
  if (type === "world") return true;
  if (type === "tone") return key === "observations";
  return tg.includes("anchor") || key === "anchors";
}

export interface SectionPressure { noteId: string; key: string; current: number; projected: number }

export function computePressure(
  rows: Row[],
  decisionOf: (key: string) => "keep" | "drop" | undefined,
  notesById: Map<string, Note>,
): Map<string, SectionPressure> {
  const proj = new Map<string, SectionPressure & { additive: boolean }>();
  for (const row of rows) {
    if (decisionOf(row.key) === "drop") continue;
    const existing = notesById.get(row.targetId);
    for (const part of row.parts) {
      const k = `${row.targetId} ${part.key}`;
      let p = proj.get(k);
      if (!p) {
        p = {
          noteId: row.targetId,
          key: part.key,
          current: existing?.sections?.[part.key]?.text?.length ?? 0,
          projected: 0,
          additive: !existing || isAdditive(existing.type ?? row.targetType, existing.tags, part.key),
        };
        p.projected = p.current;
        proj.set(k, p);
      }
      if (p.additive) p.projected += (part.text?.length ?? 0) + 2;
    }
  }
  const out = new Map<string, SectionPressure>();
  for (const [k, p] of proj) if (p.additive) out.set(k, p);
  return out;
}

/** The pressure map is a PARAMETER, not a read: this is called from render, and
 *  a store read there would not subscribe the caller — the badge would freeze
 *  at whatever pressure held when the row first painted. */
export function rowOverflows(row: Row, sectionPressure: Map<string, SectionPressure>): boolean {
  return row.parts.some((p) => (sectionPressure.get(`${row.targetId} ${p.key}`)?.projected ?? 0) > SECTION_CAP);
}
