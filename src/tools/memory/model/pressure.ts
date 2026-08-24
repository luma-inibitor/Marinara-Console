// How full a section would be if the queue were applied.
//
// Mirrors isAdditiveLtmSection in the package's draft-projector: some sections
// accumulate and some are replaced wholesale. Both kinds have a size, and both
// can end up over the cap — the difference is only in how they get there.

import { SECTION_CAP, type Note } from "../api/types";
import type { Row } from "./review";

/** Characters the engine spends joining an appended claim to what is already
 *  there. Charged per contributing claim, and only when it contributes. */
const SEPARATOR_CHARS = 2;

/** Whether a section accumulates or is replaced wholesale. */
function isAdditive(type: string | undefined, tags: string[] | undefined, key: string): boolean {
  const tg = tags ?? [];
  if (type === "timeline_event") return true;
  if (type === "character") return !["items", "progression"].includes(key);
  if (type === "relationship") return key === "history";
  if (type === "world") return true;
  if (type === "tone") return key === "observations";
  return tg.includes("anchor") || key === "anchors";
}

export interface SectionPressure {
  noteId: string;
  key: string;
  current: number;
  projected: number;
  /** False when the section is replaced rather than appended to. Carried
   *  rather than filtered on: a replaced section still has a size, and a
   *  consumer that cannot tell "not measured" from "no pressure" reports an
   *  over-cap replacement as fine. */
  additive: boolean;
}

/** Size of every section the queue writes to: what the note already holds, plus
 *  what the kept-and-undecided claims would do to it.
 *
 *  A dropped claim still contributes its target's entry, just nothing to the
 *  projection. Skipping the row outright would take the section's stored size
 *  down with it, and a note already over cap would read as having no pressure
 *  the moment its last claim was dropped. */
export function computePressure(
  rows: Row[],
  decisionOf: (key: string) => "keep" | "drop" | undefined,
  notesById: Map<string, Note>,
): Map<string, SectionPressure> {
  const proj = new Map<string, SectionPressure>();
  for (const row of rows) {
    const dropped = decisionOf(row.key) === "drop";
    const existing = notesById.get(row.targetId);
    for (const part of row.parts) {
      const k = `${row.targetId} ${part.key}`;
      let p = proj.get(k);
      if (!p) {
        const current = existing?.sections?.[part.key]?.text?.length ?? 0;
        p = {
          noteId: row.targetId,
          key: part.key,
          current,
          projected: current,
          // The target's type decides whether or not the note exists yet: a
          // claim must not change additivity the moment its target is created.
          additive: isAdditive(existing?.type ?? row.targetType, existing?.tags, part.key),
        };
        proj.set(k, p);
      }
      if (dropped) continue;
      const len = part.text?.length ?? 0;
      if (!p.additive) {
        // A replace: the section becomes this text. A later claim overwrites an
        // earlier one, which is the order the engine applies them in.
        p.projected = len;
      } else if (len > 0) {
        p.projected += len + SEPARATOR_CHARS;
      }
    }
  }
  return proj;
}

/** The pressure map is a PARAMETER, not a read: this is called from render, and
 *  a store read there would not subscribe the caller — the badge would freeze
 *  at whatever pressure held when the row first painted.
 *
 *  The comparison is strict. SECTION_CAP is the schema's `text max`, so a
 *  section sitting exactly on it is full rather than over, and every other
 *  reading of the cap agrees. */
export function rowOverflows(row: Row, sectionPressure: Map<string, SectionPressure>): boolean {
  return row.parts.some((p) => (sectionPressure.get(`${row.targetId} ${p.key}`)?.projected ?? 0) > SECTION_CAP);
}

/** A section's fullness as a percentage, for display.
 *
 *  Floored below the cap so a section one character short cannot round up to
 *  "100%" while being described as merely near it. Rounded once over, where
 *  the exact figure no longer matters and 100% would understate. */
export function capPercent(chars: number): number {
  const ratio = chars / SECTION_CAP;
  return ratio <= 1 ? Math.floor(ratio * 100) : Math.round(ratio * 100);
}
