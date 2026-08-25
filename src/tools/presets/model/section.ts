// A preset's sections: which of them the assembler keeps, what order they
// reach it in, what each costs, and where a group's run begins and ends.
import { tokensOf } from "../../../lib/tokens";
import type { PresetFull, PromptGroup, PromptPreset, PromptSection } from "../api/schema";
import { expand } from "./macros";
import { isMarker } from "./marker";

/**
 * The assembler drops a section whose GROUP is disabled, regardless of the
 * section's own flag (assembler.ts: `if (group && group.enabled !== "true") return []`).
 */
export function effectivelyEnabled(s: PromptSection, groups: PromptGroup[]): boolean {
  if (!s.enabled) return false;
  if (!s.groupId) return true;
  const g = groups.find((x) => x.id === s.groupId);
  return !g || g.enabled;
}

/** Static tokens for a section, with macros expanded. Markers contribute at runtime. */
export const sectionTokens = (s: PromptSection, preset: PromptPreset): number =>
  isMarker(s) ? 0 : tokensOf(expand(s.content, preset));

export function orderedSections(full: PresetFull): PromptSection[] {
  const order = full.preset.sectionOrder;
  const byId = new Map(full.sections.map((s) => [s.id, s]));
  const listed = order.map((id) => byId.get(id)).filter((s): s is PromptSection => !!s);
  const rest = full.sections.filter((s) => !order.includes(s.id));
  return [...listed, ...rest];
}

/** Contiguous same-group runs — the assembler wraps only CONSECUTIVE members. */
export function groupRunBoundaries(sections: PromptSection[]): Map<string, "start" | "mid" | "end" | "solo"> {
  const out = new Map<string, "start" | "mid" | "end" | "solo">();
  sections.forEach((s, i) => {
    if (!s.groupId) return;
    const prev = sections[i - 1]?.groupId === s.groupId;
    const next = sections[i + 1]?.groupId === s.groupId;
    out.set(s.id, prev && next ? "mid" : prev ? "end" : next ? "start" : "solo");
  });
  return out;
}
