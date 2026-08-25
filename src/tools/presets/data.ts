/* @copy-strict */
// Prompt presets: types, wire normalization, and derived cost.
//
// WIRE FORMAT WARNING — the engine stores booleans and nested objects as TEXT
// columns (packages/server/src/db/schema/prompts.ts), so `isDefault`,
// `enabled`, `isMarker`, `forbidOverrides` arrive as the strings "true"/"false"
// and `markerConfig`/`defaultChoices`/`parameters` arrive as JSON strings.
// `"false"` is truthy, so every raw truthiness test silently passes. The
// engine's own client normalizes the same way (PresetEditor.tsx: `enabled ===
// "true" || enabled === true`). Everything here is normalized at the fetch
// boundary; components only ever see real booleans and parsed objects.
import { api, tokensOf } from "../../shell/api";
import { tAny } from "../../copy";

const bool = (v: unknown): boolean => v === true || v === "true";
const parseJson = <T,>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v !== "string") return v as T;
  try { return JSON.parse(v) as T; } catch { return fallback; }
};

type MarkerType =
  | "character" | "persona" | "lorebook" | "chat_history" | "chat_summary"
  | "dialogue_examples" | "agent_data" | "id_macro_cards" | string;

interface MarkerConfig { type: MarkerType; [extra: string]: unknown; }

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

export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  conversationPrompt: string;
  gamePrompt: string;
  sectionOrder: string[];
  wrapFormat: "xml" | "markdown" | "none";
  isDefault: boolean;
  author: string;
  systemKey: string | null;
  defaultChoices: Record<string, string | string[]>;
  parameters: { maxContext?: number; [k: string]: unknown };
  updatedAt: string;
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
  markerConfig: MarkerConfig | null;
  groupId: string | null;
  injectionPosition: string;
  injectionDepth: number;
  injectionOrder: number;
  forbidOverrides: boolean;
}

interface PromptGroup { id: string; name: string; enabled: boolean; }

export interface PresetFull {
  preset: PromptPreset;
  sections: PromptSection[];
  groups: PromptGroup[];
  choiceBlocks: ChoiceBlock[];
}

interface ChoiceBlock {
  id: string;
  variableName: string;
  question: string;
  options: Array<{ id: string; label: string; value: string }>;
}

// ── normalization ──
function normPreset(raw: Record<string, unknown>): PromptPreset {
  return {
    ...(raw as unknown as PromptPreset),
    isDefault: bool(raw.isDefault),
    sectionOrder: parseJson<string[]>(raw.sectionOrder, []),
    defaultChoices: parseJson<Record<string, string | string[]>>(raw.defaultChoices, {}),
    parameters: parseJson<Record<string, unknown>>(raw.parameters, {}),
    systemKey: (raw.systemKey as string) || null,
  };
}

function normSection(raw: Record<string, unknown>): PromptSection {
  return {
    ...(raw as unknown as PromptSection),
    enabled: bool(raw.enabled),
    isMarker: bool(raw.isMarker),
    forbidOverrides: bool(raw.forbidOverrides),
    markerConfig: parseJson<MarkerConfig | null>(raw.markerConfig, null),
  };
}

const normGroup = (raw: Record<string, unknown>): PromptGroup => ({
  ...(raw as unknown as PromptGroup),
  enabled: bool(raw.enabled),
});

const normChoice = (raw: Record<string, unknown>): ChoiceBlock => ({
  ...(raw as unknown as ChoiceBlock),
  options: parseJson<ChoiceBlock["options"]>(raw.options, []),
});

// ── derived ──

/**
 * A marker is a section whose content the engine injects at runtime. Truth is
 * `markerConfig` — marker-expander.ts expands purely by config type and ignores
 * the section's own content. Never infer from content length: a freshly created
 * section is empty and is NOT a marker.
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

/** Expand {{macros}} from the preset's saved choices/variables. */
export function expand(content: string, preset: PromptPreset): string {
  return content.replace(/\{\{([a-z0-9_]+)\}\}/gi, (whole, key: string) => {
    const v = preset.defaultChoices[key];
    if (v == null) return whole;                       // {{user}} etc. resolve at runtime
    return Array.isArray(v) ? v.join(", ") : String(v);
  });
}

/** Static tokens for a section, with macros expanded. Markers contribute at runtime. */
export const sectionTokens = (s: PromptSection, preset: PromptPreset): number =>
  isMarker(s) ? 0 : tokensOf(expand(s.content, preset));

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

// ── API ──
export const fetchPresets = async (): Promise<PromptPreset[]> =>
  (await api<Record<string, unknown>[]>("/prompts")).map(normPreset);

export const fetchFull = async (id: string): Promise<PresetFull> => {
  const raw = await api<{
    preset: Record<string, unknown>;
    sections: Record<string, unknown>[];
    groups: Record<string, unknown>[];
    choiceBlocks: Record<string, unknown>[];
  }>(`/prompts/${id}/full`);
  return {
    preset: normPreset(raw.preset),
    sections: (raw.sections ?? []).map(normSection),
    groups: (raw.groups ?? []).map(normGroup),
    choiceBlocks: (raw.choiceBlocks ?? []).map(normChoice),
  };
};

export const patchPreset = (id: string, patch: Record<string, unknown>) =>
  api(`/prompts/${id}`, { method: "PATCH", body: patch });
export const patchSection = (presetId: string, sectionId: string, patch: Record<string, unknown>) =>
  api(`/prompts/${presetId}/sections/${sectionId}`, { method: "PATCH", body: patch });
export const createSection = async (presetId: string, body: Record<string, unknown>) =>
  normSection(await api<Record<string, unknown>>(`/prompts/${presetId}/sections`, { method: "POST", body }));
export const deleteSection = (presetId: string, sectionId: string) =>
  api<null>(`/prompts/${presetId}/sections/${sectionId}`, { method: "DELETE" });
export const duplicatePreset = async (id: string) =>
  normPreset(await api<Record<string, unknown>>(`/prompts/${id}/duplicate`, { method: "POST" }));
export const setDefaultPreset = (id: string) =>
  api(`/prompts/${id}/set-default`, { method: "POST" });
