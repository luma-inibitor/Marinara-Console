// What one preset costs before anything is filled in at runtime.
import { tokensOf } from "../../../lib/tokens";
import type { PresetFull } from "../api/schema";
import { expand } from "./macros";
import { isMarker } from "./marker";
import { effectivelyEnabled, orderedSections, sectionTokens } from "./section";

export interface PresetLoad {
  sectionTok: number;
  promptTok: number;
  total: number;
  enabled: number;
  totalSections: number;
  markers: number;
}

/**
 * Template cost for one mode. Excludes character cards, personas, lorebooks and
 * chat history — markers are counted separately as "+ runtime".
 */
export function presetLoad(full: PresetFull, mode: "conversation" | "game"): PresetLoad {
  const ordered = orderedSections(full);
  const on = ordered.filter((s) => effectivelyEnabled(s, full.groups));
  const sectionTok = on.reduce((a, s) => a + sectionTokens(s, full.preset), 0);
  const promptTok = tokensOf(expand(
    mode === "game" ? full.preset.gamePrompt : full.preset.conversationPrompt, full.preset));
  return {
    sectionTok, promptTok, total: sectionTok + promptTok,
    enabled: on.length, totalSections: ordered.length,
    markers: on.filter(isMarker).length,
  };
}
