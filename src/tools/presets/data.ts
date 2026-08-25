/* @copy-strict */
// Prompt presets: types, wire normalization, and derived cost.
//
// WIRE FORMAT WARNING — the engine stores booleans and nested objects as TEXT
// columns (packages/server/src/db/schema/prompts.ts), so `isDefault`,
// `enabled`, `isMarker`, `forbidOverrides` arrive as the strings "true"/"false"
// and `markerConfig`/`defaultChoices`/`parameters` arrive as JSON strings.
// `"false"` is truthy, so every raw truthiness test silently passes. The
// engine's own client normalizes the same way (PresetEditor.tsx: `enabled ===
// "true" || enabled === true`). Everything here is decoded at the wire
// boundary; components only ever see real booleans and parsed objects.
import * as v from "valibot";
import { api, tokensOf } from "../../shell/api";
import { parseItems, parseWire, parseWrite } from "../../shell/wire";
import { tAny } from "../../copy";

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

// ── wire ──

/** A plain `v.boolean()` rejects every live preset: the TEXT columns send
 *  `"true"` and `"false"`. This takes those two strings and the two booleans a
 *  JSON column would have given, and nothing else. */
const wireBool = v.pipe(
  v.union([v.boolean(), v.picklist(["true", "false"])]),
  v.transform((raw) => raw === true || raw === "true"),
);

/** A JSON string, or the value already decoded, checked against `inner` either
 *  way. The tool maps over `sectionOrder` and divides by
 *  `parameters.maxContext`, so a decode is not enough on its own. */
const jsonText = <S extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(inner: S) =>
  v.pipe(v.unknown(), v.rawTransform<unknown, v.InferOutput<S>>(({ dataset, addIssue, NEVER }) => {
    let decoded = dataset.value;
    if (typeof decoded === "string") {
      try { decoded = JSON.parse(decoded); } catch { addIssue({ expected: "json" }); return NEVER; }
    }
    const result = v.safeParse(inner, decoded);
    if (!result.success) { addIssue({ expected: "json", received: result.issues[0].message }); return NEVER; }
    return result.output;
  }));

const id = v.pipe(v.string(), v.minLength(1));

/** `wrapFormat` and `role` render as themselves, not through the catalog. */
export const PresetSchema = v.looseObject({
  id,
  name: v.string(),
  description: v.string(),
  conversationPrompt: v.string(),
  gamePrompt: v.string(),
  sectionOrder: jsonText(v.array(v.string())),
  wrapFormat: v.string(),
  isDefault: wireBool,
  author: v.string(),
  systemKey: v.nullable(v.string()),
  defaultChoices: jsonText(v.record(v.string(), v.union([v.string(), v.array(v.string())]))),
  parameters: jsonText(v.looseObject({ maxContext: v.optional(v.number()) })),
  updatedAt: v.string(),
});

export const SectionSchema = v.looseObject({
  id,
  presetId: v.string(),
  identifier: v.string(),
  name: v.string(),
  content: v.string(),
  role: v.string(),
  enabled: wireBool,
  isMarker: wireBool,
  markerConfig: v.nullable(jsonText(v.looseObject({ type: v.string() }))),
  groupId: v.nullable(v.string()),
  injectionPosition: v.string(),
  injectionDepth: v.number(),
  injectionOrder: v.number(),
  forbidOverrides: wireBool,
});

const GroupSchema = v.looseObject({ id, name: v.string(), enabled: wireBool });

const ChoiceBlockSchema = v.looseObject({
  id,
  variableName: v.string(),
  question: v.string(),
  options: jsonText(v.array(v.looseObject({ id: v.string(), label: v.string(), value: v.string() }))),
});

export const PresetFullSchema = v.looseObject({
  preset: PresetSchema,
  sections: v.array(SectionSchema),
  groups: v.array(GroupSchema),
  choiceBlocks: v.array(ChoiceBlockSchema),
});

export type PromptPreset = v.InferOutput<typeof PresetSchema>;
export type PromptSection = v.InferOutput<typeof SectionSchema>;
type PromptGroup = v.InferOutput<typeof GroupSchema>;
export type PresetFull = v.InferOutput<typeof PresetFullSchema>;

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
    const choice = preset.defaultChoices[key];
    if (choice == null) return whole;                  // {{user}} etc. resolve at runtime
    return Array.isArray(choice) ? choice.join(", ") : choice;
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

/** Two arguments because @copy-strict reads "GET /x" as copy. */
const wire = (method: string, path: string) => `${method} ${path}`;

export const fetchPresets = async () =>
  parseItems(PresetSchema, await api("/prompts"), wire("GET", "/prompts"));

export const fetchFull = async (presetId: string) =>
  parseWire(PresetFullSchema, await api(`/prompts/${presetId}/full`), wire("GET", "/prompts/:id/full"));

export const patchPreset = (presetId: string, patch: Record<string, unknown>) =>
  api(`/prompts/${presetId}`, { method: "PATCH", body: patch });

/** `nullish` because the route may answer 204 rather than the saved section. */
export const patchSection = async (presetId: string, sectionId: string, patch: Record<string, unknown>) =>
  parseWrite(v.nullish(SectionSchema), await api(`/prompts/${presetId}/sections/${sectionId}`, { method: "PATCH", body: patch }), wire("PATCH", "/prompts/:id/sections/:sectionId"));
export const createSection = async (presetId: string, body: Record<string, unknown>) =>
  parseWrite(SectionSchema, await api(`/prompts/${presetId}/sections`, { method: "POST", body }), wire("POST", "/prompts/:id/sections"));
export const deleteSection = (presetId: string, sectionId: string) =>
  api<null>(`/prompts/${presetId}/sections/${sectionId}`, { method: "DELETE" });
export const duplicatePreset = async (presetId: string) =>
  parseWrite(PresetSchema, await api(`/prompts/${presetId}/duplicate`, { method: "POST" }), wire("POST", "/prompts/:id/duplicate"));
export const setDefaultPreset = (id: string) =>
  api(`/prompts/${id}/set-default`, { method: "POST" });
