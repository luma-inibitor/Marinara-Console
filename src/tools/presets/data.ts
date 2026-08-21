// Prompt presets: types + API. Mirrors packages/shared/src/schemas/prompt.schema.ts.
import { api, tokensOf } from "../../shell/api";

export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  conversationPrompt: string;
  gamePrompt: string;
  sectionOrder: string;   // JSON-encoded string[] on the wire
  wrapFormat: "xml" | "markdown" | "none";
  isDefault: boolean;
  author: string;
  systemKey: string | null;   // set => stock preset, read-only upstream
  updatedAt: string;
  [extra: string]: unknown;
}

export interface PromptSection {
  id: string;
  presetId: string;
  identifier: string;
  name: string;
  content: string;
  role: "system" | "user" | "assistant";
  enabled: boolean;
  isMarker: boolean;
  groupId: string | null;
  injectionPosition: string;
  injectionDepth: number;
  injectionOrder: number;
  forbidOverrides: boolean;
  [extra: string]: unknown;
}

export interface PromptGroup { id: string; name: string; [extra: string]: unknown; }

export interface PresetFull {
  preset: PromptPreset;
  sections: PromptSection[];
  groups: PromptGroup[];
  choiceBlocks: unknown[];
}

export const sectionTokens = (s: PromptSection) => tokensOf(s.content);

export function orderedSections(full: PresetFull): PromptSection[] {
  let order: string[] = [];
  try { order = JSON.parse(full.preset.sectionOrder || "[]") as string[]; } catch { /* raw array? */ }
  if (!Array.isArray(order)) order = [];
  const byId = new Map(full.sections.map((s) => [s.id, s]));
  const listed = order.map((id) => byId.get(id)).filter((s): s is PromptSection => !!s);
  const rest = full.sections.filter((s) => !order.includes(s.id));
  return [...listed, ...rest];
}

/** Everything the enabled prompt would spend, per mode. */
export function presetLoad(full: PresetFull, mode: "conversation" | "game") {
  const sections = orderedSections(full).filter((s) => s.enabled);
  const sectionTok = sections.reduce((a, s) => a + sectionTokens(s), 0);
  const promptTok = tokensOf(mode === "game" ? full.preset.gamePrompt : full.preset.conversationPrompt);
  return { sectionTok, promptTok, total: sectionTok + promptTok, enabled: sections.length };
}

export const fetchPresets = () => api<PromptPreset[]>("/prompts");
export const fetchFull = (id: string) => api<PresetFull>(`/prompts/${id}/full`);
export const patchPreset = (id: string, patch: Record<string, unknown>) =>
  api<PromptPreset>(`/prompts/${id}`, { method: "PATCH", body: patch });
export const patchSection = (presetId: string, sectionId: string, patch: Record<string, unknown>) =>
  api<PromptSection>(`/prompts/${presetId}/sections/${sectionId}`, { method: "PATCH", body: patch });
export const createSection = (presetId: string, body: Record<string, unknown>) =>
  api<PromptSection>(`/prompts/${presetId}/sections`, { method: "POST", body });
export const deleteSection = (presetId: string, sectionId: string) =>
  api<null>(`/prompts/${presetId}/sections/${sectionId}`, { method: "DELETE" });
export const duplicatePreset = (id: string) => api<PromptPreset>(`/prompts/${id}/duplicate`, { method: "POST" });
export const setDefaultPreset = (id: string) => api<PromptPreset>(`/prompts/${id}/set-default`, { method: "POST" });
export const deletePreset = (id: string) => api<null>(`/prompts/${id}`, { method: "DELETE" });
