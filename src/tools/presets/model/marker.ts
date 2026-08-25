/* @copy-strict */
// A marker is a section whose content the engine injects at runtime, and what
// it is called.
import { tAny } from "../../../copy";
import type { PromptSection } from "../api/schema";

// Marker types the engine's assembler actually handles (packages/server/src/
// services/prompt/{assembler,marker-expander}.ts). Do not invent entries here:
// an unmapped type falls through to its raw identifier, which is the honest
// failure mode.
//
// The values are copy KEYS, not labels; the labels live in src/copy/presets.json.
const MARKER_LABEL_KEYS: Record<string, string> = {
  character: "presets.marker.character",
  persona: "presets.marker.persona",
  lorebook: "presets.marker.lorebook",
  chat_history: "presets.marker.chat_history",
  chat_summary: "presets.marker.chat_summary",
  dialogue_examples: "presets.marker.dialogue_examples",
  agent_data: "presets.marker.agent_data",
  id_macro_cards: "presets.marker.id_macro_cards",
};

/**
 * Truth is `markerConfig` — marker-expander.ts expands purely by config type
 * and ignores the section's own content. Never infer from content length: a
 * freshly created section is empty and is NOT a marker.
 */
export const isMarker = (s: PromptSection): boolean => s.isMarker && s.markerConfig != null;

export const markerLabel = (s: PromptSection): string | null => {
  if (!isMarker(s)) return null;
  const type = s.markerConfig!.type;
  const key = MARKER_LABEL_KEYS[type];
  // An unmapped type still falls through to its raw identifier: better a
  // reader sees `custom_thing` than a label we invented for it.
  return key ? tAny(key) : type;
};
